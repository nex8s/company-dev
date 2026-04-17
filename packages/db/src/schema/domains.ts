import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";

/**
 * `domains` — per-company custom domains (B-15: Domains management). The
 * schema lives in packages/db (not packages/plugin-identity/src/schema.ts)
 * because drizzle-kit's generator only scans `packages/db/dist/schema/*.js`.
 *
 * `status` values: `pending` | `verified` | `failed` | `stub` (matches the
 * EmailProvider's `DomainRegistrationStatus`). The B-11 MockEmailProvider
 * always returns `stub`; real providers (Resend / Postmark) will graduate
 * the status as DNS verification completes.
 *
 * Default-domain invariant: at most one row per `company_id` may have
 * `is_default = true`. Enforced at the application layer in `setDefaultDomain`
 * (transactional clear-then-set), since drizzle-orm's pg-core uniqueIndex
 * doesn't accept a `WHERE` predicate in this codebase's pinned version.
 */
export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    status: text("status").notNull().default("pending"),
    dnsRecords: jsonb("dns_records")
      .$type<Array<{ type: "CNAME" | "TXT" | "MX"; host: string; value: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("domains_company_idx").on(table.companyId),
    companyDomainUq: uniqueIndex("domains_company_domain_uq").on(
      table.companyId,
      table.domain,
    ),
  }),
);
