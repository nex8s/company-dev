// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { companyTabs as copy } from "@/copy/company-tabs";
import { CompanyPayments } from "./Payments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("CompanyPayments (C-05)", () => {
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

  it("renders the Stripe empty state with title, body, and CTA", () => {
    root = createRoot(container);
    act(() => root!.render(<CompanyPayments />));
    const empty = container.querySelector('[data-testid="payments-stripe-empty"]');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain(copy.payments.emptyTitle);
    expect(empty?.textContent).toContain(copy.payments.emptyBody);
    expect(empty?.textContent).toContain(copy.payments.emptyCta);
  });
});
