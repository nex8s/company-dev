// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyTasks as copy } from "@/copy/company-tasks";
import { reviewToCard } from "@/hooks/useCompanyTasksData";
import type { PendingReviewWithIssue } from "@/api/plugin-company";
import { CompanyTasks } from "./Tasks";

/**
 * C-06 gate: 4-column kanban renders, NeedsReview hits A-06.5's pending
 * reviews endpoint via fetch, Approve / Reject post to the decide
 * endpoints and invalidate the list. Stub columns render the
 * "stub · A-08" badge so reviewers can tell at a glance which data is
 * live vs mock.
 */

vi.mock("@/lib/router", async () => {
  const rrd = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...rrd,
    Link: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
    useLocation: () => ({ pathname: "/c/company-x/tasks", search: "", hash: "" }),
    useNavigate: () => vi.fn(),
    useParams: () => ({ companyId: "company-x" }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function buildReview(overrides: Partial<PendingReviewWithIssue["review"]> = {}, issueOverrides: Partial<PendingReviewWithIssue["issue"]> = {}): PendingReviewWithIssue {
  const now = new Date().toISOString();
  return {
    review: {
      id: overrides.id ?? "review-1",
      companyId: "company-x",
      issueId: "issue-1",
      submittedByAgentId: "agent-12345678abcd",
      submissionNote: null,
      status: "pending",
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    issue: {
      id: "issue-1",
      companyId: "company-x",
      title: "Create Content Calendar",
      description: null,
      status: "in_review",
      priority: "medium",
      assigneeAgentId: null,
      assigneeUserId: null,
      identifier: "COMPANY-1",
      issueNumber: 1,
      createdAt: now,
      updatedAt: now,
      ...issueOverrides,
    },
  };
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function setupFetchMock() {
  const calls: FetchCall[] = [];
  const respond = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    if (url.endsWith("/reviews/pending") && (!init || !init.method || init.method === "GET")) {
      return new Response(JSON.stringify({ reviews: [buildReview()] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/reviews/") && url.endsWith("/approve")) {
      return new Response(
        JSON.stringify({ review: { id: "review-1", status: "approved" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/reviews/") && url.endsWith("/reject")) {
      return new Response(
        JSON.stringify({ review: { id: "review-1", status: "rejected" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "unexpected URL: " + url }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = respond as unknown as typeof fetch;
  return { calls, respond };
}

function renderTasks(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/c/company-x/tasks"]}>
          <Routes>
            <Route path="c/:companyId/tasks" element={<CompanyTasks />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return { root, queryClient };
}

function clickElement(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("CompanyTasks (C-06)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    container.remove();
  });

  it("renders the page with header (filter tabs + New Task) and 4 kanban columns", async () => {
    setupFetchMock();
    ({ root } = renderTasks(container));
    await flush();

    expect(container.querySelector('[data-testid="company-tasks"]')).toBeTruthy();
    const header = container.querySelector('[data-testid="tasks-header"]');
    expect(header).toBeTruthy();
    expect(header?.textContent).toContain(copy.header.filters.all);
    expect(header?.textContent).toContain(copy.header.filters.active);
    expect(header?.textContent).toContain(copy.header.filters.backlog);
    expect(header?.textContent).toContain(copy.header.filters.done);
    expect(header?.textContent).toContain(copy.header.newTaskCta);

    for (const id of ["needsReview", "inProgress", "queued", "completed"] as const) {
      expect(
        container.querySelector(`[data-testid="kanban-column-${id}"]`),
      ).toBeTruthy();
    }
  });

  it("badges the three stub columns with 'stub · A-08' but not Needs Review", async () => {
    setupFetchMock();
    ({ root } = renderTasks(container));
    await flush();

    expect(
      container.querySelector('[data-testid="stub-badge-needsReview"]'),
    ).toBeNull();
    for (const id of ["inProgress", "queued", "completed"] as const) {
      const badge = container.querySelector(`[data-testid="stub-badge-${id}"]`);
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toContain(copy.stubBadge);
    }
  });

  it("calls GET /companies/:id/plugin-company/reviews/pending on mount and renders the returned card", async () => {
    const { calls } = setupFetchMock();
    ({ root } = renderTasks(container));
    await flush(0);
    // React-Query queueMicrotask + fetch + state propagation
    await flush(20);

    const reviewCalls = calls.filter((c) => c.url.endsWith("/reviews/pending"));
    expect(reviewCalls.length).toBeGreaterThanOrEqual(1);
    expect(reviewCalls[0].url).toBe(
      "/api/companies/company-x/plugin-company/reviews/pending",
    );

    const card = container.querySelector('[data-testid="kanban-card-review-1"]');
    expect(card).toBeTruthy();
    expect(card?.getAttribute("data-card-kind")).toBe("review");
    expect(card?.textContent).toContain("Create Content Calendar");
    expect(card?.textContent).toContain("COMPANY-1");
    expect(card?.textContent).toContain(copy.card.forReviewBadge);
  });

  it("posts to /reviews/:id/approve and refetches the pending list when the Approve button is clicked", async () => {
    const { calls } = setupFetchMock();
    ({ root } = renderTasks(container));
    await flush(20);

    const approve = container.querySelector('[data-testid="approve-review-1"]');
    expect(approve).toBeTruthy();
    clickElement(approve!);
    await flush(20);

    const approveCalls = calls.filter((c) => c.url.endsWith("/approve"));
    expect(approveCalls.length).toBe(1);
    expect(approveCalls[0].url).toBe(
      "/api/companies/company-x/plugin-company/reviews/review-1/approve",
    );
    expect(approveCalls[0].init?.method).toBe("POST");
    // After invalidation the GET fires again — start of test = 1, after approve = 2.
    const reviewCalls = calls.filter((c) => c.url.endsWith("/reviews/pending"));
    expect(reviewCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("posts to /reviews/:id/reject when the Reject button is clicked", async () => {
    const { calls } = setupFetchMock();
    ({ root } = renderTasks(container));
    await flush(20);

    const reject = container.querySelector('[data-testid="reject-review-1"]');
    expect(reject).toBeTruthy();
    clickElement(reject!);
    await flush(20);

    const rejectCalls = calls.filter((c) => c.url.endsWith("/reject"));
    expect(rejectCalls.length).toBe(1);
    expect(rejectCalls[0].url).toBe(
      "/api/companies/company-x/plugin-company/reviews/review-1/reject",
    );
    expect(rejectCalls[0].init?.method).toBe("POST");
  });

  it("renders the queued stub-card list (3 cards) and shows no review actions on stub cards", async () => {
    setupFetchMock();
    ({ root } = renderTasks(container));
    await flush(20);

    const queued = container.querySelector(
      '[data-testid="kanban-column-queued"]',
    );
    const cards = queued?.querySelectorAll('[data-card-kind="task"]') ?? [];
    expect(cards.length).toBe(3);
    // Stub task cards must not render the Approve / Reject buttons.
    for (const c of Array.from(cards)) {
      expect(c.querySelector('[data-testid^="approve-"]')).toBeNull();
      expect(c.querySelector('[data-testid^="reject-"]')).toBeNull();
    }
  });

  it("falls back to the empty-column message when a column has no cards", async () => {
    setupFetchMock();
    ({ root } = renderTasks(container));
    await flush(20);

    const inProgress = container.querySelector(
      '[data-testid="kanban-column-inProgress"]',
    );
    expect(inProgress?.textContent).toContain(copy.emptyColumn.inProgress);
    const completed = container.querySelector(
      '[data-testid="kanban-column-completed"]',
    );
    expect(completed?.textContent).toContain(copy.emptyColumn.completed);
  });
});

describe("reviewToCard (pure projection)", () => {
  it("maps the wire shape into the compact KanbanCard the column renders", () => {
    const card = reviewToCard(buildReview());
    expect(card).toEqual({
      id: "review-1",
      kind: "review",
      title: "Create Content Calendar",
      identifier: "COMPANY-1",
      assigneeLabel: "agent agent-12",
      reviewId: "review-1",
    });
  });

  it("returns a null assigneeLabel when the review has no submitting agent", () => {
    const card = reviewToCard(buildReview({ submittedByAgentId: null }));
    expect(card.assigneeLabel).toBeNull();
  });
});
