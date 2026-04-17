// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { payments as copy } from "@/copy/payments";
import { Upgrade } from "./Upgrade";

/**
 * C-11 gate: Upgrade renders Free + plans from the catalog, Subscribe
 * fires POST /checkout/subscription and redirects to the returned
 * Stripe URL via window.location. Top-up modal opens via the PayG card
 * and POSTs /checkout/top-up.
 */

const mockNavigate = vi.fn();
const mockLocation = {
  pathname: "/c/company-x/upgrade",
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

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function setupFetch(opts: { plansConfigured?: boolean; topUpsConfigured?: boolean } = {}) {
  const calls: FetchCall[] = [];
  const plansConfigured = opts.plansConfigured ?? true;
  const topUpsConfigured = opts.topUpsConfigured ?? true;

  const respond = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    if (url.endsWith("/plugin-payments/catalog")) {
      return ok({
        plans: [
          { key: "starter", displayName: "Starter", monthlyPriceCents: 4900, priceConfigured: plansConfigured },
          { key: "pro", displayName: "Pro", monthlyPriceCents: 14900, priceConfigured: plansConfigured },
        ],
        topUps: [
          { credits: 20, amountCents: 2000, priceConfigured: topUpsConfigured },
          { credits: 50, amountCents: 4500, priceConfigured: topUpsConfigured },
          { credits: 100, amountCents: 8500, priceConfigured: topUpsConfigured },
          { credits: 250, amountCents: 20000, priceConfigured: topUpsConfigured },
        ],
      });
    }
    if (url.endsWith("/plugin-payments/subscription")) {
      return ok({ subscription: null });
    }
    if (url.endsWith("/checkout/subscription") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ checkout: { id: "cs_sub_1", url: "https://checkout.stripe.com/sub" } }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/checkout/top-up") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ checkout: { id: "cs_topup_1", url: "https://checkout.stripe.com/topup" } }),
        { status: 201, headers: { "Content-Type": "application/json" } },
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

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function render(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/c/company-x/upgrade"]}>
          <Routes>
            <Route path="c/:companyId/upgrade" element={<Upgrade />} />
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

describe("Upgrade (C-11)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;
  // Stub window.location.href so the redirect is observable instead of
  // actually navigating jsdom away.
  const originalLocation = window.location;
  let hrefAssigned: string | null = null;

  beforeEach(() => {
    mockNavigate.mockReset();
    hrefAssigned = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        origin: "http://localhost",
        get href() {
          return hrefAssigned ?? "";
        },
        set href(v: string) {
          hrefAssigned = v;
        },
      },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    container.remove();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders the page with header, trial banner, and 3 plan cards", async () => {
    setupFetch();
    root = render(container);
    await flush(20);

    expect(container.querySelector('[data-testid="upgrade-view"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="upgrade-header"]')).toBeTruthy();
    // CompanyShellData mock company is on a trial.
    expect(container.querySelector('[data-testid="trial-banner"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-card-free"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-card-starter"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-card-pro"]')).toBeTruthy();
  });

  it("clicking Subscribe on Starter POSTs /checkout/subscription and redirects to the Stripe URL", async () => {
    const { calls } = setupFetch();
    root = render(container);
    await flush(20);

    const btn = container.querySelector('[data-testid="subscribe-starter"]');
    expect(btn).toBeTruthy();
    clickElement(btn!);
    await flush(40);

    const posts = calls.filter(
      (c) => c.init?.method === "POST" && c.url.endsWith("/checkout/subscription"),
    );
    expect(posts.length).toBe(1);
    expect(posts[0].init?.body).toContain('"plan":"starter"');
    expect(posts[0].init?.body).toContain('"successUrl"');
    expect(hrefAssigned).toBe("https://checkout.stripe.com/sub");
  });

  it("disables Subscribe + shows the not-configured note when priceConfigured=false", async () => {
    setupFetch({ plansConfigured: false });
    root = render(container);
    await flush(20);

    const btn = container.querySelector(
      '[data-testid="subscribe-starter"]',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(
      container.querySelector('[data-testid="plan-starter-not-configured"]'),
    ).toBeTruthy();
  });

  it("PayG card opens the Top-up modal; selecting an option + Purchase POSTs /checkout/top-up and redirects", async () => {
    const { calls } = setupFetch();
    root = render(container);
    await flush(20);

    expect(document.body.querySelector('[data-testid="topup-modal"]')).toBeNull();
    clickElement(container.querySelector('[data-testid="open-topup-cta"]')!);
    await flush(40);

    // Modal renders into a portal (body), not into the page container.
    const modal = document.body.querySelector('[data-testid="topup-modal"]');
    expect(modal).toBeTruthy();
    // Default selection is the popular tier (50).
    const popular = document.body.querySelector('[data-testid="topup-option-50"]');
    expect(popular?.getAttribute("data-selected")).toBe("true");

    // Switch to 100 and purchase.
    clickElement(document.body.querySelector('[data-testid="topup-option-100"]')!);
    clickElement(document.body.querySelector('[data-testid="topup-purchase"]')!);
    await flush(40);

    const posts = calls.filter(
      (c) => c.init?.method === "POST" && c.url.endsWith("/checkout/top-up"),
    );
    expect(posts.length).toBe(1);
    expect(posts[0].init?.body).toContain('"credits":100');
    expect(hrefAssigned).toBe("https://checkout.stripe.com/topup");
  });

  it("Top-up modal Cancel button closes the modal without firing checkout", async () => {
    const { calls } = setupFetch();
    root = render(container);
    await flush(20);

    clickElement(container.querySelector('[data-testid="open-topup-cta"]')!);
    await flush(20);
    expect(document.body.querySelector('[data-testid="topup-modal"]')).toBeTruthy();

    clickElement(document.body.querySelector('[data-testid="topup-cancel"]')!);
    await flush(20);

    const posts = calls.filter(
      (c) => c.init?.method === "POST" && c.url.endsWith("/checkout/top-up"),
    );
    expect(posts.length).toBe(0);
  });
});
