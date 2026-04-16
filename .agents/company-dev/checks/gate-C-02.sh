#!/usr/bin/env bash
# C-02: Design tokens + Tailwind theme.
#
# Gate (from PLAN.md): `pnpm --filter @paperclipai/ui build` succeeds; token
# file exists and is imported by Landing.
#
# This script enforces that plus the typed-token / Tailwind-config wiring
# that makes C-02 actually mean something for downstream tasks. Only tightens
# the spec, never loosens it (see SELF_CHECK_PROTOCOL.md §"When a gate is wrong").
set -euo pipefail

TASK_ID="C-02"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/tailwind.config.ts" \
  "ui/src/design/tokens.ts" \
  "ui/src/design/marketing.css" \
  "ui/src/pages/Landing.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. tailwind.config.ts imports from the token source of truth.
grep -qE 'from\s+"\./src/design/tokens"' ui/tailwind.config.ts \
  || { echo "FAIL: ui/tailwind.config.ts does not import from ./src/design/tokens"; exit 1; }

# 3. index.css wires the JS config in (Tailwind v4 @config directive) AND
#    pulls in the marketing utility CSS. Without these, the tokens never
#    reach the built stylesheet.
grep -qE '@config\s+"\.\./tailwind\.config\.ts"' ui/src/index.css \
  || { echo "FAIL: ui/src/index.css is missing '@config \"../tailwind.config.ts\"'"; exit 1; }
grep -qE '@import\s+"\./design/marketing\.css"' ui/src/index.css \
  || { echo "FAIL: ui/src/index.css is missing '@import \"./design/marketing.css\"'"; exit 1; }

# 4. Landing imports tokens — the literal contract from PLAN.md.
grep -qE 'from\s+"@/design/tokens"' ui/src/pages/Landing.tsx \
  || { echo "FAIL: ui/src/pages/Landing.tsx does not import from @/design/tokens"; exit 1; }

# 5. Token file pins the prototype values. Drift here silently breaks the
#    visual system; fail loudly instead.
grep -q '"#FBF9F6"' ui/src/design/tokens.ts \
  || { echo "FAIL: cream token (#FBF9F6) missing from tokens.ts"; exit 1; }
grep -q '"#1A1A1A"' ui/src/design/tokens.ts \
  || { echo "FAIL: ink token (#1A1A1A) missing from tokens.ts"; exit 1; }
grep -q '"#6E6E6E"' ui/src/design/tokens.ts \
  || { echo "FAIL: mist token (#6E6E6E) missing from tokens.ts"; exit 1; }
grep -q '"#E5E5E5"' ui/src/design/tokens.ts \
  || { echo "FAIL: hairline token (#E5E5E5) missing from tokens.ts"; exit 1; }

# 6. UI package builds cleanly (tsc -b && vite build).
pnpm --filter "@paperclipai/ui" build

# 7. Token tests pass.
pnpm --filter "@paperclipai/ui" exec vitest run src/design/tokens.test.ts

echo "▶ gate-${TASK_ID}: all checks passed"
