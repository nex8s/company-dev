// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyTabs as copy } from "@/copy/company-tabs";
import { CompanySettingsTab } from "./Settings";

/**
 * C-05 Settings gate: renders the outer heading + inner tab strip, lets
 * us navigate between inner tabs, shows the A-02 CompanyProfile fields
 * on General, and renders a placeholder for each not-yet-ready B-task.
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

function render(container: HTMLElement, initial = mockLocation.pathname) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="c/:companyId/settings/*" element={<CompanySettingsTab />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return root;
}

function clickElement(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

describe("CompanySettingsTab (C-05)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    mockNavigate.mockReset();
    mockLocation.pathname = "/c/company-x/settings";
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

  it("renders the heading + 6-button inner tab strip", () => {
    root = render(container);
    expect(container.textContent).toContain(copy.settings.heading);
    const strip = container.querySelector('[data-testid="settings-inner-tabs"]');
    expect(strip).toBeTruthy();
    const buttons = strip?.querySelectorAll("button[data-tab]") ?? [];
    expect(buttons.length).toBe(6);
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual([
      copy.settings.tabs.general,
      copy.settings.tabs.billing,
      copy.settings.tabs.team,
      copy.settings.tabs.usage,
      copy.settings.tabs.server,
      copy.settings.tabs.publishing,
    ]);
  });

  it("marks General active at the base /settings url and renders the General panel", () => {
    root = render(container);
    const active = container.querySelector(
      '[data-testid="settings-inner-tabs"] [aria-current="page"]',
    );
    expect(active?.textContent).toBe(copy.settings.tabs.general);
    expect(container.querySelector('[data-testid="settings-general"]')).toBeTruthy();
  });

  it("renders the A-02 CompanyProfile fields inside General: name + description + two toggles + danger zone", () => {
    root = render(container);
    const general = container.querySelector('[data-testid="settings-general"]');
    expect(general?.textContent).toContain(copy.settings.general.profileHeading);
    expect(general?.textContent).toContain(copy.settings.general.nameLabel);
    expect(general?.textContent).toContain(copy.settings.general.descLabel);
    const nameInput = general?.querySelector("input#co-name") as HTMLInputElement | null;
    expect(nameInput?.defaultValue).toBe("company x");
    expect(container.querySelector('[data-testid="settings-toggle-approval"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="settings-toggle-incorporated"]')).toBeTruthy();
    const danger = container.querySelector('[data-testid="settings-danger-zone"]');
    expect(danger).toBeTruthy();
    expect(danger?.textContent).toContain(copy.settings.general.dangerZone.heading);
    expect(danger?.textContent).toContain(
      copy.settings.general.dangerZone.cta("company x"),
    );
  });

  it("navigates to /settings/billing when the Billing tab is clicked", () => {
    root = render(container);
    const billing = container.querySelector(
      '[data-testid="settings-inner-tabs"] [data-tab="billing"]',
    )!;
    clickElement(billing);
    expect(mockNavigate).toHaveBeenCalledWith("/c/company-x/settings/billing");
  });

  it("renders a placeholder when the active path is a stub tab (billing)", () => {
    mockLocation.pathname = "/c/company-x/settings/billing";
    root = render(container, "/c/company-x/settings/billing");
    expect(
      container.querySelector('[data-testid="settings-billing-placeholder"]'),
    ).toBeTruthy();
  });
});
