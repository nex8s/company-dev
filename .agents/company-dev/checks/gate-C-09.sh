#!/usr/bin/env bash
# C-09: Team > Employee detail page (9-tab parameterized view).
#
# Gate (from PLAN.md): each tab renders for CEO and a department agent
# without error; content comes from live API where one exists. CEO variant
# hides Browser / Phone / Virtual Cards (3 tabs → 6 visible). Dept variant
# shows all 9. Virtual Cards is the one tab with a live HTTP endpoint today
# (plugin-identity bank routes, B-13). Browser / Phone / Inbox use typed
# mocks that mirror the provider contract shape; the corresponding HTTP
# endpoints are scheduled for a later B-task.
set -euo pipefail

TASK_ID="C-09"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/api/plugin-identity.ts" \
  "ui/src/copy/employee-detail.ts" \
  "ui/src/hooks/useEmployeeDetailData.ts" \
  "ui/src/pages/employee/EmployeeDetail.tsx" \
  "ui/src/pages/employee/VirtualCardsTab.tsx" \
  "ui/src/pages/employee/EmployeeDetail.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Required imports / wiring.
grep -qE 'from\s+"@/copy/employee-detail"' ui/src/pages/employee/EmployeeDetail.tsx \
  || { echo "FAIL: EmployeeDetail does not import from @/copy/employee-detail"; exit 1; }
grep -qE 'from\s+"@/hooks/useEmployeeDetailData"' ui/src/pages/employee/EmployeeDetail.tsx \
  || { echo "FAIL: EmployeeDetail does not import from @/hooks/useEmployeeDetailData"; exit 1; }
grep -qE 'from\s+"@/api/plugin-identity"' ui/src/hooks/useEmployeeDetailData.ts \
  || { echo "FAIL: employee hook does not import the plugin-identity API client"; exit 1; }

# 3. The hook actually wires useQuery + mutations against the live bank
#    endpoint (catches a "stub everything" regression).
grep -qE 'pluginIdentityApi\.listAgentCards' ui/src/hooks/useEmployeeDetailData.ts \
  || { echo "FAIL: hook does not call listAgentCards"; exit 1; }
grep -qE 'pluginIdentityApi\.issueAgentCard' ui/src/hooks/useEmployeeDetailData.ts \
  || { echo "FAIL: hook does not wire issueAgentCard"; exit 1; }
grep -qE 'pluginIdentityApi\.freezeAgentCard' ui/src/hooks/useEmployeeDetailData.ts \
  || { echo "FAIL: hook does not wire freezeAgentCard"; exit 1; }

# 4. CompanyShell mounts the /team/:agentId route and hides the
#    breadcrumb for it.
grep -qE 'path="team/:agentId' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell is missing the /team/:agentId <Route>"; exit 1; }
grep -qE '/team/' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell ShellBreadcrumbSlot is not hiding the breadcrumb on /team/"; exit 1; }

# 5. Brand-hex ban.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in \
    ui/src/pages/employee/*.tsx \
    ui/src/copy/employee-detail.ts \
    ui/src/hooks/useEmployeeDetailData.ts \
    ui/src/api/plugin-identity.ts; do
    if grep -qE "#${hex}" "$f"; then
      echo "FAIL: $f contains raw brand hex #${hex} — use the Tailwind utility"
      exit 1
    fi
  done
done

# 6. Reference-brand-name local guard.
for f in \
  ui/src/pages/employee/*.tsx \
  ui/src/copy/employee-detail.ts \
  ui/src/hooks/useEmployeeDetailData.ts \
  ui/src/api/plugin-identity.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name"
    exit 1
  fi
done

# 7. UI package builds cleanly.
pnpm --filter "@paperclipai/ui" build

# 8. Tests — the employee detail file (CEO variant hides 3 tabs, each tab
#    mounts, virtual cards wire hits the live endpoint), plus CompanyShell
#    which now includes C-09 sidebar-agent + breadcrumb-hide assertions.
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/employee/EmployeeDetail.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
