/**
 * Company > Tasks (kanban) copy — user-facing strings for
 * `ui/src/pages/company-tabs/Tasks.tsx`.
 *
 * Column titles match the PLAN.md / FEATURE_MAPPING.md spec
 * "Needs Review / In Progress / Queued / Completed". Approve / Reject
 * action labels mirror the review-pill in the company shell so the
 * voice stays consistent.
 */

export const companyTasks = {
  header: {
    title: "Tasks",
    filters: {
      all: "All",
      active: "Active",
      backlog: "Backlog",
      done: "Done",
    },
    newTaskCta: "New Task",
  },

  columns: {
    needsReview: "Needs Review",
    inProgress: "In Progress",
    queued: "Queued",
    completed: "Completed",
  },

  card: {
    forReviewBadge: "For Review",
    approveCta: "✓ Approve",
    rejectCta: "✕ Reject",
    decisionPending: "Deciding…",
  },

  emptyColumn: {
    needsReview: "Nothing waiting for review.",
    inProgress: "No tasks in progress.",
    queued: "Nothing queued.",
    completed: "No completed tasks yet.",
  },

  loading: "Loading reviews…",
  error: "Couldn't load reviews.",

  // Banner shown above non-NeedsReview columns until A-08 ships the
  // task-lifecycle widget payloads. Helps reviewers and agents understand
  // the difference between live + stub data at a glance.
  stubBadge: "stub · A-08",
} as const;

export type CompanyTasksCopy = typeof companyTasks;
