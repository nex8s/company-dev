// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyTabs as copy } from "@/copy/company-tabs";
import { CompanyStrategy } from "./Strategy";

vi.mock("@/lib/router", async () => {
  const rrd = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...rrd,
    Link: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
    useLocation: () => ({ pathname: "/c/company-x/strategy", search: "", hash: "" }),
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
      <MemoryRouter initialEntries={["/c/company-x/strategy"]}>
        <Routes>
          <Route path="c/:companyId/strategy" element={<CompanyStrategy />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return root;
}

describe("CompanyStrategy (C-05)", () => {
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

  it("renders the Positioning + Target Audience cards with CompanyProfile text", () => {
    root = render(container);
    const positioning = container.querySelector('[data-testid="strategy-positioning"]');
    const audience = container.querySelector('[data-testid="strategy-audience"]');
    expect(positioning).toBeTruthy();
    expect(audience).toBeTruthy();
    expect(positioning?.textContent).toContain(copy.strategy.positioningLabel);
    expect(audience?.textContent).toContain(copy.strategy.audienceLabel);
  });

  it("renders the Core Growth Strategy callout", () => {
    root = render(container);
    const core = container.querySelector('[data-testid="strategy-core"]');
    expect(core).toBeTruthy();
    expect(core?.textContent).toContain(copy.strategy.coreStrategyLabel);
  });

  it("renders the active plans section with at least one plan card", () => {
    root = render(container);
    const plans = container.querySelector('[data-testid="strategy-plans"]');
    expect(plans).toBeTruthy();
    expect(plans?.textContent).toContain(copy.strategy.activePlansHeading);
    expect(plans?.textContent).toContain("AI-Powered Newsletter Business Launch");
    expect(plans?.textContent).toContain(copy.strategy.planInProgressBadge);
    expect(plans?.textContent).toContain(copy.strategy.activeAgentsLabel(1));
  });

  it("renders the Goals empty state CTA when goalsCount is 0", () => {
    root = render(container);
    const empty = container.querySelector('[data-testid="strategy-goals-empty"]');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain(copy.strategy.goalsHeading);
    expect(empty?.textContent).toContain(copy.strategy.goalsCta);
  });
});
