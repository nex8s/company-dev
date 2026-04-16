/**
 * Design tokens — single source of truth for Company.dev's marketing and
 * app-chrome visual system. Ported from the reference design in
 * `ui-import/landing.html`; see `ui-import/README.md` for the porting rules
 * and `docs/company-dev/ARCHITECTURE.md` for where these land in the stack.
 *
 * Consumed by:
 *   - `ui/tailwind.config.ts` — generates `bg-cream`, `text-ink`, `font-display`, etc.
 *   - Any component that needs programmatic access (inline SVG fills,
 *     `<meta name="theme-color">`, Playwright visual-diff assertions).
 */

export const colors = {
  /** Cream page background — landing, marketing chrome, auth shells. */
  cream: "#FBF9F6",
  /** Warm near-black hero text — slightly softer than pure black. */
  ink: "#1A1A1A",
  /** Muted secondary text — nav links, meta, captions. */
  mist: "#6E6E6E",
  /** Hairline borders, dividers, and subtle card outlines. */
  hairline: "#E5E5E5",
} as const;

export type ColorToken = keyof typeof colors;

export const fontFamily = {
  /** Pixel display face — hero headlines, section titles. */
  display: ["DotGothic16", "monospace"],
  /** Geometric sans — body, nav, UI chrome. */
  sans: ["Geist", "system-ui", "sans-serif"],
};

export const animation = {
  "cloud-glide": "cloud-glide 75s ease-in-out infinite",
  marquee: "marquee 40s linear infinite",
};

export const keyframes = {
  "cloud-glide": {
    "0%, 100%": { transform: "translateX(0)" },
    "50%": { transform: "translateX(-2%)" },
  },
  marquee: {
    "0%": { transform: "translateX(0)" },
    "100%": { transform: "translateX(-50%)" },
  },
};

/** Google Fonts href loading DotGothic16 + Geist 300/400/500/600. */
export const fontsHref =
  "https://fonts.googleapis.com/css2?family=DotGothic16&family=Geist:wght@300;400;500;600&display=swap";
