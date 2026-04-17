import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { apps } from "./apps.js";
import { companies } from "./companies.js";

/**
 * `app_files` — per-App file tree persisted by the B-02 builder worker.
 * One row = one file at a given path inside `apps/<app_id>/`. A unique index
 * on `(app_id, path)` enforces the "latest version wins" semantic; B-03 may
 * graduate this to an append-only history table, but the scaffolding only
 * needs current-state lookups.
 *
 * Path convention: the worker writes paths rooted at `apps/<app_id>/` and the
 * DB stores the path verbatim (including the `apps/<app_id>/` prefix). This
 * keeps file paths self-contained and makes file-tree serialization (B-03) a
 * plain `SELECT path, ...` without additional joins.
 */
export const appFiles = pgTable(
  "app_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    appIdx: index("app_files_app_idx").on(table.appId),
    companyIdx: index("app_files_company_idx").on(table.companyId),
    appPathUq: uniqueIndex("app_files_app_path_uq").on(table.appId, table.path),
  }),
);
