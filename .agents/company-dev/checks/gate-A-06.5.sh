#!/usr/bin/env bash
# A-06.5: zod-validated plugin-company HTTP routes + run-status check-in wiring.
# Side task to A-06; unblocks Agent C's C-05 (UI swap from stubs to live data).
#
# Gate covers:
#   - All 6 route surfaces exist with the expected handler signature
#   - Each route has supertest contract coverage (success + auth + validation)
#   - The check-in wiring categorizes real heartbeat lifecycle messages and
#     bridges them into the A-06 poster
#   - The server mount is exactly one route module + one app.ts hook (the
#     documented plugin registration pattern — no other server edits)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-06.5: starting"

# 1. plugin-company server surface exists.
ROUTER="packages/plugin-company/src/server/router.ts"
SCHEMAS="packages/plugin-company/src/server/schemas.ts"
WIRING="packages/plugin-company/src/server/check-in-wiring.ts"
SERVER_INDEX="packages/plugin-company/src/server/index.ts"
ROUTER_TESTS="packages/plugin-company/src/server/router.test.ts"
WIRING_TESTS="packages/plugin-company/src/server/check-in-wiring.test.ts"
for f in "$ROUTER" "$SCHEMAS" "$WIRING" "$SERVER_INDEX" "$ROUTER_TESTS" "$WIRING_TESTS"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. Required routes are wired.
grep -q '"/companies/:companyId/plugin-company/checklist"' "$ROUTER" \
  || { echo "FAIL: GET checklist route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/checklist/:stepId/complete"' "$ROUTER" \
  || { echo "FAIL: POST complete-step route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/reviews/pending"' "$ROUTER" \
  || { echo "FAIL: GET reviews/pending route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/reviews/:reviewId/approve"' "$ROUTER" \
  || { echo "FAIL: POST reviews approve route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/reviews/:reviewId/reject"' "$ROUTER" \
  || { echo "FAIL: POST reviews reject route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/profile"' "$ROUTER" \
  || { echo "FAIL: profile routes missing"; exit 1; }

# 3. zod schemas in place.
grep -q "decideReviewBodySchema" "$SCHEMAS" \
  || { echo "FAIL: decideReviewBodySchema missing"; exit 1; }
grep -q "upsertCompanyProfileBodySchema" "$SCHEMAS" \
  || { echo "FAIL: upsertCompanyProfileBodySchema missing"; exit 1; }
grep -q "patchCompanyProfileBodySchema" "$SCHEMAS" \
  || { echo "FAIL: patchCompanyProfileBodySchema missing"; exit 1; }

# 4. Server-side mount is the documented one-line pattern.
SERVER_ROUTE="server/src/routes/plugin-company.ts"
[[ -f "$SERVER_ROUTE" ]] || { echo "FAIL: $SERVER_ROUTE missing"; exit 1; }
grep -q "createPluginCompanyRouter" "$SERVER_ROUTE" \
  || { echo "FAIL: server route module does not invoke createPluginCompanyRouter"; exit 1; }
grep -q "pluginCompanyRoutes" server/src/app.ts \
  || { echo "FAIL: app.ts does not mount pluginCompanyRoutes"; exit 1; }
grep -q "installCheckInPosterForCompany" server/src/app.ts \
  || { echo "FAIL: app.ts does not install the check-in poster"; exit 1; }

# 5. Diff confined to plugin-company + the documented mount surface.
ALLOWED='^(packages/plugin-company/|\.agents/company-dev/|server/src/routes/plugin-company\.ts$|server/src/app\.ts$|server/package\.json$|pnpm-lock\.yaml$)'
OUT_OF_SCOPE="$(git diff --name-only origin/master..HEAD | grep -vE "$ALLOWED" || true)"
if [[ -n "$OUT_OF_SCOPE" ]]; then
  echo "FAIL: A-06.5 must stay in plugin-company + the documented mount. Out-of-scope:"
  echo "$OUT_OF_SCOPE"
  exit 1
fi

# 6. Build + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 7. Behavioural checks.
#    - router.test.ts: contract coverage for every route (success + auth + zod validation)
#    - check-in-wiring.test.ts: categorizer + end-to-end live-event → comment
pnpm --filter "@paperclipai/plugin-company" exec vitest run \
  src/server/router.test.ts \
  src/server/check-in-wiring.test.ts

# 8. Server typecheck — confirms the mount + import paths resolve.
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-A-06.5: all checks passed"
