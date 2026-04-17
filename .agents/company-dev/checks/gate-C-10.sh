#!/usr/bin/env bash
# C-10: Apps > Landing Page detail (Preview / Code / Deployments / Settings).
#
# Gate (PLAN.md): all four tabs render for a seeded App; editing an env
# var persists. Wired live to plugin-apps-builder's HTTP routes (B-02 +
# B-03). Settings tab issues PATCH and DELETE through React Query
# mutations and invalidates the env list on success.
set -euo pipefail

TASK_ID="C-10"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

for f in \
  "ui/src/api/plugin-apps-builder.ts" \
  "ui/src/copy/app-detail.ts" \
  "ui/src/pages/app-detail/AppDetail.tsx" \
  "ui/src/pages/app-detail/AppDetail.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

grep -qE 'from\s+"@/copy/app-detail"' ui/src/pages/app-detail/AppDetail.tsx \
  || { echo "FAIL: AppDetail does not import from @/copy/app-detail"; exit 1; }
grep -qE 'from\s+"@/api/plugin-apps-builder"' ui/src/pages/app-detail/AppDetail.tsx \
  || { echo "FAIL: AppDetail does not import from @/api/plugin-apps-builder"; exit 1; }

# Live wiring sanity — the page must call the actual API methods.
for fn in getApp getPreview listFiles listDeployments getEnv patchEnv deleteEnv; do
  grep -qE "pluginAppsBuilderApi\.${fn}" ui/src/pages/app-detail/AppDetail.tsx \
    || { echo "FAIL: AppDetail does not call pluginAppsBuilderApi.${fn}"; exit 1; }
done

# CompanyShell mounts the route + hides the breadcrumb on /apps/.
grep -qE 'path="apps/:appId' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell missing /apps/:appId route"; exit 1; }
grep -qE '/apps/' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: ShellBreadcrumbSlot has no /apps branch"; exit 1; }

# Brand-hex ban + reference-name guard.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in ui/src/pages/app-detail/*.tsx ui/src/copy/app-detail.ts ui/src/api/plugin-apps-builder.ts; do
    if grep -qE "#${hex}" "$f"; then
      echo "FAIL: $f contains raw brand hex #${hex}"; exit 1
    fi
  done
done
for f in ui/src/pages/app-detail/*.tsx ui/src/copy/app-detail.ts ui/src/api/plugin-apps-builder.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then echo "FAIL: $f contains the reference brand name"; exit 1; fi
done

pnpm --filter "@paperclipai/ui" build
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/app-detail/AppDetail.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
