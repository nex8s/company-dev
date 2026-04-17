import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { creditLedger, type Db } from "@paperclipai/db";
import type { CreditLedgerEntry } from "../schema.js";
import { monthStart, nextMonthStart } from "../ledger/operations.js";

/**
 * Per-agent usage breakdown for the Usage tab (B-08). Aggregates `usage`
 * entries between `windowStart` (inclusive) and `windowEnd` (exclusive),
 * grouped by `agent_id`. Returns one row per agent that has *any* usage in
 * the window; agents with zero usage are omitted (the UI's "no usage yet"
 * empty state covers them).
 */
export interface AgentUsageRow {
  readonly agentId: string;
  readonly usageCents: number;
  readonly entryCount: number;
}

export async function listUsageBreakdownByAgent(
  db: Db,
  input: { companyId: string; windowStart: Date; windowEnd: Date },
): Promise<AgentUsageRow[]> {
  const rows = await db
    .select({
      agentId: creditLedger.agentId,
      usageCents: sql<string>`coalesce(sum(${creditLedger.amountCents}), 0)`.as("usage_cents"),
      entryCount: sql<string>`count(*)`.as("entry_count"),
    })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.companyId, input.companyId),
        eq(creditLedger.entryType, "usage"),
        gte(creditLedger.createdAt, input.windowStart),
        lte(creditLedger.createdAt, input.windowEnd),
      ),
    )
    .groupBy(creditLedger.agentId)
    .orderBy(desc(sql`usage_cents`));

  return rows
    .filter((r) => r.agentId !== null)
    .map((r) => ({
      agentId: r.agentId as string,
      usageCents: Number(r.usageCents),
      entryCount: Number(r.entryCount),
    }));
}

/**
 * Recent ledger entries for the "transaction history" surface in the Usage
 * tab. Returns rows newest-first, capped at `limit`; the UI paginates by
 * passing `before` (the createdAt of the last row of the previous page).
 */
export interface ListTransactionHistoryInput {
  companyId: string;
  limit?: number;
  before?: Date;
}

export async function listTransactionHistory(
  db: Db,
  input: ListTransactionHistoryInput,
): Promise<CreditLedgerEntry[]> {
  const limit = Math.min(Math.max(1, input.limit ?? 50), 200);
  const where = input.before
    ? and(
        eq(creditLedger.companyId, input.companyId),
        lt(creditLedger.createdAt, input.before),
      )
    : eq(creditLedger.companyId, input.companyId);
  return db
    .select()
    .from(creditLedger)
    .where(where)
    .orderBy(desc(creditLedger.createdAt), asc(creditLedger.id))
    .limit(limit);
}

/**
 * Convenience: derive the "this month" window for the breakdown endpoint.
 * Uses the same `monthStart` / `nextMonthStart` helpers A-07 ships so the
 * window aligns with budget cap enforcement.
 */
export function currentMonthWindow(now: Date): { windowStart: Date; windowEnd: Date } {
  return { windowStart: monthStart(now), windowEnd: nextMonthStart(now) };
}
