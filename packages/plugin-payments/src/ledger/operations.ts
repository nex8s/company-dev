import { and, desc, eq, gte, lt, sql, sum, inArray } from "drizzle-orm";
import { type Db, creditLedger } from "@paperclipai/db";
import type { CreditLedgerEntry } from "../schema.js";

export interface RecordTopUpInput {
  readonly companyId: string;
  /** Always positive cents; throws if zero or negative. */
  readonly amountCents: number;
  /** Optional Stripe charge / external reference for idempotency tracking. */
  readonly externalRef?: string | null;
  readonly description?: string | null;
}

export interface RecordUsageInput {
  readonly companyId: string;
  readonly agentId: string;
  /** Always positive cents (usage is implied by entry_type='usage'). */
  readonly amountCents: number;
  readonly runId?: string | null;
  readonly description?: string | null;
}

export interface RecordRolloverInput {
  readonly companyId: string;
  readonly amountCents: number;
  readonly description?: string | null;
}

export interface RecordAdjustmentInput {
  readonly companyId: string;
  readonly amountCents: number;
  readonly agentId?: string | null;
  readonly description?: string | null;
  readonly externalRef?: string | null;
}

function assertPositiveAmount(amountCents: number, label: string) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`${label} amount_cents must be a positive integer; got ${amountCents}`);
  }
}

/**
 * Record a credit top-up (Stripe checkout success, manual grant, etc.).
 * Returns the inserted row. Top-ups are company-scoped (no agent_id).
 *
 * Idempotency: callers passing `externalRef` should first check
 * `findEntryByExternalRef` and skip the insert on a hit. Stripe webhook
 * delivery can replay; this function does not enforce uniqueness on
 * external_ref because adjustments may legitimately reuse a ref.
 */
export async function recordTopUp(
  db: Db,
  input: RecordTopUpInput,
): Promise<CreditLedgerEntry> {
  assertPositiveAmount(input.amountCents, "top_up");
  const [row] = await db
    .insert(creditLedger)
    .values({
      companyId: input.companyId,
      agentId: null,
      runId: null,
      entryType: "top_up",
      amountCents: input.amountCents,
      externalRef: input.externalRef ?? null,
      description: input.description ?? null,
    })
    .returning();
  return row!;
}

/**
 * Record an agent's credit usage. The amount is stored as a positive integer;
 * the entry_type='usage' marker tells the balance computation to subtract.
 */
export async function recordUsage(
  db: Db,
  input: RecordUsageInput,
): Promise<CreditLedgerEntry> {
  assertPositiveAmount(input.amountCents, "usage");
  const [row] = await db
    .insert(creditLedger)
    .values({
      companyId: input.companyId,
      agentId: input.agentId,
      runId: input.runId ?? null,
      entryType: "usage",
      amountCents: input.amountCents,
      description: input.description ?? null,
    })
    .returning();
  return row!;
}

/**
 * Record a month-rollover credit grant (e.g. unused subscription credits
 * carried into the next month). Company-scoped; positive amount.
 */
export async function recordRollover(
  db: Db,
  input: RecordRolloverInput,
): Promise<CreditLedgerEntry> {
  assertPositiveAmount(input.amountCents, "rollover");
  const [row] = await db
    .insert(creditLedger)
    .values({
      companyId: input.companyId,
      agentId: null,
      runId: null,
      entryType: "rollover",
      amountCents: input.amountCents,
      description: input.description ?? null,
    })
    .returning();
  return row!;
}

/**
 * Record an operator-issued credit adjustment (support refund, clawback,
 * goodwill grant). Sign of the change is conveyed by the description; the
 * stored amount must be positive. For a clawback, write a description like
 * "clawback: ..." — the balance still increases, since adjustments are
 * net-positive in the formula. If you need a clawback to remove credit,
 * insert a `usage` entry instead with description prefixed `adjustment-clawback:`.
 */
export async function recordAdjustment(
  db: Db,
  input: RecordAdjustmentInput,
): Promise<CreditLedgerEntry> {
  assertPositiveAmount(input.amountCents, "adjustment");
  const [row] = await db
    .insert(creditLedger)
    .values({
      companyId: input.companyId,
      agentId: input.agentId ?? null,
      runId: null,
      entryType: "adjustment",
      amountCents: input.amountCents,
      description: input.description ?? null,
      externalRef: input.externalRef ?? null,
    })
    .returning();
  return row!;
}

/**
 * Net balance for a company: sum(top_up + adjustment + rollover) - sum(usage).
 * Returns 0 when the ledger is empty.
 */
export async function getCompanyBalanceCents(
  db: Db,
  companyId: string,
): Promise<number> {
  const result = await db
    .select({
      credits: sql<string | null>`COALESCE(SUM(CASE WHEN ${creditLedger.entryType} IN ('top_up','adjustment','rollover') THEN ${creditLedger.amountCents} ELSE 0 END), 0)`,
      debits: sql<string | null>`COALESCE(SUM(CASE WHEN ${creditLedger.entryType} = 'usage' THEN ${creditLedger.amountCents} ELSE 0 END), 0)`,
    })
    .from(creditLedger)
    .where(eq(creditLedger.companyId, companyId));
  const credits = Number(result[0]?.credits ?? 0);
  const debits = Number(result[0]?.debits ?? 0);
  return credits - debits;
}

/**
 * Sum of an agent's `usage` entries within `[windowStart, windowEnd)`.
 * Returns 0 when no usage exists in the window.
 */
export async function getAgentUsageCentsInWindow(
  db: Db,
  input: {
    companyId: string;
    agentId: string;
    windowStart: Date;
    windowEnd: Date;
  },
): Promise<number> {
  const result = await db
    .select({
      total: sum(creditLedger.amountCents).mapWith(Number),
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.companyId, input.companyId),
        eq(creditLedger.agentId, input.agentId),
        eq(creditLedger.entryType, "usage"),
        gte(creditLedger.createdAt, input.windowStart),
        lt(creditLedger.createdAt, input.windowEnd),
      ),
    );
  return Number(result[0]?.total ?? 0);
}

/** UTC start-of-month for the date provided. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

/** Start of the month after the given date (exclusive upper bound). */
export function nextMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/** Look up the most-recent ledger entry for a company. Useful for tests / inspectors. */
export async function listRecentEntries(
  db: Db,
  companyId: string,
  limit = 50,
): Promise<CreditLedgerEntry[]> {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.companyId, companyId))
    .orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
    .limit(limit);
}

/** Find an entry by externalRef across allowed entry types. Used for Stripe webhook idempotency. */
export async function findEntryByExternalRef(
  db: Db,
  input: { companyId: string; externalRef: string; entryTypes?: ReadonlyArray<"top_up" | "adjustment"> },
): Promise<CreditLedgerEntry | null> {
  const types = input.entryTypes ?? (["top_up", "adjustment"] as const);
  const [row] = await db
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.companyId, input.companyId),
        eq(creditLedger.externalRef, input.externalRef),
        inArray(creditLedger.entryType, [...types]),
      ),
    )
    .limit(1);
  return row ?? null;
}
