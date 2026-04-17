#!/usr/bin/env bash
# C-05: Company > Overview / Strategy / Payments / Settings tabs.
#
# Gate (from PLAN.md): the four sub-tabs inside the company shell
# breadcrumb mount, render their reference-prototype layout, and the
# Settings inner tab strip navigates between General / Billing / Team /
# Usage / Server / Publishing. General reads A-02 CompanyProfile fields;
# Payments shows the Stripe empty state; Overview shows KPIs + Stripe
# empty + AI usage; Strategy shows Positioning / Audience / Core Strategy
# + Active Plans + Goals empty.
#
# A-02 is merged (CompanyProfile columns exist). A-03 / A-05 / A-07 /
# B-07 / B-06 / B-10 stubs — the non-A-02 data in useCompanyTabsData is
# mock today and flagged with the task ID that will swap it to a useQuery.
set -euo pipefail

TASK_ID="C-05"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/copy/company-tabs.ts" \
  "ui/src/hooks/useCompanyTabsData.ts" \
  "ui/src/pages/company-tabs/Overview.tsx" \
  "ui/src/pages/company-tabs/Overview.test.tsx" \
  "ui/src/pages/company-tabs/Strategy.tsx" \
  "ui/src/pages/company-tabs/Strategy.test.tsx" \
  "ui/src/pages/company-tabs/Payments.tsx" \
  "ui/src/pages/company-tabs/Payments.test.tsx" \
  "ui/src/pages/company-tabs/Settings.tsx" \
  "ui/src/pages/company-tabs/Settings.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Each tab page imports copy from company-tabs and the shared data hook
#    where applicable (Payments is fully static — no hook).
for f in \
  "ui/src/pages/company-tabs/Overview.tsx" \
  "ui/src/pages/company-tabs/Strategy.tsx" \
  "ui/src/pages/company-tabs/Settings.tsx"; do
  grep -qE 'from\s+"@/copy/company-tabs"' "$f" \
    || { echo "FAIL: $f does not import from @/copy/company-tabs"; exit 1; }
  grep -qE 'from\s+"@/hooks/useCompanyTabsData"' "$f" \
    || { echo "FAIL: $f does not import from @/hooks/useCompanyTabsData"; exit 1; }
done
grep -qE 'from\s+"@/copy/company-tabs"' ui/src/pages/company-tabs/Payments.tsx \
  || { echo "FAIL: Payments does not import from @/copy/company-tabs"; exit 1; }

# 3. CompanyShell wires each of the four tabs to the right path.
for route in "overview" "strategy" "payments" "settings"; do
  grep -qE "path=\"${route}" ui/src/pages/CompanyShell.tsx \
    || { echo "FAIL: CompanyShell is missing the ${route} <Route>"; exit 1; }
done

# 4. Brand-hex ban — same as C-01/C-03/C-04. The brand swap will live in
#    Tailwind tokens; raw hex leakage in component code is a C-14 regression.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in ui/src/pages/company-tabs/*.tsx; do
    if grep -qE "#${hex}" "$f"; then
      echo "FAIL: $f contains raw brand hex #${hex} — use the Tailwind utility"
      exit 1
    fi
  done
done

# 5. Reference-brand-name local guard.
for f in \
  ui/src/pages/company-tabs/*.tsx \
  ui/src/copy/company-tabs.ts \
  ui/src/hooks/useCompanyTabsData.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name"
    exit 1
  fi
done

# 6. UI package builds cleanly.
pnpm --filter "@paperclipai/ui" build

# 7. Tests — the four new tab tests plus CompanyShell.test.tsx which
#    asserts the breadcrumb-tab navigation contract.
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/company-tabs/Overview.test.tsx \
  src/pages/company-tabs/Strategy.test.tsx \
  src/pages/company-tabs/Payments.test.tsx \
  src/pages/company-tabs/Settings.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
