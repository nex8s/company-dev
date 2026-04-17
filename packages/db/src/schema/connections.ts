import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";

/**
 * `connections` — per-company OAuth/API connections to external tools
 * (B-14: Connect-tools integrations hub). The schema lives in packages/db
 * (not packages/plugin-connect-tools/src/schema.ts) because drizzle-kit's
 * generator only scans `packages/db/dist/schema/*.js`.
 *
 * `tool_kind` values (validated at the plugin layer): `notion` | `slack` |
 * `figma` | `github` | `linear` | `vercel`. Phase 2 will add provider-specific
 * extra columns; for now the JSONB `metadata` column carries everything else.
 *
 * Token storage note: tokens are written plain in this scaffold to keep the
 * gate criterion simple. The real OSS integration project (queued by the
 * orchestrator) will swap to the existing `company_secrets`/`company_secret_versions`
 * encryption pathway before any real OAuth scope is wired.
 */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    toolKind: text("tool_kind").notNull(),
    label: text("label").notNull(),
    token: text("token").notNull(),
    refreshToken: text("refresh_token"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("connections_company_idx").on(table.companyId),
    companyToolLabelUq: uniqueIndex("connections_company_tool_label_uq").on(
      table.companyId,
      table.toolKind,
      table.label,
    ),
  }),
);
