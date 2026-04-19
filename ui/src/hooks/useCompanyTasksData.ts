import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import {
  pluginCompanyApi,
  type PendingReviewWithIssue,
} from "@/api/plugin-company";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Single-hook facade for the C-06 Tasks kanban (Needs Review / In Progress
 * / Queued / Completed). Needs Review is wired live to A-06.5's
 * `GET /api/companies/:companyId/plugin-company/reviews/pending`. The
 * other three columns return typed mock stubs flagged with their A-task
 * — the agent / engineer reading this file can see at a glance that the
 * stubs are intentional (not "TODO somebody port me"). When A-08 ships
 * the task-lifecycle widget payloads, swap each stub for its useQuery.
 */

/**
 * Card rendered inside a kanban column. Compact projection of either a
 * pending-review row or a task row — enough for the prototype card layout
 * without leaking storage shapes into the component tree.
 */
export interface KanbanCard {
  readonly id: string;
  /** Stable kind so the column knows which actions to render. */
  readonly kind: "review" | "task";
  readonly title: string;
  readonly identifier: string | null;
  readonly assigneeLabel: string | null;
  /**
   * Underlying review id — only present when kind === "review". Required
   * to wire the Approve / Reject buttons to the decide endpoints.
   */
  readonly reviewId: string | null;
}

export interface KanbanColumn {
  readonly id: "needsReview" | "inProgress" | "queued" | "completed";
  readonly cards: readonly KanbanCard[];
  /**
   * `true` when this column's data is a typed mock stub waiting on a
   * future task. Drives the "stub · A-08" badge in the column header.
   */
  readonly isStub: boolean;
  /** Per-column loading state — only NeedsReview will be true today. */
  readonly isLoading: boolean;
  /** Per-column error state — same. */
  readonly error: Error | null;
}

export interface CompanyTasksData {
  readonly columns: readonly KanbanColumn[];
  readonly approveReview: UseMutationResult<unknown, ApiError, { reviewId: string }>;
  readonly rejectReview: UseMutationResult<unknown, ApiError, { reviewId: string }>;
}

/**
 * Map a PendingReviewWithIssue (server wire shape) into the compact
 * KanbanCard the column renders. Pure function — extracted for the unit
 * tests in Tasks.test.tsx so we don't need to drive the hook to assert
 * the projection.
 */
export function reviewToCard(row: PendingReviewWithIssue): KanbanCard {
  const assigneeLabel =
    row.review.submittedByAgentId !== null
      ? // Display name lookup ships when A-03 / A-06 agent-directory is
        // exposed via HTTP; until then the agent id is the only stable
        // handle we have. Truncating to 8 chars keeps the card readable.
        `agent ${row.review.submittedByAgentId.slice(0, 8)}`
      : null;
  return {
    id: row.review.id,
    kind: "review",
    title: row.issue.title,
    identifier: row.issue.identifier,
    assigneeLabel,
    reviewId: row.review.id,
  };
}

function issueToCard(issue: any): KanbanCard {
  return {
    id: issue.id,
    kind: "task",
    title: issue.title || "Untitled",
    identifier: issue.identifier || null,
    assigneeLabel: issue.assigneeName || issue.assigneeAgentId?.slice(0, 8) || null,
    reviewId: null,
  };
}

export function useCompanyTasksData(companyId: string): CompanyTasksData {
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: queryKeys.pluginCompany.pendingReviews(companyId),
    queryFn: () => pluginCompanyApi.listPendingReviews(companyId),
    // Empty companyId means we're not actually scoped to a company yet —
    // skip the request rather than fire it with an invalid path.
    enabled: companyId.length > 0,
    // Reviews are a moving target. 5s staleTime + refetch on window focus
    // is a reasonable starting cadence for the kanban; tune in C-13 once
    // we have real-load data.
    staleTime: 5_000,
  });

  const decideOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pluginCompany.pendingReviews(companyId),
      });
    },
  };

  const approveReview = useMutation<unknown, ApiError, { reviewId: string }>({
    mutationFn: ({ reviewId }) => pluginCompanyApi.approveReview(companyId, reviewId),
    ...decideOptions,
  });
  const rejectReview = useMutation<unknown, ApiError, { reviewId: string }>({
    mutationFn: ({ reviewId }) => pluginCompanyApi.rejectReview(companyId, reviewId),
    ...decideOptions,
  });

  // Fetch all issues for this company and categorize by status
  const issuesQuery = useQuery({
    queryKey: ["company-issues", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/issues?limit=100`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: companyId.length > 0,
    staleTime: 5_000,
  });

  const allIssues: any[] = issuesQuery.data ?? [];
  const inProgressCards = allIssues.filter((i) => i.status === "in_progress").map(issueToCard);
  const queuedCards = allIssues.filter((i) => i.status === "backlog" || i.status === "todo").map(issueToCard);
  const completedCards = allIssues.filter((i) => i.status === "done").map(issueToCard);

  const reviewCards =
    reviewsQuery.data?.reviews.map(reviewToCard) ?? [];

  const columns: KanbanColumn[] = [
    {
      id: "needsReview",
      cards: reviewCards,
      isStub: false,
      isLoading: reviewsQuery.isLoading,
      error: (reviewsQuery.error as Error | null) ?? null,
    },
    {
      id: "inProgress",
      cards: inProgressCards,
      isStub: false,
      isLoading: issuesQuery.isLoading,
      error: null,
    },
    {
      id: "queued",
      cards: queuedCards,
      isStub: false,
      isLoading: issuesQuery.isLoading,
      error: null,
    },
    {
      id: "completed",
      cards: completedCards,
      isStub: false,
      isLoading: issuesQuery.isLoading,
      error: null,
    },
  ];

  return {
    columns,
    approveReview,
    rejectReview,
  };
}
