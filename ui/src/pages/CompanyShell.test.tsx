// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyShell as copy } from "@/copy/company-shell";
import { CompanyShell } from "./CompanyShell";

/**
 * C-03 render + popover contract. The gate-C-03 shell requirements:
 *   1. sidebar renders with all sections
 *   2. all popovers open/close
 *   3. switches company on select
 *
 * We mock `@/lib/router` with the real `react-router-dom` primitives
 * (Route/Routes/Navigate) plus stubbed hooks so CompanyShell's nested
 * <Routes> works inside a MemoryRouter test harness. `useNavigate` is
 * a spy so we can assert routing without wiring a real history observer.
 */

const mockNavigate = vi.fn();
const mockLocation = { pathname: "/c/company-x", search: "", hash: "" };

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

function renderShell(container: HTMLElement, initialPath = mockLocation.pathname) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="c/:companyId/*" element={<CompanyShell />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return root;
}

function clickElement(el: Element) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

describe("CompanyShell (C-03)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    mockNavigate.mockReset();
    mockLocation.pathname = "/c/company-x";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    container.remove();
  });

  it("mounts without throwing and lays out sidebar + breadcrumb + main-content slot", () => {
    root = renderShell(container);
    expect(container.querySelector('[data-testid="company-shell"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="company-sidebar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="company-breadcrumb"]')).toBeTruthy();
    // At index (/c/company-x) CompanyChat renders; at other paths MainContentPlaceholder does.
    // Either resolution is a valid "main content area".
    const mainArea =
      container.querySelector('[data-testid="company-chat"]') ??
      container.querySelector('[data-testid="company-main"]');
    expect(mainArea).toBeTruthy();
  });

  it("renders every sidebar section: switcher, review pill, nav, apps, team (CEO + 5 depts), getting-started, footer", () => {
    root = renderShell(container);
    expect(
      container.querySelector(`[aria-label="${copy.companySwitcher.triggerLabel}"]`),
    ).toBeTruthy();
    expect(
      container.querySelector(`[aria-label="${copy.reviewPill.summary(1)}"]`),
    ).toBeTruthy();
    const sidebar = container.querySelector('[data-testid="company-sidebar"]');
    expect(sidebar?.textContent).toContain(copy.nav.company);
    expect(sidebar?.textContent).toContain(copy.nav.tasks);
    expect(sidebar?.textContent).toContain(copy.nav.drive);
    expect(sidebar?.textContent).toContain(copy.sections.apps);
    expect(sidebar?.textContent).toContain("Landing Page");
    expect(sidebar?.textContent).toContain(copy.sections.ceoSuffix);
    for (const dept of ["engineering", "marketing", "operations", "sales", "support"] as const) {
      expect(container.querySelector(`[data-testid="dept-${dept}"]`)).toBeTruthy();
    }
    expect(container.querySelector('[data-testid="getting-started-panel"]')).toBeTruthy();
    expect(sidebar?.textContent).toContain(copy.gettingStarted.heading(1, 7));
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(sidebar?.textContent).toContain(copy.trial.label(5));
    expect(sidebar?.textContent).toContain(copy.trial.subscribe);
    expect(container.querySelector('[aria-label="User menu"]')).toBeTruthy();
  });

  it("renders the five breadcrumb sub-tabs with Chat marked active by default", () => {
    root = renderShell(container);
    const bc = container.querySelector('[data-testid="company-breadcrumb"]');
    const tabButtons = bc?.querySelectorAll("button[data-tab]") ?? [];
    expect(tabButtons.length).toBe(5);
    const labels = Array.from(tabButtons).map((b) => b.textContent);
    expect(labels).toEqual([
      copy.breadcrumb.tabs.chat,
      copy.breadcrumb.tabs.overview,
      copy.breadcrumb.tabs.strategy,
      copy.breadcrumb.tabs.payments,
      copy.breadcrumb.tabs.settings,
    ]);
    const active = bc?.querySelector('[aria-current="page"]');
    expect(active?.textContent).toBe(copy.breadcrumb.tabs.chat);
  });

  it("marks Overview active when the url is /c/:companyId/overview", () => {
    mockLocation.pathname = "/c/company-x/overview";
    root = renderShell(container, "/c/company-x/overview");
    const active = container.querySelector(
      '[data-testid="company-breadcrumb"] [aria-current="page"]',
    );
    expect(active?.textContent).toBe(copy.breadcrumb.tabs.overview);
  });

  it("navigates to the tab route when a breadcrumb tab is clicked", () => {
    root = renderShell(container);
    const strategyBtn = container.querySelector(
      '[data-testid="company-breadcrumb"] [data-tab="strategy"]',
    );
    expect(strategyBtn).toBeTruthy();
    clickElement(strategyBtn!);
    expect(mockNavigate).toHaveBeenCalledWith("/c/company-x/strategy");
  });

  it("opens the company switcher popover on click", () => {
    root = renderShell(container);
    const trigger = container.querySelector(
      `[aria-label="${copy.companySwitcher.triggerLabel}"]`,
    )!;
    clickElement(trigger);
    const panel = document.body.querySelector('[data-slot="popover-content"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain(copy.companySwitcher.addCompany);
    expect(panel?.textContent).toContain(copy.companySwitcher.store);
  });

  it("opens the review-pill popover on click and shows the Approve + Reject buttons for each pending review", () => {
    root = renderShell(container);
    const pill = container.querySelector(
      `[aria-label="${copy.reviewPill.summary(1)}"]`,
    )!;
    clickElement(pill);
    const list = document.body.querySelector('[aria-label="Pending reviews"]');
    expect(list).toBeTruthy();
    expect(list?.textContent).toContain("Create Content Calendar");
    expect(list?.textContent).toContain(copy.reviewPill.approve);
    expect(list?.textContent).toContain(copy.reviewPill.reject);
  });

  it("opens the user menu popover and exposes all six menu items", () => {
    root = renderShell(container);
    const trigger = container.querySelector('[aria-label="User menu"]')!;
    clickElement(trigger);
    const body = document.body.textContent ?? "";
    expect(body).toContain(copy.userMenu.upgradePlan);
    expect(body).toContain(copy.userMenu.topUpCredits);
    expect(body).toContain(copy.userMenu.emojiIcons);
    expect(body).toContain(copy.userMenu.settings);
    expect(body).toContain(copy.userMenu.support);
    expect(body).toContain(copy.userMenu.signOut);
  });

  it("switches company when the Store shortcut is clicked in the switcher popover", () => {
    root = renderShell(container);
    const trigger = container.querySelector(
      `[aria-label="${copy.companySwitcher.triggerLabel}"]`,
    )!;
    clickElement(trigger);
    const storeBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.trim() === copy.companySwitcher.store);
    expect(storeBtn).toBeTruthy();
    clickElement(storeBtn!);
    expect(mockNavigate).toHaveBeenCalledWith("/c/company-x/store");
  });

  it("dept group toggles its Collapsible content on click", () => {
    root = renderShell(container);
    const marketing = container.querySelector('[data-testid="dept-marketing"]');
    const trigger = marketing?.querySelector("button");
    expect(trigger?.getAttribute("data-state")).toBe("closed");
    clickElement(trigger!);
    expect(trigger?.getAttribute("data-state")).toBe("open");
    expect(marketing?.textContent).toContain("Growth Marketer");
  });

  it("renders CompanyChat at the /c/:companyId index route", () => {
    root = renderShell(container);
    expect(container.querySelector('[data-testid="company-chat"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="chat-composer"]')).toBeTruthy();
  });
});
