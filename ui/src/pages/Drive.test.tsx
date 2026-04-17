// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drive as copy } from "@/copy/drive";
import { Drive } from "./Drive";

vi.mock("@/lib/router", async () => {
  const rrd = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...rrd,
    Link: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
    useLocation: () => ({ pathname: "/c/company-x/drive", search: "", hash: "" }),
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
      <MemoryRouter initialEntries={["/c/company-x/drive"]}>
        <Routes>
          <Route path="c/:companyId/drive" element={<Drive />} />
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

describe("Drive (C-07)", () => {
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

  it("renders the page with header (search + Upload) and the filter rail with All Files + 5 depts + Pending", () => {
    root = render(container);
    expect(container.querySelector('[data-testid="drive-view"]')).toBeTruthy();
    const header = container.querySelector('[data-testid="drive-header"]');
    expect(header?.textContent).toContain(copy.page.title);
    expect(header?.textContent).toContain(copy.page.uploadCta);
    const rail = container.querySelector('[data-testid="drive-rail"]');
    expect(rail).toBeTruthy();
    expect(rail?.textContent).toContain(copy.filter.allFiles);
    for (const dept of copy.departments) {
      expect(rail?.textContent).toContain(dept);
    }
    expect(rail?.textContent).toContain(copy.filter.pending);
  });

  it("shows the Pending counter badge with the count of pending_review files", () => {
    root = render(container);
    const pendingBtn = container.querySelector('[data-testid="drive-filter-pending"]');
    expect(pendingBtn?.textContent).toContain("1");
  });

  it("default All Files view shows the full table (one mock pending file)", () => {
    root = render(container);
    const allBtn = container.querySelector('[data-testid="drive-filter-all"]');
    expect(allBtn?.getAttribute("aria-current")).toBe("page");
    const table = container.querySelector('[data-testid="drive-table"]');
    expect(table).toBeTruthy();
    expect(
      container.querySelector('[data-testid="drive-file-file-content-cal"]'),
    ).toBeTruthy();
  });

  it("Pending tab filters to pending_review files only and shows the Pending Review badge", () => {
    root = render(container);
    clickElement(container.querySelector('[data-testid="drive-filter-pending"]')!);
    const row = container.querySelector('[data-testid="drive-file-file-content-cal"]');
    expect(row?.getAttribute("data-status")).toBe("pending_review");
    expect(row?.textContent).toContain(copy.table.pendingBadge);
  });

  it("Engineering tab shows the empty state when no files match", () => {
    root = render(container);
    clickElement(container.querySelector('[data-testid="drive-filter-engineering"]')!);
    expect(container.querySelector('[data-testid="drive-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="drive-table"]')).toBeNull();
  });

  it("Marketing tab shows the seeded mock content-calendar file", () => {
    root = render(container);
    clickElement(container.querySelector('[data-testid="drive-filter-marketing"]')!);
    const row = container.querySelector('[data-testid="drive-file-file-content-cal"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("Growth Marketer");
    expect(row?.textContent).toContain("Marketing");
  });
});
