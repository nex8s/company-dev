#!/usr/bin/env bash
# B-08: Billing / Usage / Server settings tabs backend.
#
# Gate criterion (PLAN.md): "endpoints return shape expected by the
# dashboard prototype". Each tab has its own endpoint mounted under
# /api/companies/:companyId/plugin-payments/{billing,usage,server}.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-payments"

echo "▶ gate-B-08: starting"

# 1. New domain modules
[[ -f "$PKG/src/billing/usage.ts" ]]                  || { echo "FAIL: billing/usage.ts missing"; exit 1; }
[[ -f "$PKG/src/server-info/provider.ts" ]]           || { echo "FAIL: server-info/provider.ts missing"; exit 1; }
grep -q "listUsageBreakdownByAgent" "$PKG/src/billing/usage.ts" \
  || { echo "FAIL: listUsageBreakdownByAgent not exported"; exit 1; }
grep -q "listTransactionHistory" "$PKG/src/billing/usage.ts" \
  || { echo "FAIL: listTransactionHistory not exported"; exit 1; }
grep -q "LocalServerInfoProvider" "$PKG/src/server-info/provider.ts" \
  || { echo "FAIL: LocalServerInfoProvider not exported"; exit 1; }

# 2. Each settings tab has its endpoint in the router
for route in "/billing/summary" "/usage/summary" "/usage/transactions" "/server/info"; do
  grep -q "$route" "$PKG/src/server/router.ts" \
    || { echo "FAIL: settings tab endpoint $route missing from router"; exit 1; }
done

# 3. Router test for B-08 surface exists
[[ -f "$PKG/src/server/router-b08.test.ts" ]] \
  || { echo "FAIL: server/router-b08.test.ts missing"; exit 1; }

# 4. Server-info provider can be swapped at the host mount (A-09 hand-off point)
grep -q "serverInfo?: ServerInfoProvider" "$PKG/src/server/router.ts" \
  || { echo "FAIL: serverInfo dep is not pluggable in PluginPaymentsRouterDeps"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-payments" build
pnpm --filter "@paperclipai/plugin-payments" typecheck
pnpm --filter "@paperclipai/plugin-payments" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-08: all checks passed"
