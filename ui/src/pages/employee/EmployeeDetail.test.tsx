// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { employeeDetail as copy } from "@/copy/employee-detail";
import type { VirtualCardDto } from "@/api/plugin-identity";
import { EmployeeDetail } from "./EmployeeDetail";

/**
 * C-09 gate:
 *   1. Each of the 9 tabs renders without error for a department agent.
 *   2. CEO variant hides Browser / Phone / Virtual Cards.
 *   3. Virtual Cards tab hits the live A-06.5 bank endpoint and renders
 *      the returned cards.
 *   4. Not-found path renders the typed empty state.
 */

const mockNavigate = vi.fn();
// Mutated by beforeEach per-test to exercise different agent ids + tab paths.
const mockLocation = {
  pathname: "/c/company-x/team/agent-lpe",
  search: "",
  hash: "",
};
let mockParams: { companyId: string; agentId: string } = {
  companyId: "company-x",
  agentId: "agent-lpe",
};

vi.mock("@/lib/router", async () => {
  const rrd = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...rrd,
    Link: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function sampleCard(overrides: Partial<VirtualCardDto> = {}): VirtualCardDto {
  return {
    cardId: "card-1",
    accountId: "acct-1",
    ownerAgentId: "agent-lpe",
    pan: "4242 42** **** 0001",
    last4: "0001",
    spendingLimitUsd: 500,
    spentUsd: 120.5,
    merchantCategoryFilters: [],
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function setupFetchMock(initialCards: readonly VirtualCardDto[] = [sampleCard()]) {
  const calls: FetchCall[] = [];
  let cards = [...initialCards];
  const respond = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    if (url.includes("/plugin-identity/agents/") && url.endsWith("/cards") && (!init || !init.method || init.method === "GET")) {
      return new Response(JSON.stringify({ cards }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/plugin-identity/agents/") && url.endsWith("/cards") && init?.method === "POST") {
      const newCard = sampleCard({ cardId: `card-${cards.length + 1}`, last4: "9999" });
      cards = [...cards, newCard];
      return new Response(JSON.stringify({ card: newCard }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/plugin-identity/agents/") && url.endsWith("/freeze")) {
      cards = cards.map((c) => (c.cardId === "card-1" ? { ...c, status: "frozen" } : c));
      return new Response(JSON.stringify({ card: cards[0] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "unexpected: " + url }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = respond as unknown as typeof fetch;
  return { calls };
}

function render(container: HTMLElement, path: string) {
  mockLocation.pathname = path;
  const match = path.match(/^\/c\/([^/]+)\/team\/([^/]+)/);
  if (match) {
    mockParams = { companyId: match[1], agentId: match[2] };
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="c/:companyId/team/:agentId/*" element={<EmployeeDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return root;
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

describe("EmployeeDetail (C-09)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    mockNavigate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    setupFetchMock();
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    container.remove();
  });

  it("renders the dept-agent variant with header + 9-tab strip + Profile by default", () => {
    root = render(container, "/c/company-x/team/agent-lpe");
    const detail = container.querySelector('[data-testid="employee-detail"]');
    expect(detail).toBeTruthy();
    expect(detail?.getAttribute("data-is-ceo")).toBe("false");

    const header = container.querySelector('[data-testid="employee-header"]');
    expect(header?.textContent).toContain("Landing Page Engineer");
    expect(header?.textContent).toContain(copy.page.backToTeam);

    const strip = container.querySelector('[data-testid="employee-tab-strip"]');
    const tabs = strip?.querySelectorAll("button[data-tab]") ?? [];
    expect(tabs.length).toBe(9);
    expect(Array.from(tabs).map((b) => b.textContent)).toEqual([
      copy.tabs.profile,
      copy.tabs.chat,
      copy.tabs.browser,
      copy.tabs.phone,
      copy.tabs.workspace,
      copy.tabs.virtualCards,
      copy.tabs.inbox,
      copy.tabs.compute,
      copy.tabs.settings,
    ]);

    // Profile is default at /team/:agentId
    expect(container.querySelector('[data-testid="employee-tab-profile"]')).toBeTruthy();
    // Dept variant shows the populated Recursive Intelligence diagram,
    // not the CEO-empty card.
    expect(container.querySelector('[data-testid="recursive-intelligence-diagram"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="recursive-intelligence-empty"]')).toBeNull();
  });

  it("renders the CEO variant with only 6 tabs — Browser / Phone / Virtual Cards hidden", () => {
    root = render(container, "/c/company-x/team/agent-ceo");
    const detail = container.querySelector('[data-testid="employee-detail"]');
    expect(detail?.getAttribute("data-is-ceo")).toBe("true");

    const strip = container.querySelector('[data-testid="employee-tab-strip"]');
    const tabs = strip?.querySelectorAll("button[data-tab]") ?? [];
    expect(tabs.length).toBe(6);
    const ids = Array.from(tabs).map((b) => b.getAttribute("data-tab"));
    expect(ids).toEqual(["profile", "chat", "workspace", "inbox", "compute", "settings"]);
    expect(ids).not.toContain("browser");
    expect(ids).not.toContain("phone");
    expect(ids).not.toContain("virtualCards");

    // CEO profile shows the identity card + the empty recursive panel.
    expect(container.querySelector('[data-testid="profile-identity"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="recursive-intelligence-empty"]')).toBeTruthy();
  });

  it("navigates to each tab path when its button is clicked", () => {
    root = render(container, "/c/company-x/team/agent-lpe");
    const strip = container.querySelector('[data-testid="employee-tab-strip"]');
    const workspaceBtn = strip?.querySelector('[data-tab="workspace"]');
    clickElement(workspaceBtn!);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/c/company-x/team/agent-lpe/workspace",
    );
  });

  it.each([
    ["chat", "employee-tab-chat"],
    ["browser", "employee-tab-browser"],
    ["phone", "employee-tab-phone"],
    ["workspace", "employee-tab-workspace"],
    ["inbox", "employee-tab-inbox"],
    ["compute", "employee-tab-compute"],
    ["settings", "employee-tab-settings"],
  ])("mounts the %s tab for a dept agent without error", async (path, testId) => {
    root = render(container, `/c/company-x/team/agent-lpe/${path}`);
    await flush(0);
    expect(container.querySelector(`[data-testid="${testId}"]`)).toBeTruthy();
  });

  it("mounts each allowed CEO tab without error", async () => {
    const ceoTabs: [string, string][] = [
      ["", "employee-tab-profile"],
      ["chat", "employee-tab-chat"],
      ["workspace", "employee-tab-workspace"],
      ["inbox", "employee-tab-inbox"],
      ["compute", "employee-tab-compute"],
      ["settings", "employee-tab-settings"],
    ];
    for (const [suffix, testId] of ceoTabs) {
      const path = suffix
        ? `/c/company-x/team/agent-ceo/${suffix}`
        : "/c/company-x/team/agent-ceo";
      root = render(container, path);
      await flush(0);
      expect(container.querySelector(`[data-testid="${testId}"]`)).toBeTruthy();
      act(() => root!.unmount());
      root = null;
      container.innerHTML = "";
    }
  });

  it("virtual-cards tab fires the live agent-cards GET and renders the returned card", async () => {
    const { calls } = setupFetchMock([sampleCard()]);
    root = render(container, "/c/company-x/team/agent-lpe/virtual-cards");
    await flush(20);

    const cardEl = container.querySelector('[data-testid="virtual-card-card-1"]');
    expect(cardEl).toBeTruthy();
    expect(cardEl?.textContent).toContain(copy.virtualCards.last4Label("0001"));
    expect(cardEl?.textContent).toContain(copy.virtualCards.activeBadge);

    const cardCalls = calls.filter((c) =>
      c.url.endsWith("/plugin-identity/agents/agent-lpe/cards") &&
      (!c.init || !c.init.method || c.init.method === "GET"),
    );
    expect(cardCalls.length).toBeGreaterThanOrEqual(1);
    expect(cardCalls[0].url).toBe(
      "/api/companies/company-x/plugin-identity/agents/agent-lpe/cards",
    );
  });

  it("virtual-cards empty state renders when the API returns no cards", async () => {
    setupFetchMock([]);
    root = render(container, "/c/company-x/team/agent-lpe/virtual-cards");
    await flush(20);
    expect(container.querySelector('[data-testid="virtual-cards-empty"]')).toBeTruthy();
  });

  it("Issue virtual card button posts to the issue endpoint and invalidates the list", async () => {
    const { calls } = setupFetchMock([]);
    root = render(container, "/c/company-x/team/agent-lpe/virtual-cards");
    await flush(20);

    const issueBtn = container.querySelector('[data-testid="issue-card-cta"]');
    expect(issueBtn).toBeTruthy();
    clickElement(issueBtn!);
    await flush(20);

    const posts = calls.filter(
      (c) => c.init?.method === "POST" && c.url.endsWith("/cards"),
    );
    expect(posts.length).toBe(1);
    expect(posts[0].url).toBe(
      "/api/companies/company-x/plugin-identity/agents/agent-lpe/cards",
    );
  });

  it("Freeze action posts to /:cardId/freeze", async () => {
    const { calls } = setupFetchMock([sampleCard()]);
    root = render(container, "/c/company-x/team/agent-lpe/virtual-cards");
    await flush(20);

    const freezeBtn = container.querySelector('[data-testid="freeze-card-1"]');
    expect(freezeBtn).toBeTruthy();
    clickElement(freezeBtn!);
    await flush(20);

    const freezeCalls = calls.filter((c) => c.url.endsWith("/freeze"));
    expect(freezeCalls.length).toBe(1);
    expect(freezeCalls[0].url).toBe(
      "/api/companies/company-x/plugin-identity/agents/agent-lpe/cards/card-1/freeze",
    );
  });

  it("renders the not-found page when the agent id doesn't exist in this company", () => {
    root = render(container, "/c/company-x/team/unknown-agent");
    expect(
      container.querySelector('[data-testid="employee-detail-not-found"]'),
    ).toBeTruthy();
  });
});
