#!/usr/bin/env bash
# B-14: Connect-tools integrations hub scaffold — pluggable adapter pattern
# Gate criterion (PLAN.md): connection record stored with token; listConnections(companyId) returns it
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-connect-tools"

echo "▶ gate-B-14: starting"

# 1. Plugin scaffold
[[ -f "$PKG/package.json" ]]                          || { echo "FAIL: $PKG/package.json missing"; exit 1; }
[[ -f "$PKG/tsconfig.json" ]]                         || { echo "FAIL: $PKG/tsconfig.json missing"; exit 1; }
[[ -f "$PKG/src/index.ts" ]]                          || { echo "FAIL: $PKG/src/index.ts missing"; exit 1; }
[[ -f "$PKG/src/adapters/types.ts" ]]                 || { echo "FAIL: adapters/types.ts missing"; exit 1; }
[[ -f "$PKG/src/adapters/registry.ts" ]]              || { echo "FAIL: adapters/registry.ts missing"; exit 1; }
[[ -f "$PKG/src/storage/connections.ts" ]]            || { echo "FAIL: storage/connections.ts missing"; exit 1; }
[[ -f "$PKG/src/storage/connections.test.ts" ]]       || { echo "FAIL: storage/connections.test.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.ts" ]]                  || { echo "FAIL: server/router.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.test.ts" ]]             || { echo "FAIL: server/router.test.ts missing"; exit 1; }

grep -q "export function registerPlugin" "$PKG/src/index.ts" \
  || { echo "FAIL: registerPlugin not exported from $PKG/src/index.ts"; exit 1; }

# 2. All six adapters scaffolded
for kind in "notion" "slack" "figma" "github" "linear" "vercel"; do
  grep -q "\"$kind\"" "$PKG/src/adapters/registry.ts" \
    || { echo "FAIL: adapter '$kind' missing from registry"; exit 1; }
done

# 3. Storage API present
for fn in "storeConnection" "listConnections" "deleteConnection"; do
  grep -q "export.*$fn" "$PKG/src/storage/connections.ts" \
    || { echo "FAIL: storage/connections.ts missing $fn"; exit 1; }
done

# 4. DB schema + migration
[[ -f "packages/db/src/schema/connections.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/connections.ts missing"; exit 1; }
grep -q 'export { connections }' packages/db/src/schema/index.ts \
  || { echo "FAIL: connections not re-exported from db schema/index.ts"; exit 1; }
migration_file=$(find packages/db/src/migrations -maxdepth 1 -name '0061_*.sql' | head -1)
[[ -n "$migration_file" ]] \
  || { echo "FAIL: 0061 connections migration missing"; exit 1; }
grep -q "CREATE TABLE \"connections\"" "$migration_file" \
  || { echo "FAIL: 0061 migration does not CREATE TABLE connections"; exit 1; }

# 5. Documented mount point in the host
[[ -f "server/src/routes/plugin-connect-tools.ts" ]] \
  || { echo "FAIL: server/src/routes/plugin-connect-tools.ts mount file missing"; exit 1; }
grep -q "pluginConnectToolsRoutes" server/src/app.ts \
  || { echo "FAIL: pluginConnectToolsRoutes not mounted from server/src/app.ts"; exit 1; }
grep -q '"@paperclipai/plugin-connect-tools"' server/package.json \
  || { echo "FAIL: server/package.json missing @paperclipai/plugin-connect-tools dependency"; exit 1; }

# 6. Plugin in root vitest projects so tests run from `pnpm test:run`
grep -q '"packages/plugin-connect-tools"' vitest.config.ts \
  || { echo "FAIL: packages/plugin-connect-tools not in root vitest.config.ts projects"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-connect-tools" build
pnpm --filter "@paperclipai/plugin-connect-tools" typecheck
pnpm --filter "@paperclipai/plugin-connect-tools" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-14: all checks passed"
