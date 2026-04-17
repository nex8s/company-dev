import { and, eq, isNull, lte, sql } from "drizzle-orm";
import {
  type Db,
  agents,
  budgetIncidents,
  budgetPolicies,
} from "@paperclipai/db";
import {
  getAgentUsageCentsInWindow,
  monthStart,
  nextMonthStart,
} from "../ledger/operations.js";

/**
 * `budget_policies` row marker used by plugin-payments for the per-agent
 * monthly credit cap. `metric` differentiates A-07 caps from any other
 * Paperclip budget policies on the same agent (e.g. token caps).
 */
export const CREDIT_CAP_METRIC = "credit_usage_cents";
export const CREDIT_CAP_WINDOW = "month";
export const AGENT_SCOPE = "agent";

/**
 * Status value the agent is flipped into when the monthly credit cap is hit.
 * Existing AgentStatus enum already includes `paused` (see
 * packages/shared/src/constants.ts AGENT_STATUSES).
 */
export const PAUSED_STATUS = "paused" as const;

export interface SetAgentMonthlyCapInput {
  readonly companyId: string;
  readonly agentId: string;
  /** Cap in cents. Must be a positive integer. */
  readonly capCents: number;
}

/**
 * Set or update the monthly credit cap for an agent. Idempotent — re-calling
 * with a different `capCents` updates the existing policy in place.
 */
export async function setAgentMonthlyCap(
  db: Db,
  input: SetAgentMonthlyCapInput,
) {
  if (!Number.isInteger(input.capCents) || input.capCents <= 0) {
    throw new Error(
      `setAgentMonthlyCap: capCents must be a positive integer; got ${input.capCents}`,
    );
  }
  const [row] = await db
    .insert(budgetPolicies)
    .values({
      companyId: input.companyId,
      scopeType: AGENT_SCOPE,
      scopeId: input.agentId,
      metric: CREDIT_CAP_METRIC,
      windowKind: CREDIT_CAP_WINDOW,
      amount: input.capCents,
    })
    .onConflictDoUpdate({
      target: [
        budgetPolicies.companyId,
        budgetPolicies.scopeType,
        budgetPolicies.scopeId,
        budgetPolicies.metric,
        budgetPolicies.windowKind,
      ],
      set: {
        amount: input.capCents,
        isActive: true,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row!;
}

/**
 * Look up the active monthly credit cap for an agent. Returns null if no
 * policy is set or the policy is inactive.
 */
export async function getAgentMonthlyCap(
  db: Db,
  input: { companyId: string; agentId: string },
): Promise<{ policyId: string; capCents: number } | null> {
  const [row] = await db
    .select({ id: budgetPolicies.id, amount: budgetPolicies.amount })
    .from(budgetPolicies)
    .where(
      and(
        eq(budgetPolicies.companyId, input.companyId),
        eq(budgetPolicies.scopeType, AGENT_SCOPE),
        eq(budgetPolicies.scopeId, input.agentId),
        eq(budgetPolicies.metric, CREDIT_CAP_METRIC),
        eq(budgetPolicies.windowKind, CREDIT_CAP_WINDOW),
        eq(budgetPolicies.isActive, true),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { policyId: row.id, capCents: row.amount };
}

export interface EnforceAgentMonthlyCapInput {
  readonly companyId: string;
  readonly agentId: string;
  /** Defaults to `new Date()`; injected for deterministic tests. */
  readonly asOf?: Date;
}

export interface EnforceAgentMonthlyCapResult {
  /** Whether a cap is configured for this agent. */
  readonly capConfigured: boolean;
  /** Sum of usage cents in the current month for this agent. */
  readonly usageCents: number;
  /** The cap (if configured). */
  readonly capCents: number | null;
  /** True if usage equals or exceeds the cap. */
  readonly capExceeded: boolean;
  /** True if this call flipped the agent to paused (was active and now paused). */
  readonly pausedNow: boolean;
  /** ID of the budget_incident row recording the trip (set when capExceeded). */
  readonly incidentId: string | null;
}

/**
 * Enforce the agent's monthly credit cap: if cumulative usage in the current
 * month equals or exceeds the cap, flip `agents.status` to `paused` (graceful
 * pause — no in-flight runs are killed) AND record a `budget_incidents` row
 * tagged with the cap window so the resume sweep can find it.
 *
 * Idempotent: if the agent is already paused with an open incident for the
 * same window, no new incident is created and no status flip happens.
 */
export async function enforceAgentMonthlyCap(
  db: Db,
  input: EnforceAgentMonthlyCapInput,
): Promise<EnforceAgentMonthlyCapResult> {
  const asOf = input.asOf ?? new Date();
  const windowStart = monthStart(asOf);
  const windowEnd = nextMonthStart(asOf);

  const cap = await getAgentMonthlyCap(db, {
    companyId: input.companyId,
    agentId: input.agentId,
  });

  const usageCents = await getAgentUsageCentsInWindow(db, {
    companyId: input.companyId,
    agentId: input.agentId,
    windowStart,
    windowEnd,
  });

  if (!cap) {
    return {
      capConfigured: false,
      usageCents,
      capCents: null,
      capExceeded: false,
      pausedNow: false,
      incidentId: null,
    };
  }

  const capExceeded = usageCents >= cap.capCents;
  if (!capExceeded) {
    return {
      capConfigured: true,
      usageCents,
      capCents: cap.capCents,
      capExceeded: false,
      pausedNow: false,
      incidentId: null,
    };
  }

  const existingIncident = await findOpenIncidentForWindow(db, {
    companyId: input.companyId,
    agentId: input.agentId,
    policyId: cap.policyId,
    windowStart,
  });
  if (existingIncident) {
    // Already recorded for this window — do nothing.
    return {
      capConfigured: true,
      usageCents,
      capCents: cap.capCents,
      capExceeded: true,
      pausedNow: false,
      incidentId: existingIncident.id,
    };
  }

  const [agent] = await db
    .select({ status: agents.status })
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.companyId, input.companyId)))
    .limit(1);

  const wasActive = !!agent && agent.status !== PAUSED_STATUS;

  // Insert incident first so we leave a paper trail even if the status flip
  // races with another writer.
  const [incident] = await db
    .insert(budgetIncidents)
    .values({
      companyId: input.companyId,
      policyId: cap.policyId,
      scopeType: AGENT_SCOPE,
      scopeId: input.agentId,
      metric: CREDIT_CAP_METRIC,
      windowKind: CREDIT_CAP_WINDOW,
      windowStart,
      windowEnd,
      thresholdType: "hard_stop",
      amountLimit: cap.capCents,
      amountObserved: usageCents,
      status: "open",
    })
    .returning({ id: budgetIncidents.id });

  if (wasActive) {
    await db
      .update(agents)
      .set({ status: PAUSED_STATUS, updatedAt: sql`now()` })
      .where(and(eq(agents.id, input.agentId), eq(agents.companyId, input.companyId)));
  }

  return {
    capConfigured: true,
    usageCents,
    capCents: cap.capCents,
    capExceeded: true,
    pausedNow: wasActive,
    incidentId: incident?.id ?? null,
  };
}

async function findOpenIncidentForWindow(
  db: Db,
  input: { companyId: string; agentId: string; policyId: string; windowStart: Date },
) {
  const [row] = await db
    .select({ id: budgetIncidents.id })
    .from(budgetIncidents)
    .where(
      and(
        eq(budgetIncidents.companyId, input.companyId),
        eq(budgetIncidents.policyId, input.policyId),
        eq(budgetIncidents.scopeId, input.agentId),
        eq(budgetIncidents.windowStart, input.windowStart),
        eq(budgetIncidents.status, "open"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export interface ResumePausedAgentsInput {
  readonly companyId?: string;
  /** Defaults to `new Date()`; injected for deterministic tests. */
  readonly asOf?: Date;
}

export interface ResumePausedAgentsResult {
  /** Agent IDs that were resumed (status flipped paused → idle). */
  readonly resumedAgentIds: readonly string[];
  /** Incident IDs that were marked resolved as part of the sweep. */
  readonly resolvedIncidentIds: readonly string[];
}

/**
 * Resume agents whose paused state was caused by the credit cap of a
 * previous month. For each open incident with `windowEnd <= asOf` and
 * `metric = credit_usage_cents`:
 *   - If the agent is currently paused AND the new month's usage is below
 *     the cap, flip status back to `idle` and mark the incident `resolved`.
 *   - If the agent is no longer paused (operator already resumed them),
 *     just mark the stale incident `resolved`.
 *
 * Safe to run on every cron tick — idempotent on already-resolved incidents.
 */
export async function resumePausedAgentsForNewMonth(
  db: Db,
  input: ResumePausedAgentsInput = {},
): Promise<ResumePausedAgentsResult> {
  const asOf = input.asOf ?? new Date();
  const currentMonthStart = monthStart(asOf);
  const currentMonthEnd = nextMonthStart(asOf);

  const conditions = [
    eq(budgetIncidents.metric, CREDIT_CAP_METRIC),
    eq(budgetIncidents.windowKind, CREDIT_CAP_WINDOW),
    eq(budgetIncidents.scopeType, AGENT_SCOPE),
    eq(budgetIncidents.status, "open"),
    lte(budgetIncidents.windowEnd, currentMonthStart),
  ];
  if (input.companyId) conditions.push(eq(budgetIncidents.companyId, input.companyId));

  const staleIncidents = await db
    .select({
      id: budgetIncidents.id,
      companyId: budgetIncidents.companyId,
      agentId: budgetIncidents.scopeId,
      policyId: budgetIncidents.policyId,
    })
    .from(budgetIncidents)
    .where(and(...conditions));

  const resumedAgentIds: string[] = [];
  const resolvedIncidentIds: string[] = [];

  for (const incident of staleIncidents) {
    const [agent] = await db
      .select({ status: agents.status })
      .from(agents)
      .where(eq(agents.id, incident.agentId))
      .limit(1);

    if (!agent) {
      // Agent gone (deleted). Resolve the incident defensively.
      await markIncidentResolved(db, incident.id);
      resolvedIncidentIds.push(incident.id);
      continue;
    }

    if (agent.status !== PAUSED_STATUS) {
      // Operator already resumed them — clear the stale incident.
      await markIncidentResolved(db, incident.id);
      resolvedIncidentIds.push(incident.id);
      continue;
    }

    // Re-check current-month usage vs the live cap (operators can edit caps).
    const currentCap = await getAgentMonthlyCap(db, {
      companyId: incident.companyId,
      agentId: incident.agentId,
    });
    const currentUsage = await getAgentUsageCentsInWindow(db, {
      companyId: incident.companyId,
      agentId: incident.agentId,
      windowStart: currentMonthStart,
      windowEnd: currentMonthEnd,
    });

    const stillCapped = currentCap !== null && currentUsage >= currentCap.capCents;
    if (stillCapped) {
      // New month already exhausted (rare, but possible) — keep paused,
      // do not mark the previous incident resolved.
      continue;
    }

    await db
      .update(agents)
      .set({ status: "idle", updatedAt: sql`now()` })
      .where(eq(agents.id, incident.agentId));
    await markIncidentResolved(db, incident.id);

    resumedAgentIds.push(incident.agentId);
    resolvedIncidentIds.push(incident.id);
  }

  return { resumedAgentIds, resolvedIncidentIds };
}

async function markIncidentResolved(db: Db, incidentId: string) {
  await db
    .update(budgetIncidents)
    .set({ status: "resolved", resolvedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(budgetIncidents.id, incidentId), isNull(budgetIncidents.resolvedAt)));
}
