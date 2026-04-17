// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyTabs as copy } from "@/copy/company-tabs";
import { CompanyOverview } from "./Overview";

/**
 * C-05 Overview gate: hero + 4 KPIs + revenue empty + AI usage + lists.
 * Re-uses the same router mock shape as CompanyShell.test.tsx.
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
    useLocation: () => ({ pathname: "/c/company-x/overview", search: "", hash: "" }),
    useNavigate: () => vi.fn(),
    useParams: () => ({ companyId: "company-x" }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function render(container: HTMLElement) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/c/company-x/overview"]}>
        <Routes>
          <Route path="c/:companyId/overview" element={<CompanyOverview />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return root;
}

describe("CompanyOverview (C-05)", () => {
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

  it("renders the hero with monogram, name, Active/Online badges, Configure + Chat CTAs", () => {
    root = render(container);
    const hero = container.querySelector('[data-testid="overview-hero"]');
    expect(hero).toBeTruthy();
    expect(hero?.textContent).toContain("company x");
    expect(hero?.textContent).toContain(copy.overview.hero.activeBadge);
    expect(hero?.textContent).toContain(copy.overview.hero.onlineLabel);
    expect(hero?.textContent).toContain(copy.overview.hero.configureCta);
    expect(hero?.textContent).toContain(copy.overview.hero.chatCta);
  });

  it("renders all four KPI cards: Team, Tasks, Credits, Approvals", () => {
    root = render(container);
    const kpis = container.querySelector('[data-testid="overview-kpis"]');
    expect(kpis).toBeTruthy();
    expect(kpis?.textContent).toContain(copy.overview.kpis.team);
    expect(kpis?.textContent).toContain(copy.overview.kpis.tasks);
    expect(kpis?.textContent).toContain(copy.overview.kpis.credits);
    expect(kpis?.textContent).toContain(copy.overview.kpis.approvals);
  });

  it("renders the Stripe revenue empty state (revenueConnected=false in mocks)", () => {
    root = render(container);
    const empty = container.querySelector(
      '[data-testid="overview-revenue-empty"]',
    );
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain(copy.overview.revenue.emptyTitle);
    expect(empty?.textContent).toContain(copy.overview.revenue.emptyCta);
  });

  it("renders the AI Usage card with spending label + breakdown", () => {
    root = render(container);
    const usage = container.querySelector('[data-testid="overview-ai-usage"]');
    expect(usage).toBeTruthy();
    expect(usage?.textContent).toContain(copy.overview.aiUsage.spendingLabel);
    expect(usage?.textContent).toContain(copy.overview.aiUsage.breakdownLabel);
    expect(usage?.textContent).toContain(copy.overview.aiUsage.chatTokensLabel);
  });

  it("renders the Team + Apps lists with View all link", () => {
    root = render(container);
    const team = container.querySelector('[data-testid="overview-team-list"]');
    const apps = container.querySelector('[data-testid="overview-apps-list"]');
    expect(team).toBeTruthy();
    expect(apps).toBeTruthy();
    expect(team?.textContent).toContain(copy.overview.lists.teamHeading);
    expect(apps?.textContent).toContain(copy.overview.lists.appsHeading);
    expect(team?.textContent).toContain(copy.overview.lists.viewAll);
    expect(team?.textContent).toContain("Landing Page Engineer");
    expect(apps?.textContent).toContain("Landing Page");
    expect(apps?.textContent).toContain("landing-page.vercel.app");
  });
});
