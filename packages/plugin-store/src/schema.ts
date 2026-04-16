import { pgTable, uuid, text, jsonb, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { templateInstallations } from "@paperclipai/db";

export { templateInstallations };

export type TemplateInstallationRow = typeof templateInstallations.$inferSelect;
export type NewTemplateInstallationRow = typeof templateInstallations.$inferInsert;

export const storeTemplates = pgTable(
  "store_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    summary: text("summary").notNull(),
    skills: jsonb("skills").notNull().default([]),
    employees: jsonb("employees").notNull().default([]),
    creator: text("creator").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storeTemplatesSlugIdx: uniqueIndex("store_templates_slug_idx").on(table.slug),
  }),
);

export type StoreTemplateRow = typeof storeTemplates.$inferSelect;
export type NewStoreTemplateRow = typeof storeTemplates.$inferInsert;
