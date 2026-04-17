import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { apps } from "./apps.js";
import { companies } from "./companies.js";

/**
 * `app_deployments` — deployment history per App (B-03). Every call to
 * `buildApp` (B-02) writes one row here, so the Deployments tab can surface
 * a chronological list of URLs + states. Phase-2 real deployments (B-07 /
 * Vercel provider) will transition `status` from `succeeded` through a
 * richer lifecycle; today it's just `succeeded` at insert time because the
 * scaffold step is synchronous.
 *
 * `status` values: `pending` | `succeeded` | `failed`.
 */
export const appDeployments = pgTable(
  "app_deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    status: text("status").notNull().default("succeeded"),
    triggeredByAgentId: uuid("triggered_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    appIdx: index("app_deployments_app_idx").on(table.appId),
    companyIdx: index("app_deployments_company_idx").on(table.companyId),
  }),
);
