#!/usr/bin/env bash
# A-09: Company "Server" panel — Fly machine metadata (CPU/RAM/Region/State/
# Machine events) when deployed on Fly; local-dev stub otherwise.
#
# Gate: endpoint returns well-formed JSON in both modes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-09: starting"

# 1. Resolver + colocated test exist.
RES="packages/plugin-company/src/server-panel/resolver.ts"
RES_TESTS="packages/plugin-company/src/server-panel/resolver.test.ts"
ROUTE_TESTS="packages/plugin-company/src/server/server-panel-route.test.ts"
for f in "$RES" "$RES_TESTS" "$ROUTE_TESTS"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Resolver public API.
grep -q "export async function resolveServerPanel" "$RES" \
  || { echo "FAIL: resolveServerPanel not exported"; exit 1; }
grep -q "ServerPanelData" "$RES" \
  || { echo "FAIL: ServerPanelData type missing"; exit 1; }
grep -q '"local-dev-stub"' "$RES" \
  || { echo "FAIL: resolver does not return local-dev-stub mode"; exit 1; }
grep -q '"fly"' "$RES" \
  || { echo "FAIL: resolver does not return fly mode"; exit 1; }
grep -q "api.machines.dev/v1" "$RES" \
  || { echo "FAIL: resolver does not target the Fly Machines API base URL"; exit 1; }

# 3. Route wired into plugin-company's router.
ROUTER="packages/plugin-company/src/server/router.ts"
grep -q '"/companies/:companyId/plugin-company/server-panel"' "$ROUTER" \
  || { echo "FAIL: server-panel route missing from plugin-company router"; exit 1; }
grep -q "resolveServerPanel" "$ROUTER" \
  || { echo "FAIL: router does not invoke resolveServerPanel"; exit 1; }
grep -q "serverPanelConfig" "$ROUTER" \
  || { echo "FAIL: router does not accept a serverPanelConfig dep (needed for test injection)"; exit 1; }

# 4. Scope check: diff the working tree + any already-committed-on-branch
#    work vs origin/master. A-09 should only touch plugin-company and the
#    gate script itself.
ALLOWED='^(packages/plugin-company/|\.agents/company-dev/|pnpm-lock\.yaml$)'
# git diff against origin/master includes uncommitted changes; --cached picks up staged.
OUT_OF_SCOPE="$( { git diff --name-only origin/master; git diff --name-only origin/master --cached 2>/dev/null || true; git ls-files --others --exclude-standard; } | sort -u | grep -vE "$ALLOWED" || true)"
if [[ -n "$OUT_OF_SCOPE" ]]; then
  echo "FAIL: A-09 scope drift. Out-of-scope:"
  echo "$OUT_OF_SCOPE"
  exit 1
fi

# 5. Build + typecheck.
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 6. Behavioural checks.
#    - resolver.test.ts (12): local-dev stub shape, token-missing fallback,
#      live Fly API normalization, machine selection, error → graceful
#      degraded payload, events cap, Bearer token header.
#    - server-panel-route.test.ts (3): GET returns 200 + well-formed JSON
#      in both modes, 400 on malformed companyId.
pnpm --filter "@paperclipai/plugin-company" exec vitest run \
  src/server-panel/resolver.test.ts \
  src/server/server-panel-route.test.ts

# 7. Server typecheck confirms the route mount still resolves.
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-A-09: all checks passed"
