import { and, eq, sql } from "drizzle-orm";
import { type Db, issues, pendingReviews } from "@paperclipai/db";

export type PendingReviewStatus = "pending" | "approved" | "rejected";

/** Issue status the task moves into when submitted for review. */
export const ISSUE_STATUS_IN_REVIEW = "in_review";
/** Issue status on approval (the review cleared, work is done). */
export const ISSUE_STATUS_APPROVED = "done";
/** Issue status on rejection (the work bounces back to the active backlog). */
export const ISSUE_STATUS_REJECTED = "todo";

export type PendingReview = typeof pendingReviews.$inferSelect;
export type Issue = typeof issues.$inferSelect;

export interface PendingReviewWithIssue {
  readonly review: PendingReview;
  readonly issue: Issue;
}

export interface SubmitForReviewInput {
  companyId: string;
  issueId: string;
  submittedByAgentId?: string | null;
  submissionNote?: string | null;
}

export interface DecideInput {
  reviewId: string;
  decidedByAgentId?: string | null;
  decidedByUserId?: string | null;
  decisionNote?: string | null;
}

/**
 * Submit a task (issue) for review. Creates a pending_reviews row and flips
 * the issue's status to `in_review`. The caller is responsible for making
 * sure the issue actually belongs to the given company.
 */
export async function submitForReview(
  db: Db,
  input: SubmitForReviewInput,
): Promise<PendingReview> {
  const [row] = await db
    .insert(pendingReviews)
    .values({
      companyId: input.companyId,
      issueId: input.issueId,
      submittedByAgentId: input.submittedByAgentId ?? null,
      submissionNote: input.submissionNote ?? null,
      status: "pending",
    })
    .returning();

  await db
    .update(issues)
    .set({ status: ISSUE_STATUS_IN_REVIEW, updatedAt: sql`now()` })
    .where(eq(issues.id, input.issueId));

  return row;
}

/**
 * List all reviews in the `pending` state for a company, alongside the
 * underlying issue. Approved / rejected reviews are excluded — that is
 * what "approve removes it" means per the gate.
 */
export async function listPendingReviews(
  db: Db,
  companyId: string,
): Promise<PendingReviewWithIssue[]> {
  const rows = await db
    .select({
      review: pendingReviews,
      issue: issues,
    })
    .from(pendingReviews)
    .innerJoin(issues, eq(issues.id, pendingReviews.issueId))
    .where(
      and(eq(pendingReviews.companyId, companyId), eq(pendingReviews.status, "pending")),
    );
  return rows;
}

async function decide(
  db: Db,
  input: DecideInput,
  nextReviewStatus: PendingReviewStatus,
  nextIssueStatus: string,
): Promise<PendingReview> {
  const [review] = await db
    .update(pendingReviews)
    .set({
      status: nextReviewStatus,
      decidedByAgentId: input.decidedByAgentId ?? null,
      decidedByUserId: input.decidedByUserId ?? null,
      decisionNote: input.decisionNote ?? null,
      decidedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(pendingReviews.id, input.reviewId), eq(pendingReviews.status, "pending")))
    .returning();

  if (!review) {
    throw new Error(
      `pending review ${input.reviewId} not found or already decided — only pending reviews can be ${nextReviewStatus}`,
    );
  }

  await db
    .update(issues)
    .set({ status: nextIssueStatus, updatedAt: sql`now()` })
    .where(eq(issues.id, review.issueId));

  return review;
}

/**
 * Approve a pending review — removes it from `listPendingReviews` and flips
 * the underlying issue status to `done`. Throws if the review is not in
 * the `pending` state.
 */
export async function approveReview(db: Db, input: DecideInput): Promise<PendingReview> {
  return decide(db, input, "approved", ISSUE_STATUS_APPROVED);
}

/**
 * Reject a pending review — removes it from `listPendingReviews` and flips
 * the underlying issue status to `todo` so the work re-enters the active
 * backlog. Throws if the review is not in the `pending` state.
 */
export async function rejectReview(db: Db, input: DecideInput): Promise<PendingReview> {
  return decide(db, input, "rejected", ISSUE_STATUS_REJECTED);
}
