// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appDetail as copy } from "@/copy/app-detail";
import { AppDetail } from "./AppDetail";

/**
 * C-10 gate: each tab renders for a seeded App; env-var PATCH + DELETE
 * persist via the live B-03 endpoints; preview switches between deployed
 * and not-deployed states; deployments empty + populated.
 */

const mockNavigate = vi.fn();
const mockLocation = {
  pathname: "/c/company-x/apps/app-landing",
  search: "",
  hash: "",
};
let mockParams: { companyId: string; appId: string } = {
  companyId: "company-x",
  appId: "app-landing",
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

interface FetchCall {
  url: string;
  init?: RequestInit;
}

interface MockState {
  app: { id: string; companyId: string; name: string; productionDomain: string | null; envVars: Record<string, string>; channelId: null; connections: Record<string, unknown>; createdAt: string; updatedAt: string };
  preview: { productionDomain: string | null; status: "deployed" | "not_deployed" };
  files: { tree: any; count: number; files: any[] };
  deployments: Array<{ id: string; appId: string; url: string | null; status: string; triggeredByAgentId: string | null; triggeredAt: string; completedAt: string | null }>;
}

function defaultState(overrides: Partial<MockState> = {}): MockState {
  const now = new Date().toISOString();
  return {
    app: {
      id: "app-landing",
      companyId: "company-x",
      name: "Landing Page",
      productionDomain: null,
      envVars: { NODE_ENV: "production" },
      channelId: null,
      connections: {},
      createdAt: now,
      updatedAt: now,
      ...overrides.app,
    },
    preview: overrides.preview ?? { productionDomain: null, status: "not_deployed" },
    files: overrides.files ?? {
      tree: {
        kind: "directory",
        name: "",
        path: "",
        children: [
          { kind: "file", name: "package.json", path: "package.json", sizeBytes: 220 },
          {
            kind: "directory",
            name: "src",
            path: "src",
            children: [
              { kind: "file", name: "index.tsx", path: "src/index.tsx", sizeBytes: 1080 },
            ],
          },
        ],
      },
      count: 2,
      files: [],
    },
    deployments: overrides.deployments ?? [],
  };
}

function setupFetch(state: MockState) {
  const calls: FetchCall[] = [];
  let env = { ...state.app.envVars };

  const respond = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    calls.push({ url, init });

    if (url.endsWith("/apps/app-landing") && method === "GET") {
      return ok({ app: { ...state.app, envVars: env } });
    }
    if (url.endsWith("/apps/app-landing/preview")) {
      return ok({ preview: state.preview });
    }
    if (url.endsWith("/apps/app-landing/files")) {
      return ok(state.files);
    }
    if (url.endsWith("/apps/app-landing/deployments")) {
      return ok({ deployments: state.deployments });
    }
    if (url.endsWith("/apps/app-landing/env") && method === "GET") {
      return ok({ envVars: env });
    }
    if (url.endsWith("/apps/app-landing/env") && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        envVars?: Record<string, string>;
      };
      env = { ...env, ...(body.envVars ?? {}) };
      return ok({ envVars: env });
    }
    if (url.includes("/apps/app-landing/env/") && method === "DELETE") {
      const key = decodeURIComponent(url.split("/env/")[1]);
      const next = { ...env };
      delete next[key];
      env = next;
      return ok({ envVars: env });
    }
    return new Response(JSON.stringify({ error: "unexpected: " + url }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = respond as unknown as typeof fetch;
  return { calls };
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function render(container: HTMLElement, path: string) {
  mockLocation.pathname = path;
  const m = path.match(/^\/c\/([^/]+)\/apps\/([^/]+)/);
  if (m) mockParams = { companyId: m[1], appId: m[2] };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="c/:companyId/apps/:appId/*" element={<AppDetail />} />
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

/**
 * React tracks the previous value on the input element to decide whether
 * to fire onChange. Setting `.value` directly bypasses the React-tracked
 * setter; we have to call the native HTMLInputElement value setter so
 * React notices and re-runs the controlled-input handler.
 */
function setInputValue(input: HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AppDetail (C-10)", () => {
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

  it("renders the header + 4-tab strip + Preview by default", async () => {
    setupFetch(defaultState());
    root = render(container, "/c/company-x/apps/app-landing");
    await flush(20);

    const detail = container.querySelector('[data-testid="app-detail"]');
    expect(detail?.getAttribute("data-app-id")).toBe("app-landing");
    expect(container.querySelector('[data-testid="app-header"]')?.textContent).toContain("Landing Page");

    const tabs = container.querySelectorAll('[data-testid="app-tab-strip"] button[data-tab]');
    expect(tabs.length).toBe(4);
    expect(Array.from(tabs).map((b) => b.getAttribute("data-tab"))).toEqual([
      "preview",
      "code",
      "deployments",
      "settings",
    ]);
    expect(container.querySelector('[data-testid="app-tab-preview"]')).toBeTruthy();
  });

  it("Preview renders the not-deployed empty state when productionDomain is null", async () => {
    setupFetch(defaultState({ preview: { productionDomain: null, status: "not_deployed" } }));
    root = render(container, "/c/company-x/apps/app-landing");
    await flush(20);
    expect(container.querySelector('[data-testid="preview-not-deployed"]')).toBeTruthy();
  });

  it("Preview renders an iframe pointed at the production domain when deployed", async () => {
    const state = defaultState({
      app: {
        ...defaultState().app,
        productionDomain: "landing-page.vercel.app",
      },
      preview: { productionDomain: "landing-page.vercel.app", status: "deployed" },
    });
    setupFetch(state);
    root = render(container, "/c/company-x/apps/app-landing");
    await flush(20);
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toBe("https://landing-page.vercel.app");
  });

  it("Code tab renders the file tree summary + at least one file row", async () => {
    setupFetch(defaultState());
    root = render(container, "/c/company-x/apps/app-landing/code");
    await flush(20);
    const code = container.querySelector('[data-testid="app-tab-code"]');
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain(copy.code.summary(2));
    expect(container.querySelector('[data-file-path="package.json"]')).toBeTruthy();
  });

  it("Deployments tab renders the empty state when there are no deployments", async () => {
    setupFetch(defaultState({ deployments: [] }));
    root = render(container, "/c/company-x/apps/app-landing/deployments");
    await flush(20);
    expect(container.querySelector('[data-testid="deployments-empty"]')).toBeTruthy();
  });

  it("Deployments tab renders a row per deployment with the right status badge", async () => {
    setupFetch(
      defaultState({
        deployments: [
          {
            id: "dep-1",
            appId: "app-landing",
            url: "https://landing-page-abc.vercel.app",
            status: "deployed",
            triggeredByAgentId: "agent-12345678abcd",
            triggeredAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ],
      }),
    );
    root = render(container, "/c/company-x/apps/app-landing/deployments");
    await flush(20);
    const row = container.querySelector('[data-testid="deployment-dep-1"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain(copy.deployments.statusLabels.deployed);
    expect(row?.textContent).toContain("landing-page-abc.vercel.app");
  });

  it("Settings tab renders the existing env vars and lets us add + persist a new one", async () => {
    const { calls } = setupFetch(defaultState());
    root = render(container, "/c/company-x/apps/app-landing/settings");
    await flush(20);

    const list = container.querySelector('[data-testid="env-list"]');
    expect(list).toBeTruthy();
    expect(container.querySelector('[data-testid="env-row-NODE_ENV"]')).toBeTruthy();

    const keyInput = container.querySelector('[data-testid="env-key-input"]') as HTMLInputElement;
    const valueInput = container.querySelector('[data-testid="env-value-input"]') as HTMLInputElement;
    act(() => {
      setInputValue(keyInput, "API_KEY");
      setInputValue(valueInput, "sk-test");
    });
    clickElement(container.querySelector('[data-testid="env-add-cta"]')!);
    await flush(40);

    const patches = calls.filter(
      (c) => c.init?.method === "PATCH" && c.url.endsWith("/env"),
    );
    expect(patches.length).toBe(1);
    expect(patches[0].init?.body).toContain('"API_KEY":"sk-test"');
    // After invalidation refetches, both rows should be present.
    expect(container.querySelector('[data-testid="env-row-API_KEY"]')).toBeTruthy();
  });

  it("Settings tab refuses an invalid env key and does not call PATCH", async () => {
    const { calls } = setupFetch(defaultState());
    root = render(container, "/c/company-x/apps/app-landing/settings");
    await flush(20);

    const keyInput = container.querySelector('[data-testid="env-key-input"]') as HTMLInputElement;
    const valueInput = container.querySelector('[data-testid="env-value-input"]') as HTMLInputElement;
    act(() => {
      setInputValue(keyInput, "lower-case-key");
      setInputValue(valueInput, "v");
    });
    clickElement(container.querySelector('[data-testid="env-add-cta"]')!);
    await flush(20);

    expect(container.querySelector('[data-testid="env-error"]')?.textContent).toBe(
      copy.settings.invalidKey,
    );
    expect(calls.filter((c) => c.init?.method === "PATCH").length).toBe(0);
  });

  it("Delete button on an env row sends DELETE and removes the row", async () => {
    const { calls } = setupFetch(defaultState());
    root = render(container, "/c/company-x/apps/app-landing/settings");
    await flush(20);

    const del = container.querySelector('[data-testid="env-delete-NODE_ENV"]');
    expect(del).toBeTruthy();
    clickElement(del!);
    await flush(40);

    const deletes = calls.filter(
      (c) => c.init?.method === "DELETE" && c.url.includes("/env/"),
    );
    expect(deletes.length).toBe(1);
    expect(deletes[0].url).toBe(
      "/api/companies/company-x/plugin-apps-builder/apps/app-landing/env/NODE_ENV",
    );
    expect(container.querySelector('[data-testid="env-row-NODE_ENV"]')).toBeNull();
  });

  it("Renders not-found state when the GET app returns 404", async () => {
    globalThis.fetch = (vi.fn(async () =>
      new Response(JSON.stringify({ error: "app not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    )) as unknown as typeof fetch;
    root = render(container, "/c/company-x/apps/missing");
    await flush(20);
    expect(container.querySelector('[data-testid="app-detail-not-found"]')).toBeTruthy();
  });

  it("Tab strip click navigates to the right path", async () => {
    setupFetch(defaultState());
    root = render(container, "/c/company-x/apps/app-landing");
    await flush(20);
    const codeBtn = container.querySelector('[data-tab="code"]');
    clickElement(codeBtn!);
    expect(mockNavigate).toHaveBeenCalledWith("/c/company-x/apps/app-landing/code");
  });
});
