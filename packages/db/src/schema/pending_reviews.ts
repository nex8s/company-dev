import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

/**
 * `pending_reviews` — the "X review waiting" queue shown in the company
 * sidebar. An agent submits a task (`issues` row) for human/CEO review;
 * the reviewer approves (task → `done`) or rejects (task → `todo`).
 *
 * status values: `pending` | `approved` | `rejected`
 */
export const pendingReviews = pgTable(
  "pending_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    submittedByAgentId: uuid("submitted_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    submissionNote: text("submission_note"),
    status: text("status").notNull().default("pending"),
    decidedByAgentId: uuid("decided_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    decidedByUserId: text("decided_by_user_id"),
    decisionNote: text("decision_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("pending_reviews_company_status_idx").on(table.companyId, table.status),
    issueIdx: index("pending_reviews_issue_idx").on(table.issueId),
  }),
);
