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

// TODO(A-08): swap each of these for `useQuery` against the lifecycle
// widget payload endpoint. Today the structure is the same shape the
// real query returns, so the kanban renders without a refactor.
const STUB_IN_PROGRESS: readonly KanbanCard[] = [];
const STUB_QUEUED: readonly KanbanCard[] = [
  {
    id: "stub-task-1",
    kind: "task",
    title: "Build company x landing page",
    identifier: "COMPANY-4",
    assigneeLabel: "Landing Page Engineer",
    reviewId: null,
  },
  {
    id: "stub-task-2",
    kind: "task",
    title: "Create GTM Plan for company x",
    identifier: "COMPANY-2",
    assigneeLabel: "Growth Marketer",
    reviewId: null,
  },
  {
    id: "stub-task-3",
    kind: "task",
    title: "Write First Blog Post",
    identifier: "COMPANY-3",
    assigneeLabel: "Growth Marketer",
    reviewId: null,
  },
];
const STUB_COMPLETED: readonly KanbanCard[] = [];

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
      cards: STUB_IN_PROGRESS,
      isStub: true,
      isLoading: false,
      error: null,
    },
    {
      id: "queued",
      cards: STUB_QUEUED,
      isStub: true,
      isLoading: false,
      error: null,
    },
    {
      id: "completed",
      cards: STUB_COMPLETED,
      isStub: true,
      isLoading: false,
      error: null,
    },
  ];

  return {
    columns,
    approveReview,
    rejectReview,
  };
}
