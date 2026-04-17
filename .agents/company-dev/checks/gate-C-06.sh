#!/usr/bin/env bash
# C-06: Tasks (kanban) view.
#
# Gate (from PLAN.md): create a pending-review task → appears in Needs Review
# column → Approve clears it. The kanban renders four columns; Needs Review
# is wired live to A-06.5's `GET /companies/:companyId/plugin-company/reviews/pending`
# endpoint, and Approve / Reject post to the matching decide endpoints.
# In Progress / Queued / Completed are typed-mock stubs flagged with the
# A-08 swap point; that's intentional per the C-06 scope.
#
# Drag-and-drop is "optional" per PLAN.md and is not in this gate. The
# Playwright happy-path lands with C-13's harness.
set -euo pipefail

TASK_ID="C-06"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/copy/company-tasks.ts" \
  "ui/src/hooks/useCompanyTasksData.ts" \
  "ui/src/api/plugin-company.ts" \
  "ui/src/pages/company-tabs/Tasks.tsx" \
  "ui/src/pages/company-tabs/Tasks.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Required imports / wiring.
grep -qE 'from\s+"@/copy/company-tasks"' ui/src/pages/company-tabs/Tasks.tsx \
  || { echo "FAIL: Tasks page does not import from @/copy/company-tasks"; exit 1; }
grep -qE 'from\s+"@/hooks/useCompanyTasksData"' ui/src/pages/company-tabs/Tasks.tsx \
  || { echo "FAIL: Tasks page does not import from @/hooks/useCompanyTasksData"; exit 1; }
grep -qE 'from\s+"@/api/plugin-company"' ui/src/hooks/useCompanyTasksData.ts \
  || { echo "FAIL: tasks hook does not import the plugin-company API client"; exit 1; }

# 3. The hook actually wires useQuery against the live endpoint (no
#    placeholder return; this catches a "stub everything" regression).
grep -qE 'pluginCompanyApi\.listPendingReviews' ui/src/hooks/useCompanyTasksData.ts \
  || { echo "FAIL: hook does not call listPendingReviews"; exit 1; }
grep -qE 'pluginCompanyApi\.approveReview' ui/src/hooks/useCompanyTasksData.ts \
  || { echo "FAIL: hook does not wire approveReview"; exit 1; }
grep -qE 'pluginCompanyApi\.rejectReview' ui/src/hooks/useCompanyTasksData.ts \
  || { echo "FAIL: hook does not wire rejectReview"; exit 1; }

# 4. CompanyShell mounts the Tasks route + hides the breadcrumb on /tasks.
grep -qE 'path="tasks"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell is missing the tasks <Route>"; exit 1; }
grep -qE 'ShellBreadcrumbSlot' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not delegate the breadcrumb through ShellBreadcrumbSlot"; exit 1; }

# 5. Brand-hex ban — same as C-01 / C-03 / C-04 / C-05.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in \
    ui/src/pages/company-tabs/Tasks.tsx \
    ui/src/copy/company-tasks.ts \
    ui/src/hooks/useCompanyTasksData.ts \
    ui/src/api/plugin-company.ts; do
    if grep -qE "#${hex}" "$f"; then
      echo "FAIL: $f contains raw brand hex #${hex} — use the Tailwind utility"
      exit 1
    fi
  done
done

# 6. Reference-brand-name local guard.
for f in \
  ui/src/pages/company-tabs/Tasks.tsx \
  ui/src/copy/company-tasks.ts \
  ui/src/hooks/useCompanyTasksData.ts \
  ui/src/api/plugin-company.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name"
    exit 1
  fi
done

# 7. UI package builds cleanly.
pnpm --filter "@paperclipai/ui" build

# 8. Tests — Tasks contract tests + the existing CompanyShell tests
#    (which now include the C-06 sidebar-nav + breadcrumb-hide assertions).
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/company-tabs/Tasks.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
