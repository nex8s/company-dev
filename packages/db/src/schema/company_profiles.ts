import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `company_profiles` — Company.dev domain profile attached 1:1 to a Paperclip
 * `companies` row. Lives in packages/db (not packages/plugin-company/src/schema.ts)
 * because drizzle-kit's generator only scans `packages/db/dist/schema/*.js`.
 * The plugin-company package re-exports this table so feature code imports it
 * from `@paperclipai/plugin-company` rather than from `@paperclipai/db` directly.
 *
 * trial_state values: `trial` | `active` | `expired` | `paused`
 */
export const companyProfiles = pgTable(
  "company_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    positioning: text("positioning"),
    targetAudience: text("target_audience"),
    strategyText: text("strategy_text"),
    incorporated: boolean("incorporated").notNull().default(false),
    logoUrl: text("logo_url"),
    trialState: text("trial_state").notNull().default("trial"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("company_profiles_company_uq").on(table.companyId),
    trialStateIdx: index("company_profiles_trial_state_idx").on(table.trialState),
  }),
);
