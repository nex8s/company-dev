#!/usr/bin/env bash
# A-08: custom dashboards — schema for DashboardPage + HTTP CRUD +
# render-data endpoint. Widget types: revenue (Stripe), ai-usage,
# team-status, task-kanban.
#
# Gate: create → list → render-data endpoint returns widget payload.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-08: starting"

# 1. Schema + migration + rollback.
SCHEMA="packages/db/src/schema/dashboard_pages.ts"
[[ -f "$SCHEMA" ]] || { echo "FAIL: $SCHEMA missing"; exit 1; }
grep -q 'export { dashboardPages }' packages/db/src/schema/index.ts \
  || { echo "FAIL: dashboardPages not re-exported from db schema index"; exit 1; }

UP_MIGRATION="$(ls packages/db/src/migrations/ | grep -E '^[0-9]{4}_.*\.sql$' | tail -n 1)"
grep -q 'CREATE TABLE "dashboard_pages"' "packages/db/src/migrations/$UP_MIGRATION" \
  || { echo "FAIL: latest migration does not create dashboard_pages"; exit 1; }

ROLLBACK="packages/db/src/rollbacks/${UP_MIGRATION%.sql}.down.sql"
[[ -f "$ROLLBACK" ]] || { echo "FAIL: rollback file $ROLLBACK missing"; exit 1; }
grep -q 'DROP TABLE IF EXISTS "dashboard_pages"' "$ROLLBACK" \
  || { echo "FAIL: rollback does not drop dashboard_pages"; exit 1; }

# 2. plugin-dashboards scaffold + required files.
PKG="packages/plugin-dashboards"
for f in "$PKG/package.json" "$PKG/tsconfig.json" "$PKG/vitest.config.ts" \
         "$PKG/src/index.ts" "$PKG/src/schema.ts" \
         "$PKG/src/pages/operations.ts" \
         "$PKG/src/widgets/resolvers.ts" \
         "$PKG/src/server/router.ts" "$PKG/src/server/schemas.ts" "$PKG/src/server/index.ts" \
         "$PKG/src/server/router.test.ts"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 3. Required API surface.
OPS="$PKG/src/pages/operations.ts"
for fn in createDashboardPage listDashboardPages getDashboardPage updateDashboardPage deleteDashboardPage; do
  grep -q "export async function $fn" "$OPS" \
    || { echo "FAIL: $fn not exported from $OPS"; exit 1; }
done

RES="$PKG/src/widgets/resolvers.ts"
grep -q "export async function resolveWidgets" "$RES" \
  || { echo "FAIL: resolveWidgets not exported"; exit 1; }
# All four widget types must have a resolver branch.
for t in revenue ai-usage team-status task-kanban; do
  grep -q "case \"$t\":" "$RES" \
    || { echo "FAIL: resolver for widget type '$t' missing"; exit 1; }
done

ROUTER="$PKG/src/server/router.ts"
grep -q '"/companies/:companyId/plugin-dashboards/pages"' "$ROUTER" \
  || { echo "FAIL: list/create pages route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-dashboards/pages/:pageId"' "$ROUTER" \
  || { echo "FAIL: get/patch/delete route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-dashboards/pages/:pageId/render"' "$ROUTER" \
  || { echo "FAIL: render route missing"; exit 1; }

# 4. Server-side mount.
SRV="server/src/routes/plugin-dashboards.ts"
[[ -f "$SRV" ]] || { echo "FAIL: $SRV missing"; exit 1; }
grep -q "createPluginDashboardsRouter" "$SRV" \
  || { echo "FAIL: $SRV does not invoke createPluginDashboardsRouter"; exit 1; }
grep -q "pluginDashboardsRoutes" server/src/app.ts \
  || { echo "FAIL: app.ts does not mount pluginDashboardsRoutes"; exit 1; }

# 5. Last-commit scope check (HEAD~1..HEAD). Multi-task branch may carry prior
#    unmerged work; orchestrator does the branch-vs-master scope check at merge.
ALLOWED='^(packages/plugin-dashboards/|packages/db/src/schema/dashboard_pages\.ts$|packages/db/src/schema/index\.ts$|packages/db/src/migrations/0062_dashboard_pages\.sql$|packages/db/src/migrations/meta/_journal\.json$|packages/db/src/rollbacks/0062_dashboard_pages\.down\.sql$|server/src/routes/plugin-dashboards\.ts$|server/src/app\.ts$|server/package\.json$|vitest\.config\.ts$|pnpm-lock\.yaml$|\.agents/company-dev/)'
if git rev-parse HEAD~1 >/dev/null 2>&1; then
  OUT_OF_SCOPE="$(git diff --name-only HEAD~1..HEAD | grep -vE "$ALLOWED" || true)"
  if [[ -n "$OUT_OF_SCOPE" ]]; then
    echo "FAIL: A-08 latest commit drifted out of scope:"
    echo "$OUT_OF_SCOPE"
    exit 1
  fi
fi

# 6. Builds + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-dashboards" build
pnpm --filter "@paperclipai/plugin-dashboards" typecheck

# 7. Behavioural checks — tests run all four widget resolvers end-to-end
#    and assert the exact create → render flow the gate requires.
pnpm --filter "@paperclipai/plugin-dashboards" exec vitest run

# 8. Server typecheck confirms the mount + import paths resolve.
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-A-08: all checks passed"
