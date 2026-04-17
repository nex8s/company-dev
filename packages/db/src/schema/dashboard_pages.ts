import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `dashboard_pages` — Company.dev custom dashboard surface (A-08). Each row
 * is one page of a company-level dashboard, owned by `plugin-dashboards`.
 *
 * `layout` is a JSON widget blueprint — a list of widgets, each with a
 * `type` (revenue / ai-usage / team-status / task-kanban), a `params`
 * object (type-specific config, e.g. `windowDays`), and an optional
 * `position` for grid layout. The render endpoint reads the layout and
 * materializes a `data` payload per widget.
 */
export const dashboardPages = pgTable(
  "dashboard_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    layout: jsonb("layout").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("dashboard_pages_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
  }),
);
