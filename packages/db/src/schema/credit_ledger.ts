import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

/**
 * `credit_ledger` — append-only ledger for the Company.dev credits system
 * (A-07). Each row is one credit movement. Owned by `plugin-payments`;
 * declared here because drizzle-kit only scans `packages/db/dist/schema/*`.
 *
 * `amount_cents` is always non-negative. The sign is implied by `entry_type`:
 *   - `top_up`     credit added (Stripe checkout, manual grant)
 *   - `adjustment` credit added or removed via support action; signed via amount_cents (always +; back out negatives via a separate `entry_type` if needed)
 *   - `rollover`   credit carried into a new month; positive
 *   - `usage`      credit consumed by an agent run; debited from balance
 *
 * Balance = sum(top_up + adjustment + rollover) - sum(usage).
 *
 * `agent_id` is nullable (top-ups and rollovers are company-scoped).
 * `run_id` is nullable (usage entries record the originating heartbeat run
 * when known; manual adjustments leave it null).
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    entryType: text("entry_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("credit_ledger_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    companyAgentCreatedIdx: index("credit_ledger_company_agent_created_idx").on(
      table.companyId,
      table.agentId,
      table.createdAt,
    ),
    companyEntryTypeIdx: index("credit_ledger_company_entry_type_idx").on(
      table.companyId,
      table.entryType,
    ),
  }),
);
