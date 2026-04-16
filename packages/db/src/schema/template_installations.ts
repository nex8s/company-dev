import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const templateInstallations = pgTable(
  "template_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateSlug: text("template_slug").notNull(),
    templateKind: text("template_kind").notNull(),
    skills: jsonb("skills").notNull().default([]),
    employees: jsonb("employees").notNull().default([]),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("template_installations_company_uq").on(table.companyId),
    templateSlugIdx: index("template_installations_template_slug_idx").on(table.templateSlug),
  }),
);
