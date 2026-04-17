// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settingsSubpages as copy } from "@/copy/settings-subpages";
import { CompanySettingsTab } from "../Settings";

/**
 * C-12 gate: the 5 settings sub-pages render from their live HTTP
 * endpoints and the core CRUD actions persist. One file covers all
 * five because the quick-nav router is what ties them together.
 */

const mockNavigate = vi.fn();
const mockLocation = {
  pathname: "/c/company-x/settings",
  search: "",
  hash: "",
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
    useParams: () => ({ companyId: "company-x" }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

interface FetchCall { url: string; init?: RequestInit }

function setupFetch() {
  const calls: FetchCall[] = [];
  let domains = [
    {
      id: "dom-1",
      companyId: "company-x",
      domain: "example.com",
      isDefault: true,
      status: "active",
      dnsRecords: [],
      registeredAt: new Date().toISOString(),
    },
  ];
  let connections = [
    {
      id: "conn-1",
      companyId: "company-x",
      toolKind: "github",
      label: "GitHub",
      scopes: [],
      metadata: {},
      expiresAt: null,
      connectedAt: new Date().toISOString(),
      tokenLast4: "AbCd",
    },
  ];
  let pages = [{ id: "page-1", title: "Growth overview", layout: { widgets: [] } }];

  const respond = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    calls.push({ url, init });

    // Domains
    if (url.endsWith("/plugin-identity/domains") && method === "GET") {
      return ok({ domains });
    }
    if (url.endsWith("/plugin-identity/domains") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { domain: string };
      domains = [
        ...domains,
        {
          id: `dom-${domains.length + 1}`,
          companyId: "company-x",
          domain: body.domain,
          isDefault: false,
          status: "pending",
          dnsRecords: [],
          registeredAt: new Date().toISOString(),
        },
      ];
      return ok({ domain: domains[domains.length - 1] }, 201);
    }
    if (url.match(/\/plugin-identity\/domains\/[^/]+$/) && method === "DELETE") {
      const id = url.split("/").pop()!;
      domains = domains.filter((d) => d.id !== id);
      return new Response(null, { status: 204 });
    }
    // Connect-tools
    if (url.endsWith("/plugin-connect-tools/adapters")) {
      return ok({
        adapters: [
          { kind: "slack", displayName: "Slack", homepageUrl: null, defaultScopes: [] },
        ],
      });
    }
    if (url.endsWith("/plugin-connect-tools/connections") && method === "GET") {
      return ok({ connections });
    }
    if (url.endsWith("/plugin-connect-tools/connections") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const row = {
        id: `conn-${connections.length + 1}`,
        companyId: "company-x",
        toolKind: body.toolKind,
        label: body.label,
        scopes: [],
        metadata: {},
        expiresAt: null,
        connectedAt: new Date().toISOString(),
        tokenLast4: "WxYz",
      };
      connections = [...connections, row];
      return ok({ connection: row }, 201);
    }
    if (url.match(/\/plugin-connect-tools\/connections\/[^/]+$/) && method === "DELETE") {
      const id = url.split("/").pop()!;
      connections = connections.filter((c) => c.id !== id);
      return new Response(null, { status: 204 });
    }
    // Dashboards
    if (url.endsWith("/plugin-dashboards/pages") && method === "GET") {
      return ok({ pages });
    }
    if (url.endsWith("/plugin-dashboards/pages") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const page = { id: `page-${pages.length + 1}`, title: body.title, layout: body.layout };
      pages = [...pages, page];
      return ok({ page }, 201);
    }
    if (url.match(/\/plugin-dashboards\/pages\/[^/]+$/) && method === "DELETE") {
      const id = url.split("/").pop()!;
      pages = pages.filter((p) => p.id !== id);
      return new Response(null, { status: 204 });
    }
    // Virtual cards (fan-out per agent — return empty by default)
    if (url.includes("/plugin-identity/agents/") && url.endsWith("/cards")) {
      return ok({ cards: [] });
    }
    // Team / access
    if (url.endsWith("/members")) {
      return ok([
        {
          id: "member-1",
          userId: "user-1",
          agentId: null,
          displayName: "Nicole Mayer",
          email: "nicolemayerwork@gmail.com",
          memberType: "human",
          joinedAt: new Date().toISOString(),
        },
      ]);
    }
    if (url.includes("/join-requests") && !url.endsWith("/approve") && !url.endsWith("/reject")) {
      return ok([]);
    }
    if (url.includes("/invites") && method === "POST") {
      return ok(
        {
          id: "inv-1",
          companyId: "company-x",
          inviteType: "company_join",
          allowedJoinTypes: "human",
          expiresAt: new Date(Date.now() + 86400_000).toISOString(),
          token: "tok",
          inviteUrl: "http://localhost/invites/tok",
        },
        201,
      );
    }
    return new Response(JSON.stringify({ error: "unexpected: " + url }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = respond as unknown as typeof fetch;
  return { calls };
}

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function render(container: HTMLElement, path: string) {
  mockLocation.pathname = path;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="c/:companyId/settings/*" element={<CompanySettingsTab />} />
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

/** React-controlled-input native setter — bypasses React's value tracker. */
function setInputValue(input: HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Settings sub-pages (C-12)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    mockNavigate.mockReset();
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

  it("quick-nav tiles on General navigate to each sub-page route", () => {
    setupFetch();
    root = render(container, "/c/company-x/settings/general");

    for (const slug of ["domains", "virtual-cards", "custom-dashboards", "connections"]) {
      const tile = container.querySelector(`[data-testid="quick-nav-${slug}"]`);
      expect(tile).toBeTruthy();
      clickElement(tile!);
      expect(mockNavigate).toHaveBeenCalledWith(`/c/company-x/settings/${slug}`);
    }
  });

  it("Domains sub-page lists, adds, and deletes domains against live endpoints", async () => {
    const { calls } = setupFetch();
    root = render(container, "/c/company-x/settings/domains");
    await flush(20);

    expect(container.querySelector('[data-testid="settings-domains"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="domain-row-dom-1"]')).toBeTruthy();

    const input = container.querySelector('[data-testid="domain-input"]') as HTMLInputElement;
    act(() => setInputValue(input, "invalid-hostname"));
    clickElement(container.querySelector('[data-testid="domain-add-cta"]')!);
    await flush(20);
    expect(container.querySelector('[data-testid="domain-error"]')?.textContent).toBe(
      copy.domains.invalidHostname,
    );

    act(() => setInputValue(input, "beta.example.com"));
    clickElement(container.querySelector('[data-testid="domain-add-cta"]')!);
    await flush(40);

    const posts = calls.filter((c) => c.init?.method === "POST" && c.url.endsWith("/domains"));
    expect(posts.length).toBe(1);
    expect(posts[0].init?.body).toContain('"domain":"beta.example.com"');
    expect(container.querySelector('[data-testid="domain-row-dom-2"]')).toBeTruthy();

    clickElement(container.querySelector('[data-testid="domain-delete-dom-1"]')!);
    await flush(40);
    const deletes = calls.filter((c) => c.init?.method === "DELETE" && c.url.includes("/domains/"));
    expect(deletes.length).toBe(1);
  });

  it("Connections sub-page renders existing connections + opens the connect form + deletes", async () => {
    const { calls } = setupFetch();
    root = render(container, "/c/company-x/settings/connections");
    await flush(20);

    expect(container.querySelector('[data-testid="settings-connections"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="connection-row-conn-1"]')).toBeTruthy();

    clickElement(container.querySelector('[data-testid="adapter-connect-slack"]')!);
    await flush(20);
    expect(container.querySelector('[data-testid="connect-form"]')).toBeTruthy();
    const tokenInput = container.querySelector('[data-testid="connect-token"]') as HTMLInputElement;
    act(() => setInputValue(tokenInput, "xoxb-test"));
    clickElement(container.querySelector('[data-testid="connect-submit"]')!);
    await flush(40);

    const posts = calls.filter((c) => c.init?.method === "POST" && c.url.endsWith("/connections"));
    expect(posts.length).toBe(1);
    expect(posts[0].init?.body).toContain('"toolKind":"slack"');

    clickElement(container.querySelector('[data-testid="connection-delete-conn-1"]')!);
    await flush(40);
    const deletes = calls.filter((c) => c.init?.method === "DELETE" && c.url.includes("/connections/"));
    expect(deletes.length).toBe(1);
  });

  it("Custom Dashboards sub-page creates + deletes pages", async () => {
    const { calls } = setupFetch();
    root = render(container, "/c/company-x/settings/custom-dashboards");
    await flush(20);

    expect(container.querySelector('[data-testid="settings-dashboards"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="dashboard-row-page-1"]')).toBeTruthy();

    clickElement(container.querySelector('[data-testid="dashboard-new-cta"]')!);
    await flush(20);
    const titleInput = container.querySelector('[data-testid="dashboard-new-title"]') as HTMLInputElement;
    act(() => setInputValue(titleInput, "Quarterly"));
    clickElement(container.querySelector('[data-testid="dashboard-new-submit"]')!);
    await flush(40);

    const posts = calls.filter((c) => c.init?.method === "POST" && c.url.endsWith("/pages"));
    expect(posts.length).toBe(1);
    expect(posts[0].init?.body).toContain('"title":"Quarterly"');

    clickElement(container.querySelector('[data-testid="dashboard-delete-page-1"]')!);
    await flush(40);
    const deletes = calls.filter((c) => c.init?.method === "DELETE" && c.url.includes("/pages/"));
    expect(deletes.length).toBe(1);
  });

  it("Virtual Cards sub-page renders an empty state when no agent has cards", async () => {
    setupFetch();
    root = render(container, "/c/company-x/settings/virtual-cards");
    await flush(20);
    expect(container.querySelector('[data-testid="settings-virtual-cards"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="virtual-cards-empty"]')).toBeTruthy();
  });

  it("Team sub-page renders members + accepts invite form input", async () => {
    const { calls } = setupFetch();
    root = render(container, "/c/company-x/settings/team");
    await flush(20);

    expect(container.querySelector('[data-testid="settings-team"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="member-row-member-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="team-pending-empty"]')).toBeTruthy();

    const emailInput = container.querySelector('[data-testid="team-invite-email"]') as HTMLInputElement;
    act(() => setInputValue(emailInput, "not-an-email"));
    clickElement(container.querySelector('[data-testid="team-invite-submit"]')!);
    await flush(20);
    expect(container.querySelector('[data-testid="team-invite-error"]')?.textContent).toBe(
      copy.team.invalidEmail,
    );

    act(() => setInputValue(emailInput, "teammate@example.com"));
    clickElement(container.querySelector('[data-testid="team-invite-submit"]')!);
    await flush(40);
    const posts = calls.filter((c) => c.init?.method === "POST" && c.url.endsWith("/invites"));
    expect(posts.length).toBe(1);
  });
});
