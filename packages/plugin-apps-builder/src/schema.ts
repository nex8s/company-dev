import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const apps = pgTable("apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  channelId: uuid("channel_id"),
  connections: jsonb("connections").notNull().default([]),
  envVars: jsonb("env_vars").notNull().default({}),
  productionDomain: text("production_domain"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppRow = typeof apps.$inferSelect;
export type NewAppRow = typeof apps.$inferInsert;
