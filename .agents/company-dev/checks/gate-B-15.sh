#!/usr/bin/env bash
# B-15: Domains management — list / connect / mark default per company.
# Gate criterion (PLAN.md): "create domain → appears in list with default:true if first;
# connect custom domain flow records DNS CNAME target"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-identity"

echo "▶ gate-B-15: starting"

# 1. Storage layer
[[ -f "$PKG/src/domains/storage.ts" ]]                    || { echo "FAIL: domains/storage.ts missing"; exit 1; }
[[ -f "$PKG/src/domains/index.ts" ]]                      || { echo "FAIL: domains/index.ts missing"; exit 1; }
for fn in "createDomain" "listDomains" "setDefaultDomain" "deleteDomain"; do
  grep -q "export.*$fn" "$PKG/src/domains/storage.ts" \
    || { echo "FAIL: domains/storage.ts missing $fn"; exit 1; }
done

# 2. Router exposes the four required HTTP routes
grep -q '"/companies/:companyId/plugin-identity/domains"' "$PKG/src/server/router.ts" \
  || { echo "FAIL: GET/POST /domains route missing from router"; exit 1; }
grep -q '/domains/:domainId/default' "$PKG/src/server/router.ts" \
  || { echo "FAIL: POST /domains/:id/default route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-identity/domains/:domainId"' "$PKG/src/server/router.ts" \
  || { echo "FAIL: DELETE /domains/:id route missing"; exit 1; }

# 3. Router test exists for the B-15 routes
[[ -f "$PKG/src/server/domains.router.test.ts" ]] \
  || { echo "FAIL: server/domains.router.test.ts missing"; exit 1; }

# 4. DB schema + migration
[[ -f "packages/db/src/schema/domains.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/domains.ts missing"; exit 1; }
grep -q 'export { domains }' packages/db/src/schema/index.ts \
  || { echo "FAIL: domains not re-exported from db schema/index.ts"; exit 1; }
migration_file=$(find packages/db/src/migrations -maxdepth 1 -name '0062_*.sql' | head -1)
[[ -n "$migration_file" ]] \
  || { echo "FAIL: 0062 domains migration missing"; exit 1; }
grep -q 'CREATE TABLE "domains"' "$migration_file" \
  || { echo "FAIL: 0062 migration does not CREATE TABLE domains"; exit 1; }

# 5. The B-15 routes are mounted via the existing pluginIdentityRoutes(db) call
grep -q 'pluginIdentityRoutes(db)' server/src/app.ts \
  || { echo "FAIL: pluginIdentityRoutes not invoked with db handle in server/src/app.ts"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-identity" build
pnpm --filter "@paperclipai/plugin-identity" typecheck
pnpm --filter "@paperclipai/plugin-identity" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-15: all checks passed"
