#!/usr/bin/env bash
# C-08: Store view (template grid + Get install flow).
#
# Gate (from PLAN.md): click Get on a seeded template → new company
# created → redirects to its Chat view. Today the install path is a
# typed mock that returns an `InstallTemplateResponse` shaped exactly
# like the real `installTemplate` transaction (B-05) — plugin-store
# has no HTTP routes mounted yet (see ui/src/api/plugin-store.ts
# header). The redirect step is verified end-to-end against the
# mock response. When the HTTP routes ship, swap the hook's data and
# install function — the page contract does not change.
set -euo pipefail

TASK_ID="C-08"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/api/plugin-store.ts" \
  "ui/src/copy/store.ts" \
  "ui/src/hooks/useStoreData.ts" \
  "ui/src/pages/Store.tsx" \
  "ui/src/pages/Store.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Required imports / wiring.
grep -qE 'from\s+"@/copy/store"' ui/src/pages/Store.tsx \
  || { echo "FAIL: Store page does not import from @/copy/store"; exit 1; }
grep -qE 'from\s+"@/hooks/useStoreData"' ui/src/pages/Store.tsx \
  || { echo "FAIL: Store page does not import from @/hooks/useStoreData"; exit 1; }

# 3. The hook references the API wrapper's types (catches accidental
#    decoupling that would let the wire shape drift from B-04 / B-05).
grep -qE 'from\s+"@/api/plugin-store"' ui/src/hooks/useStoreData.ts \
  || { echo "FAIL: useStoreData does not import from @/api/plugin-store"; exit 1; }

# 4. CompanyShell mounts the /store route + hides the breadcrumb on /store.
grep -qE 'path="store"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell is missing the /store <Route>"; exit 1; }
grep -qE '/store' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell ShellBreadcrumbSlot has no /store branch"; exit 1; }

# 5. Sidebar Store nav button is wired to navigate (not a static stub).
grep -qE 'navigate\(`/c/\$\{companyId\}/store`\)' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell sidebar Store button is not wired to /store"; exit 1; }

# 6. Brand-hex ban — same as the rest of the C-tasks.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in \
    ui/src/pages/Store.tsx \
    ui/src/copy/store.ts \
    ui/src/hooks/useStoreData.ts \
    ui/src/api/plugin-store.ts; do
    if grep -qE "#${hex}" "$f"; then
      echo "FAIL: $f contains raw brand hex #${hex} — use the Tailwind utility"
      exit 1
    fi
  done
done

# 7. Reference-brand-name local guard.
for f in \
  ui/src/pages/Store.tsx \
  ui/src/copy/store.ts \
  ui/src/hooks/useStoreData.ts \
  ui/src/api/plugin-store.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name"
    exit 1
  fi
done

# 8. UI package builds cleanly.
pnpm --filter "@paperclipai/ui" build

# 9. Tests — Store contract tests + the C-08 sidebar-nav + breadcrumb-hide
#    assertions in CompanyShell.
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/Store.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
