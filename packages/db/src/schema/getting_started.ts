import { pgTable, uuid, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `getting_started` — per-company progress for the 7-step onboarding
 * checklist (incorporate, domain, email_inboxes, stripe_billing,
 * deploy_first_app, google_search_console, custom_dashboard_pages).
 *
 * One row per company. The `steps` jsonb is a map of step key →
 * `{ completedAt: string | null }`. Step keys not present are treated as
 * not-yet-completed. Step-key validation is enforced in the plugin layer.
 */
export type GettingStartedStepsJson = Record<string, { completedAt: string | null }>;

export const gettingStarted = pgTable(
  "getting_started",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    steps: jsonb("steps").$type<GettingStartedStepsJson>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("getting_started_company_uq").on(table.companyId),
  }),
);
