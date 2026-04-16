/**
 * Tailwind theme extensions for Company.dev's marketing + app chrome.
 *
 * Tailwind v4 loads its theme CSS-first via `@theme` directives in
 * `src/index.css`, but v4 still supports legacy JS config via `@config`.
 * We keep this JS config as the canonical place for Company.dev tokens so
 * the spec in `docs/company-dev/PLAN.md` (C-02) holds literally and so the
 * typed source-of-truth in `src/design/tokens.ts` powers both Tailwind
 * utilities and programmatic consumers.
 *
 * `src/index.css` pulls this file via `@config "../tailwind.config.ts";`.
 */

import { animation, colors, fontFamily, keyframes } from "./src/design/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ...colors },
      fontFamily: { ...fontFamily },
      animation: { ...animation },
      keyframes: { ...keyframes },
    },
  },
};
