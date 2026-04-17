// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store as copy } from "@/copy/store";
import { Store } from "./Store";

/**
 * C-08 gate: Store grid renders all seeded templates from the typed mock,
 * segment + category filters narrow the grid, the Get button fires the
 * install mutation and navigates to the new company's chat view.
 */

const mockNavigate = vi.fn();
const mockLocation = {
  pathname: "/c/company-x/store",
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

function render(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/c/company-x/store"]}>
          <Routes>
            <Route path="c/:companyId/store" element={<Store />} />
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

/**
 * JSDOM's CSS attribute-selector parser chokes on the `&` character that
 * appears in our category labels (e.g. "Agency & Services"). Look up via
 * a Array.from + find on the data-attribute instead.
 */
function findRailItem(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll("[data-rail-item]")).find(
    (e) => e.getAttribute("data-rail-item") === label,
  );
}

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("Store (C-08)", () => {
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

  it("renders the page header with title, subtitle, and the 4-button segment toggle", () => {
    root = render(container);
    const header = container.querySelector('[data-testid="store-header"]');
    expect(header?.textContent).toContain(copy.page.title);
    expect(header?.textContent).toContain(copy.page.subtitle);
    const segments = container.querySelectorAll('[data-testid="store-segment"] button[data-segment]');
    expect(segments.length).toBe(4);
    expect(Array.from(segments).map((b) => b.getAttribute("data-segment"))).toEqual([
      "all",
      "business",
      "employee",
      "myProfile",
    ]);
    // "All" is selected by default.
    expect(segments[0].getAttribute("aria-selected")).toBe("true");
  });

  it("renders the filter rail with both Business Categories and Employee Departments groups", () => {
    root = render(container);
    const rail = container.querySelector('[data-testid="store-rail"]');
    expect(rail?.textContent).toContain(copy.rail.businessHeading);
    expect(rail?.textContent).toContain(copy.rail.employeeHeading);
    expect(rail?.textContent).toContain(copy.rail.allBusinesses);
    expect(rail?.textContent).toContain(copy.rail.allEmployees);
    // A representative category from each group is present.
    expect(rail?.textContent).toContain("Agency & Services");
    expect(rail?.textContent).toContain("Marketing & Growth");
  });

  it("renders all 6 seeded templates as cards with category + Get button + employee/download metadata", () => {
    root = render(container);
    const grid = container.querySelector('[data-testid="store-grid"]');
    expect(grid).toBeTruthy();
    const cards = grid?.querySelectorAll('li[data-testid^="store-card-"]') ?? [];
    expect(cards.length).toBe(6);

    // Spot-check the SMMA card matches the seed contract.
    const smma = container.querySelector('[data-testid="store-card-smma"]');
    expect(smma).toBeTruthy();
    expect(smma?.getAttribute("data-template-kind")).toBe("business");
    expect(smma?.textContent).toContain("SMMA (Social Media Marketing)");
    expect(smma?.textContent).toContain("Agency & Services");
    expect(smma?.textContent).toContain(copy.grid.creatorLabel("Company.dev"));
    expect(smma?.querySelector('[data-testid="get-smma"]')).toBeTruthy();
    expect(smma?.textContent).toContain(copy.grid.getCta);
  });

  it("filters the grid by category when a rail item is clicked", () => {
    root = render(container);
    let cards = container.querySelectorAll(
      '[data-testid="store-grid"] li[data-testid^="store-card-"]',
    );
    expect(cards.length).toBe(6);

    const agencyItem = findRailItem(container, "Agency & Services");
    expect(agencyItem).toBeTruthy();
    clickElement(agencyItem!);

    cards = container.querySelectorAll(
      '[data-testid="store-grid"] li[data-testid^="store-card-"]',
    );
    // SMMA + Dev Agency are the two seeds in Agency & Services.
    expect(cards.length).toBe(2);
    const slugs = Array.from(cards).map((c) =>
      c.getAttribute("data-testid")?.replace("store-card-", ""),
    );
    expect(new Set(slugs)).toEqual(new Set(["smma", "dev-agency"]));
  });

  it("clearing the category back to All Businesses restores the full grid", () => {
    root = render(container);
    clickElement(findRailItem(container, "Agency & Services")!);
    expect(
      container.querySelectorAll('[data-testid="store-grid"] li[data-testid^="store-card-"]').length,
    ).toBe(2);
    clickElement(findRailItem(container, "All Businesses")!);
    expect(
      container.querySelectorAll('[data-testid="store-grid"] li[data-testid^="store-card-"]').length,
    ).toBe(6);
  });

  it("renders the empty-grid state when a segment + category yields no templates (Employees segment, no employee seeds)", () => {
    root = render(container);
    const employees = container.querySelector('[data-segment="employee"]');
    clickElement(employees!);
    expect(container.querySelector('[data-testid="store-grid-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="store-grid"]')).toBeNull();
  });

  it("clicking Get fires the install mutation and navigates to the new company's chat (C-08 gate)", async () => {
    root = render(container);
    const getBtn = container.querySelector('[data-testid="get-smma"]');
    expect(getBtn).toBeTruthy();
    clickElement(getBtn!);
    // Wait for the mutation's mocked 50ms delay + onSuccess callback.
    await flush(80);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const call = mockNavigate.mock.calls[0][0] as string;
    // The mock install returns `installed-:slug-:stamp`; we navigate to /c/:companyId.
    expect(call.startsWith("/c/installed-smma-")).toBe(true);
  });

  it("Get button shows the installing label while the mutation is pending", async () => {
    root = render(container);
    const getBtn = container.querySelector(
      '[data-testid="get-smma"]',
    ) as HTMLButtonElement | null;
    expect(getBtn?.textContent).toBe(copy.grid.getCta);
    clickElement(getBtn!);
    // Mid-flight: mutation is still pending; the SMMA button should swap label.
    await flush(0);
    const midBtn = container.querySelector(
      '[data-testid="get-smma"]',
    ) as HTMLButtonElement | null;
    expect(midBtn?.textContent).toBe(copy.grid.installingCta);
    expect(midBtn?.disabled).toBe(true);
    // Other cards' Get buttons should NOT be disabled (only the clicked one is mid-install).
    const otherBtn = container.querySelector(
      '[data-testid="get-faceless-youtube"]',
    ) as HTMLButtonElement | null;
    expect(otherBtn?.disabled).toBe(false);
    expect(otherBtn?.textContent).toBe(copy.grid.getCta);
    await flush(80);
  });
});
