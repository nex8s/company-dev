import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { animation, colors, fontFamily, fontsHref, keyframes } from "./tokens";

/**
 * Token values are contractually anchored to `ui-import/landing.html`.
 * If the prototype changes, either update both places or re-port properly
 * via C-01 — never drift silently.
 */

describe("design tokens", () => {
  it("exposes the four brand color tokens at their prototype values", () => {
    expect(colors).toEqual({
      cream: "#FBF9F6",
      ink: "#1A1A1A",
      mist: "#6E6E6E",
      hairline: "#E5E5E5",
    });
  });

  it("registers DotGothic16 as the display face and Geist as sans", () => {
    expect(fontFamily.display[0]).toBe("DotGothic16");
    expect(fontFamily.sans[0]).toBe("Geist");
  });

  it("exposes cloud-glide and marquee animations with matching keyframes", () => {
    expect(animation["cloud-glide"]).toContain("75s");
    expect(animation.marquee).toContain("40s");
    expect(keyframes["cloud-glide"]).toHaveProperty("50%");
    expect(keyframes.marquee).toHaveProperty("100%");
  });

  it("exposes a Google Fonts href loading both families", () => {
    expect(fontsHref).toContain("DotGothic16");
    expect(fontsHref).toContain("Geist");
  });
});

describe("tailwind.config.ts is wired to tokens.ts (C-02 contract)", () => {
  const cfgPath = resolve(__dirname, "../../tailwind.config.ts");
  const cfg = readFileSync(cfgPath, "utf8");

  it("imports color/font/animation/keyframe tokens from ./src/design/tokens", () => {
    expect(cfg).toMatch(/from\s+["']\.\/src\/design\/tokens["']/);
    expect(cfg).toContain("colors");
    expect(cfg).toContain("fontFamily");
    expect(cfg).toContain("animation");
    expect(cfg).toContain("keyframes");
  });
});

describe("Landing.tsx imports tokens (C-02 gate contract)", () => {
  const landingPath = resolve(__dirname, "../pages/Landing.tsx");
  const landing = readFileSync(landingPath, "utf8");

  it("imports from @/design/tokens", () => {
    expect(landing).toMatch(
      /import\s+\{[^}]*\}\s+from\s+["']@\/design\/tokens["']/,
    );
  });
});
