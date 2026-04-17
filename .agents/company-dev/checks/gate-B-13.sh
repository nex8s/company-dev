#!/usr/bin/env bash
# B-13: Virtual Cards UI backend — list/assign/create cards per agent via BankProvider.
# Gate criterion (PLAN.md): "create card for agent → list returns it with masked PAN"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-identity"

echo "▶ gate-B-13: starting"

[[ -f "$PKG/src/server/router.ts" ]]               || { echo "FAIL: server/router.ts missing"; exit 1; }
[[ -f "$PKG/src/server/schemas.ts" ]]              || { echo "FAIL: server/schemas.ts missing"; exit 1; }
[[ -f "$PKG/src/server/index.ts" ]]                || { echo "FAIL: server/index.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.test.ts" ]]          || { echo "FAIL: server/router.test.ts missing"; exit 1; }

grep -q "createPluginIdentityRouter" "$PKG/src/server/router.ts" \
  || { echo "FAIL: createPluginIdentityRouter not exported"; exit 1; }

grep -q "issueVirtualCard" "$PKG/src/server/router.ts" \
  || { echo "FAIL: router does not call issueVirtualCard"; exit 1; }

grep -q "listCards" "$PKG/src/server/router.ts" \
  || { echo "FAIL: router does not call listCards"; exit 1; }

# Documented mount point in the host
[[ -f "server/src/routes/plugin-identity.ts" ]] \
  || { echo "FAIL: server/src/routes/plugin-identity.ts mount file missing"; exit 1; }

grep -q "pluginIdentityRoutes" server/src/app.ts \
  || { echo "FAIL: pluginIdentityRoutes not mounted from server/src/app.ts"; exit 1; }

grep -q '"@paperclipai/plugin-identity"' server/package.json \
  || { echo "FAIL: server/package.json missing @paperclipai/plugin-identity dependency"; exit 1; }

pnpm --filter "@paperclipai/plugin-identity" build
pnpm --filter "@paperclipai/plugin-identity" typecheck
pnpm --filter "@paperclipai/plugin-identity" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-13: all checks passed"
