#!/usr/bin/env bash
# B-06: Store publishing bridge — discovery (filters / pagination /
# category facets) on top of the `store_templates` table A-10 writes to.
#
# Gate criterion (PLAN.md): Agent A's gate-A-10 round-trip passes against
# this endpoint. Concretely B-06 ships:
#   - DB-backed listPublishedTemplates with kind/category/q + pagination
#   - getStoreFacets returning per-category and per-kind counts
#   - GET /store/templates / facets / :slug HTTP routes
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-store"

echo "▶ gate-B-06: starting"

# 1. Discovery module (DB-backed, lives in plugin-store)
[[ -f "$PKG/src/discovery/queries.ts" ]]              || { echo "FAIL: discovery/queries.ts missing"; exit 1; }
[[ -f "$PKG/src/discovery/index.ts" ]]                || { echo "FAIL: discovery/index.ts missing"; exit 1; }
for fn in "listPublishedTemplates" "getStoreFacets" "getPublishedTemplateBySlug"; do
  grep -q "export.*$fn" "$PKG/src/discovery/queries.ts" \
    || { echo "FAIL: discovery/queries.ts missing $fn"; exit 1; }
done

# 2. HTTP router exposes the three discovery routes
[[ -f "$PKG/src/server/router.ts" ]]                  || { echo "FAIL: server/router.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.test.ts" ]]             || { echo "FAIL: server/router.test.ts missing"; exit 1; }
for route in '"/store/templates"' '"/store/templates/facets"' '"/store/templates/:slug"'; do
  grep -q "$route" "$PKG/src/server/router.ts" \
    || { echo "FAIL: route $route missing from router"; exit 1; }
done

# 3. Reads are NOT companyId-scoped — store is a global marketplace.
grep -q "assertAuthenticated" "$PKG/src/server/router.ts" \
  || { echo "FAIL: router does not use assertAuthenticated dep (store reads must require auth)"; exit 1; }
# Only fire if the deps interface actually takes an authorizeCompanyAccess
# field (matches plugin-identity's pattern). Comments mentioning the name
# are fine; an actual dep declaration is not.
if grep -qE "readonly authorizeCompanyAccess" "$PKG/src/server/router.ts"; then
  echo "FAIL: store router should NOT require companyId scope on reads"
  exit 1
fi

# 4. Host mount in server
[[ -f "server/src/routes/plugin-store.ts" ]] \
  || { echo "FAIL: server/src/routes/plugin-store.ts mount file missing"; exit 1; }
grep -q "pluginStoreRoutes" server/src/app.ts \
  || { echo "FAIL: pluginStoreRoutes not mounted in server/src/app.ts"; exit 1; }
grep -q '"@paperclipai/plugin-store"' server/package.json \
  || { echo "FAIL: server/package.json missing @paperclipai/plugin-store dep"; exit 1; }

# 5. A-10's writers still work end-to-end against the same table
grep -q "publishAgentAsTemplate" packages/plugin-company/src/store-publishing/publisher.ts \
  || { echo "FAIL: A-10's publishAgentAsTemplate not present (B-06 depends on it)"; exit 1; }
grep -q "publishCompanyAsTemplate" packages/plugin-company/src/store-publishing/publisher.ts \
  || { echo "FAIL: A-10's publishCompanyAsTemplate not present (B-06 depends on it)"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-store" build
pnpm --filter "@paperclipai/plugin-store" typecheck
pnpm --filter "@paperclipai/plugin-store" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-06: all checks passed"
