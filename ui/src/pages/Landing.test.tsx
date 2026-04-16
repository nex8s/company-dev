// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { landing } from "@/copy/landing";
import { Landing } from "./Landing";

/**
 * C-01 render contract: Landing mounts in jsdom without throwing and every
 * user-facing string declared in `src/copy/landing.ts` reaches the DOM.
 *
 * Visual-diff assertion (per PLAN.md C-01: "Playwright visual diff threshold
 * met vs a reviewed golden screenshot") is deferred to C-13 when the
 * Playwright harness lands under `tests/e2e-company-dev/`. Until then this
 * jsdom smoke + the copy-presence contract is what the gate enforces.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Landing (C-01)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render() {
    act(() => {
      root.render(<Landing />);
    });
  }

  it("mounts without throwing", () => {
    expect(render).not.toThrow();
    expect(container.querySelector("main#main-content")).toBeTruthy();
  });

  it("renders the hero headline and subheadline from copy", () => {
    render();
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe(landing.hero.headline);
    expect(container.textContent).toContain(landing.hero.subheadline);
  });

  it("renders the six nav links with their copy strings", () => {
    render();
    const nav = container.querySelector("nav");
    expect(nav).toBeTruthy();
    const linkTexts = Array.from(nav?.querySelectorAll("a") ?? []).map(
      (a) => a.textContent,
    );
    expect(linkTexts).toEqual([
      landing.nav.home,
      landing.nav.templates,
      landing.nav.enterprise,
      landing.nav.pricing,
      landing.nav.accelerator,
      landing.nav.resources,
    ]);
  });

  it("renders log in + get started CTAs in the header", () => {
    render();
    const header = container.querySelector("header");
    expect(header?.textContent).toContain(landing.auth.logIn);
    expect(header?.textContent).toContain(landing.auth.getStarted);
  });

  it("renders the black composer with the two mode pills and the send button", () => {
    render();
    expect(container.textContent).toContain(landing.composer.exampleEmphasis);
    expect(container.textContent).toContain(landing.composer.modeBuild);
    expect(container.textContent).toContain(landing.composer.modeAutomate);
    expect(container.querySelector(`[aria-label="${landing.composer.sendLabel}"]`)).toBeTruthy();
    expect(container.querySelector(`[aria-label="${landing.composer.attachLabel}"]`)).toBeTruthy();
  });

  it("renders the ambient cloud graphic layers (bg-lines, dot-matrix, bg-glow)", () => {
    render();
    expect(container.querySelector(".bg-lines")).toBeTruthy();
    expect(container.querySelector(".dot-matrix.mask-cloud-left")).toBeTruthy();
    expect(container.querySelector(".dot-matrix.mask-cloud-right")).toBeTruthy();
    expect(container.querySelector(".bg-glow")).toBeTruthy();
    expect(container.querySelector(".animate-cloud-glide")).toBeTruthy();
  });

  it("shows the dev-preview banner until C-14 runs", () => {
    render();
    const banner = container.querySelector('[role="status"]');
    expect(banner?.textContent).toContain(landing.devPreview.label);
    expect(banner?.textContent).toContain(landing.devPreview.detail);
  });

  it("embeds the placeholder logo with an accessible label", () => {
    render();
    const logo = container.querySelector(`svg[aria-label="${landing.brand.logoAlt}"]`);
    expect(logo).toBeTruthy();
    // 26x18 footprint matches the prototype header layout.
    expect(logo?.getAttribute("width")).toBe("26");
    expect(logo?.getAttribute("height")).toBe("18");
  });

  it("loads the marketing Google Fonts stylesheet and theme-color meta", () => {
    render();
    // React 19 hoists <link rel="stylesheet"> only when `precedence` is set;
    // without it the link renders inline in the component tree. Either is
    // fine for our purposes — the token-driven href just has to reach the
    // document. Search both head and container.
    const link = document.querySelector('link[href*="DotGothic16"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toContain("Geist");
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute("content")).toBe("#FBF9F6");
  });
});
