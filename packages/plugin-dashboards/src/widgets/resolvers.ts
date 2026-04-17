import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { type Db, agents, creditLedger, issues } from "@paperclipai/db";
import {
  AGENT_STATUSES,
  type AgentStatus,
  ISSUE_STATUSES,
  type IssueStatus,
} from "@paperclipai/shared";
import type {
  DashboardWidget,
  DashboardWidgetType,
} from "../schema.js";

export interface WidgetDataEnvelope {
  readonly id: string;
  readonly type: DashboardWidgetType;
  readonly title?: string;
  readonly position?: DashboardWidget["position"];
  readonly params?: Record<string, unknown>;
  readonly data: unknown;
  readonly error?: string;
}

export interface ResolveContext {
  readonly db: Db;
  readonly companyId: string;
  /** Defaults to `new Date()`; injected for deterministic tests. */
  readonly asOf?: Date;
}

/**
 * Render-data for a full dashboard page: resolve each widget in the layout
 * in parallel and return a flat list of `{ id, type, data }` envelopes.
 * A failing widget does not fail the whole render — its envelope carries
 * `error: <message>` and `data: null`.
 */
export async function resolveWidgets(
  ctx: ResolveContext,
  widgets: readonly DashboardWidget[],
): Promise<WidgetDataEnvelope[]> {
  const results = await Promise.all(
    widgets.map((w) => resolveSingle(ctx, w).catch((err): WidgetDataEnvelope => ({
      id: w.id,
      type: w.type,
      title: w.title,
      position: w.position,
      params: w.params,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    }))),
  );
  return results;
}

async function resolveSingle(
  ctx: ResolveContext,
  widget: DashboardWidget,
): Promise<WidgetDataEnvelope> {
  const base = {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    position: widget.position,
    params: widget.params,
  };
  switch (widget.type) {
    case "revenue":
      return { ...base, data: await resolveRevenue(ctx, widget) };
    case "ai-usage":
      return { ...base, data: await resolveAiUsage(ctx, widget) };
    case "team-status":
      return { ...base, data: await resolveTeamStatus(ctx, widget) };
    case "task-kanban":
      return { ...base, data: await resolveTaskKanban(ctx, widget) };
  }
}

// ---------------------------------------------------------------------------
// revenue — stub until B-07 lands Stripe.
// ---------------------------------------------------------------------------

interface RevenueWidgetData {
  readonly provider: "stripe";
  readonly status: "stubbed";
  readonly monthCents: number;
  readonly subscriptions: number;
  readonly note: string;
}

async function resolveRevenue(
  _ctx: ResolveContext,
  _widget: DashboardWidget,
): Promise<RevenueWidgetData> {
  return {
    provider: "stripe",
    status: "stubbed",
    monthCents: 0,
    subscriptions: 0,
    note: "Stripe integration lands in B-07; revenue widget returns a stub payload for now.",
  };
}

// ---------------------------------------------------------------------------
// ai-usage — credit_ledger usage in a rolling window.
// ---------------------------------------------------------------------------

interface AiUsageWidgetData {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly totalUsageCents: number;
  readonly byAgent: ReadonlyArray<{
    readonly agentId: string | null;
    readonly agentName: string | null;
    readonly usageCents: number;
  }>;
}

async function resolveAiUsage(
  ctx: ResolveContext,
  widget: DashboardWidget,
): Promise<AiUsageWidgetData> {
  const asOf = ctx.asOf ?? new Date();
  const windowDays = readPositiveInt(widget.params?.windowDays) ?? 30;
  const windowEnd = asOf;
  const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await ctx.db
    .select({
      agentId: creditLedger.agentId,
      agentName: agents.name,
      usage: sql<string | null>`COALESCE(SUM(${creditLedger.amountCents}), 0)`,
    })
    .from(creditLedger)
    .leftJoin(agents, eq(agents.id, creditLedger.agentId))
    .where(
      and(
        eq(creditLedger.companyId, ctx.companyId),
        eq(creditLedger.entryType, "usage"),
        gte(creditLedger.createdAt, windowStart),
        lt(creditLedger.createdAt, windowEnd),
      ),
    )
    .groupBy(creditLedger.agentId, agents.name);

  const byAgent = rows
    .map((r) => ({
      agentId: r.agentId,
      agentName: r.agentName,
      usageCents: Number(r.usage ?? 0),
    }))
    .sort((a, b) => b.usageCents - a.usageCents);
  const total = byAgent.reduce((acc, r) => acc + r.usageCents, 0);

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalUsageCents: total,
    byAgent,
  };
}

// ---------------------------------------------------------------------------
// team-status — agents grouped by status.
// ---------------------------------------------------------------------------

interface TeamStatusWidgetData {
  readonly totalAgents: number;
  readonly statusCounts: Readonly<Record<AgentStatus, number>>;
  readonly agents: ReadonlyArray<{
    readonly agentId: string;
    readonly name: string;
    readonly status: AgentStatus;
  }>;
}

async function resolveTeamStatus(
  ctx: ResolveContext,
  _widget: DashboardWidget,
): Promise<TeamStatusWidgetData> {
  const rows = await ctx.db
    .select({ id: agents.id, name: agents.name, status: agents.status })
    .from(agents)
    .where(eq(agents.companyId, ctx.companyId))
    .orderBy(agents.name);

  const counts: Record<AgentStatus, number> = AGENT_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<AgentStatus, number>,
  );
  for (const row of rows) {
    if ((AGENT_STATUSES as readonly string[]).includes(row.status)) {
      counts[row.status as AgentStatus] += 1;
    }
  }

  return {
    totalAgents: rows.length,
    statusCounts: counts,
    agents: rows.map((r) => ({
      agentId: r.id,
      name: r.name,
      status: r.status as AgentStatus,
    })),
  };
}

// ---------------------------------------------------------------------------
// task-kanban — issues grouped by status.
// ---------------------------------------------------------------------------

interface TaskKanbanWidgetData {
  readonly columns: Readonly<
    Record<IssueStatus, ReadonlyArray<{ readonly id: string; readonly title: string }>>
  >;
  readonly totalIssues: number;
}

async function resolveTaskKanban(
  ctx: ResolveContext,
  widget: DashboardWidget,
): Promise<TaskKanbanWidgetData> {
  const limitPerColumn = readPositiveInt(widget.params?.limitPerColumn) ?? 50;

  const rows = await ctx.db
    .select({ id: issues.id, title: issues.title, status: issues.status })
    .from(issues)
    .where(eq(issues.companyId, ctx.companyId))
    .orderBy(desc(issues.updatedAt), desc(issues.id));

  const columns = ISSUE_STATUSES.reduce(
    (acc, s) => {
      acc[s] = [];
      return acc;
    },
    {} as Record<IssueStatus, Array<{ id: string; title: string }>>,
  );
  for (const row of rows) {
    const key = row.status as IssueStatus;
    if (!(ISSUE_STATUSES as readonly string[]).includes(row.status)) continue;
    const bucket = columns[key];
    if (bucket.length < limitPerColumn) bucket.push({ id: row.id, title: row.title });
  }

  return {
    columns,
    totalIssues: rows.length,
  };
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}
