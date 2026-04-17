#!/usr/bin/env bash
# A-06.6: subscribeAllCompaniesLiveEvents — global hook on every company's
# heartbeat stream so plugin-company's check-in poster auto-wires runtime-
# created companies (closes the gap flagged in A-06.5).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-06.6: starting"

# 1. Core API in live-events.ts.
LE="server/src/services/live-events.ts"
LE_TESTS="server/src/services/live-events.test.ts"
[[ -f "$LE" ]] || { echo "FAIL: $LE missing"; exit 1; }
[[ -f "$LE_TESTS" ]] || { echo "FAIL: $LE_TESTS missing"; exit 1; }
grep -q "export function subscribeAllCompaniesLiveEvents" "$LE" \
  || { echo "FAIL: subscribeAllCompaniesLiveEvents not exported"; exit 1; }
grep -q "allCompaniesListeners" "$LE" \
  || { echo "FAIL: per-listener Set missing — listener storage must be outside EventEmitter to receive every per-company emit"; exit 1; }

# 2. plugin-company exposes the all-companies install variant.
WIRING="packages/plugin-company/src/server/check-in-wiring.ts"
grep -q "export function installCheckInPosterAllCompanies" "$WIRING" \
  || { echo "FAIL: installCheckInPosterAllCompanies not exported from $WIRING"; exit 1; }
grep -q "AllCompaniesLiveEventSubscribe" "$WIRING" \
  || { echo "FAIL: AllCompaniesLiveEventSubscribe type missing"; exit 1; }

# 3. app.ts swapped to use the global subscribe.
grep -q "installCheckInPosterAllCompanies" server/src/app.ts \
  || { echo "FAIL: app.ts has not been swapped to installCheckInPosterAllCompanies"; exit 1; }
grep -q "subscribeAllCompaniesLiveEvents" server/src/app.ts \
  || { echo "FAIL: app.ts no longer imports subscribeAllCompaniesLiveEvents"; exit 1; }
if grep -q "installCheckInPosterForCompany" server/src/app.ts; then
  echo "FAIL: app.ts still calls installCheckInPosterForCompany — should use installCheckInPosterAllCompanies"
  exit 1
fi

# 4. Diff confined to the documented surface.
ALLOWED='^(packages/plugin-company/|\.agents/company-dev/|server/src/services/live-events\.(ts|test\.ts)$|server/src/app\.ts$|server/package\.json$|pnpm-lock\.yaml$)'
OUT_OF_SCOPE="$(git diff --name-only origin/master..HEAD | grep -vE "$ALLOWED" || true)"
if [[ -n "$OUT_OF_SCOPE" ]]; then
  echo "FAIL: A-06.6 scope drift. Out-of-scope:"
  echo "$OUT_OF_SCOPE"
  exit 1
fi

# 5. Builds + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 6. Behavioural checks.
#    - live-events.test.ts: subscribeAll receives every company emit, dispose stops, throwing listener isolated, per-company subscribe still works, duplicate-listener no-op (Set semantics)
#    - check-in-wiring.test.ts > installCheckInPosterAllCompanies: regression test for the A-06.5 gap — install BEFORE companies exist, then create companies AFTER and verify both wire automatically; dispose stops further posts
pnpm --filter "@paperclipai/server" exec vitest run \
  src/services/live-events.test.ts
pnpm --filter "@paperclipai/plugin-company" exec vitest run \
  src/server/check-in-wiring.test.ts

# 7. Server typecheck.
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-A-06.6: all checks passed"
