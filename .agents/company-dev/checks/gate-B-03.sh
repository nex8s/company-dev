#!/usr/bin/env bash
# B-03: Preview / Code / Deployments / Settings tabs backend.
# Gate criterion (PLAN.md): "each tab has an endpoint returning expected shape"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-apps-builder"

echo "▶ gate-B-03: starting"

# 1. New builder helpers
[[ -f "$PKG/src/builder/file-tree.ts" ]]              || { echo "FAIL: builder/file-tree.ts missing"; exit 1; }
[[ -f "$PKG/src/builder/file-tree.test.ts" ]]         || { echo "FAIL: builder/file-tree.test.ts missing"; exit 1; }
grep -q "export function buildFileTree" "$PKG/src/builder/file-tree.ts" \
  || { echo "FAIL: buildFileTree not exported"; exit 1; }

# 2. Storage + server module
[[ -f "$PKG/src/storage/apps-queries.ts" ]]           || { echo "FAIL: storage/apps-queries.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.ts" ]]                  || { echo "FAIL: server/router.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.test.ts" ]]             || { echo "FAIL: server/router.test.ts missing"; exit 1; }
grep -q "createPluginAppsBuilderRouter" "$PKG/src/server/router.ts" \
  || { echo "FAIL: createPluginAppsBuilderRouter not exported"; exit 1; }

# 3. Each tab has an endpoint in the router
for tab in "/preview" "/files" "/files/blob" "/deployments" "/env"; do
  grep -q "$tab" "$PKG/src/server/router.ts" \
    || { echo "FAIL: tab endpoint $tab missing from router"; exit 1; }
done

# 4. DB: app_deployments schema + migration
[[ -f "packages/db/src/schema/app_deployments.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/app_deployments.ts missing"; exit 1; }
grep -q 'export { appDeployments }' packages/db/src/schema/index.ts \
  || { echo "FAIL: appDeployments not re-exported from db schema/index.ts"; exit 1; }
migration_file=$(find packages/db/src/migrations -maxdepth 1 -name '0066_app_deployments.sql' | head -1)
[[ -n "$migration_file" ]] \
  || { echo "FAIL: 0066_app_deployments.sql missing"; exit 1; }
grep -q 'CREATE TABLE "app_deployments"' "$migration_file" \
  || { echo "FAIL: 0066 migration does not CREATE TABLE app_deployments"; exit 1; }

# 5. buildApp still wires up deployment history (B-03 enhancement of B-02)
grep -q "recordDeployment\|appDeployments" "$PKG/src/builder/build.ts" \
  || { echo "FAIL: buildApp does not record an app_deployment"; exit 1; }

# 6. Host mount in server
[[ -f "server/src/routes/plugin-apps-builder.ts" ]] \
  || { echo "FAIL: server/src/routes/plugin-apps-builder.ts mount file missing"; exit 1; }
grep -q "pluginAppsBuilderRoutes" server/src/app.ts \
  || { echo "FAIL: pluginAppsBuilderRoutes not mounted in server/src/app.ts"; exit 1; }
grep -q '"@paperclipai/plugin-apps-builder"' server/package.json \
  || { echo "FAIL: server/package.json missing @paperclipai/plugin-apps-builder dep"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-apps-builder" build
pnpm --filter "@paperclipai/plugin-apps-builder" typecheck
pnpm --filter "@paperclipai/plugin-apps-builder" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-03: all checks passed"
