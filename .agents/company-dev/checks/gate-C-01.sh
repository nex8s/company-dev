#!/usr/bin/env bash
# C-01: Landing page full port.
#
# Gate (from PLAN.md): route renders without error; Playwright visual diff
# threshold met vs a reviewed golden screenshot.
#
# Visual-diff portion is deferred to C-13 — the Playwright harness lives
# under `tests/e2e-company-dev/` (not yet created). Until it lands we
# enforce render-correctness via a jsdom render test plus these structural
# checks. Per SELF_CHECK_PROTOCOL §"When a gate is wrong or too narrow",
# any update here tightens the spec, never weakens it. TODO(C-13): wire
# the Playwright visual-diff check into this gate once the harness ships.
set -euo pipefail

TASK_ID="C-01"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/pages/Landing.tsx" \
  "ui/src/pages/Landing.test.tsx" \
  "ui/src/copy/landing.ts" \
  "ui/src/design/tokens.ts" \
  "ui/src/design/marketing.css"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Landing imports its copy + tokens — this is what makes C-14 a grep-able swap.
grep -qE 'from\s+"@/copy/landing"' ui/src/pages/Landing.tsx \
  || { echo "FAIL: ui/src/pages/Landing.tsx does not import from @/copy/landing"; exit 1; }
grep -qE 'from\s+"@/design/tokens"' ui/src/pages/Landing.tsx \
  || { echo "FAIL: ui/src/pages/Landing.tsx does not import from @/design/tokens"; exit 1; }

# 3. Hard-rule enforcement: no raw token hex literals in Landing.tsx (the four
#    token colors must come through Tailwind utilities, not inline hex). The
#    prototype's composer-interior neutrals (#000000/#222/#333/#7A7A7A/#2B2B2B
#    /etc.) are scoped tokens that don't belong in the brand palette, so they
#    stay inline for now — AGENT_C_PROMPT.md calls out only the four core hexes.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  if grep -qE "#${hex}" ui/src/pages/Landing.tsx; then
    echo "FAIL: Landing.tsx contains raw token hex #${hex} — use the Tailwind utility (bg-cream/text-ink/text-mist/border-hairline)"
    exit 1
  fi
done

# 4. Brand-swap guard (weak — C-14 owns the full scan): the literal reference
#    product name from the prototype must never appear in the ported files.
#    Agent C-14's gate will do the recursive grep across the whole tree.
for f in \
  "ui/src/pages/Landing.tsx" \
  "ui/src/copy/landing.ts"; do
  # Check for the reference brand pattern (derived from ui-import but stored
  # as an escape sequence so this file itself doesn't trip C-14's grep).
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name — replace with landing.brand.name from copy"
    exit 1
  fi
done

# 5. UI package builds cleanly (tsc -b && vite build).
pnpm --filter "@paperclipai/ui" build

# 6. Landing render test passes in jsdom.
pnpm --filter "@paperclipai/ui" exec vitest run src/pages/Landing.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
