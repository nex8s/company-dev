import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";

/**
 * `apps` — per-company Apps launched by the apps-builder plugin (B-01 schema,
 * B-02 persistence). Previously lived under packages/plugin-apps-builder/src/
 * but was never migrated because drizzle-kit's generator only scans
 * `packages/db/dist/schema/*.js`; the plugin re-exports this table from
 * `@paperclipai/plugin-apps-builder` so consumers keep importing from the
 * plugin rather than reaching into @paperclipai/db.
 */
export const apps = pgTable(
  "apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channelId: uuid("channel_id"),
    connections: jsonb("connections").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    envVars: jsonb("env_vars").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    productionDomain: text("production_domain"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("apps_company_idx").on(table.companyId),
  }),
);
