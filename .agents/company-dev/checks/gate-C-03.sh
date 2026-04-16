#!/usr/bin/env bash
# C-03: Company shell — sidebar + top breadcrumb + review-waiting pill +
# company switcher + user menu + Getting Started panel. Route /c/:companyId.
#
# Gate (PLAN.md): sidebar renders with all sections; all popovers open/close;
# switches company on select.
#
# A-04 (Getting Started checklist state machine) has not yet merged — the
# getting-started panel reads a hand-written mock keyed by step id. The
# swap points are all tagged `TODO(A-04 HTTP):` in `useCompanyShellData`.
# Same pattern for A-05 (pending reviews) and B-02 (apps list). Per
# SELF_CHECK_PROTOCOL §"Cross-agent blockers" the stub matches the intended
# interface, not a looser one, so swapping to useQuery will be literal.
set -euo pipefail

TASK_ID="C-03"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/pages/CompanyShell.tsx" \
  "ui/src/pages/CompanyShell.test.tsx" \
  "ui/src/copy/company-shell.ts" \
  "ui/src/hooks/useCompanyShellData.ts"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Shell imports copy + data hook + shared popover + collapsible primitives.
grep -qE 'from\s+"@/copy/company-shell"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not import from @/copy/company-shell"; exit 1; }
grep -qE 'from\s+"@/hooks/useCompanyShellData"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not import from @/hooks/useCompanyShellData"; exit 1; }
grep -qE 'from\s+"@/components/ui/popover"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not use the shared Popover primitive (@/components/ui/popover)"; exit 1; }
grep -qE 'from\s+"@/components/ui/collapsible"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not use the shared Collapsible primitive"; exit 1; }

# 3. App.tsx wires the /c/:companyId route before the :companyPrefix catch-all.
grep -qE 'path="c/:companyId/\*"\s+element=\{<CompanyShell' ui/src/App.tsx \
  || { echo "FAIL: ui/src/App.tsx is missing the /c/:companyId route for <CompanyShell>"; exit 1; }

# 4. Brand hex ban — same as C-01. The four brand tokens must reach
#    Landing/shell through Tailwind utilities, not inline hex.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  if grep -qE "#${hex}" ui/src/pages/CompanyShell.tsx; then
    echo "FAIL: CompanyShell.tsx contains raw brand hex #${hex} — use the Tailwind utility"
    exit 1
  fi
done

# 5. Reference-brand-name guard (C-14 owns the repo-wide scan; this is local).
for f in \
  "ui/src/pages/CompanyShell.tsx" \
  "ui/src/copy/company-shell.ts" \
  "ui/src/hooks/useCompanyShellData.ts"; do
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name — replace with copy strings"
    exit 1
  fi
done

# 6. UI package builds cleanly.
pnpm --filter "@paperclipai/ui" build

# 7. Shell render + popover + switcher tests pass in jsdom.
pnpm --filter "@paperclipai/ui" exec vitest run src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
