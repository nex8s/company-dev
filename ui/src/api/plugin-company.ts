import { api } from "./client";

/**
 * Typed client for the `@paperclipai/plugin-company` HTTP routes mounted by
 * `server/src/routes/plugin-company.ts`. Endpoints are documented in
 * `packages/plugin-company/src/server/router.ts` (A-06.5).
 *
 * Wire shapes are duplicated here rather than imported from the plugin
 * package because the plugin's runtime types pull in drizzle / Postgres
 * types that don't belong in the browser bundle. Any drift will be caught
 * by the plugin-company contract tests on the server side.
 */

/**
 * Mirror of `pendingReviews` columns (packages/db/src/schema/pending_reviews.ts).
 * Only the fields the kanban actually needs are typed; the API returns the
 * full row so a future column addition won't break this client.
 */
export interface PendingReviewRow {
  readonly id: string;
  readonly companyId: string;
  readonly issueId: string;
  readonly submittedByAgentId: string | null;
  readonly submissionNote: string | null;
  readonly status: "pending" | "approved" | "rejected";
  readonly submittedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirror of `issues` columns — same caveats as PendingReviewRow. */
export interface PendingReviewIssue {
  readonly id: string;
  readonly companyId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly assigneeAgentId: string | null;
  readonly assigneeUserId: string | null;
  readonly identifier: string | null;
  readonly issueNumber: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PendingReviewWithIssue {
  readonly review: PendingReviewRow;
  readonly issue: PendingReviewIssue;
}

export interface ListPendingReviewsResponse {
  readonly reviews: readonly PendingReviewWithIssue[];
}

export interface DecideReviewResponse {
  readonly review: PendingReviewRow;
}

export const pluginCompanyApi = {
  listPendingReviews: (companyId: string) =>
    api.get<ListPendingReviewsResponse>(
      `/companies/${companyId}/plugin-company/reviews/pending`,
    ),

  approveReview: (
    companyId: string,
    reviewId: string,
    body: { decisionNote?: string | null } = {},
  ) =>
    api.post<DecideReviewResponse>(
      `/companies/${companyId}/plugin-company/reviews/${reviewId}/approve`,
      body,
    ),

  rejectReview: (
    companyId: string,
    reviewId: string,
    body: { decisionNote?: string | null } = {},
  ) =>
    api.post<DecideReviewResponse>(
      `/companies/${companyId}/plugin-company/reviews/${reviewId}/reject`,
      body,
    ),
};
