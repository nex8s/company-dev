#!/usr/bin/env bash
# A-10: Publishing → Store bridge. Endpoint to publish an agent or full
# company as a Store template.
#
# Gate: publish single agent → appears in Store listing; bundle entire
# company → multi-agent template appears.
#
# B-06 is unshipped; A-10 ships the full write path + a minimal read path
# (listPublishedTemplates + /store/templates GET) so the gate round-trips
# without cross-agent coordination. B-06 will layer filters/pagination on
# top of the same store_templates table.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-10: starting"

# 1. Schema + migration + rollback.
MIGRATION="packages/db/src/migrations/0068_store_templates.sql"
ROLLBACK="packages/db/src/rollbacks/0068_store_templates.down.sql"
[[ -f "$MIGRATION" ]] || { echo "FAIL: $MIGRATION missing"; exit 1; }
[[ -f "$ROLLBACK" ]] || { echo "FAIL: $ROLLBACK missing"; exit 1; }
grep -q 'CREATE TABLE "store_templates"' "$MIGRATION" \
  || { echo "FAIL: migration does not create store_templates"; exit 1; }
grep -q 'DROP TABLE IF EXISTS "store_templates"' "$ROLLBACK" \
  || { echo "FAIL: rollback does not drop store_templates"; exit 1; }
grep -q '"tag": "0068_store_templates"' packages/db/src/migrations/meta/_journal.json \
  || { echo "FAIL: journal entry for 0068_store_templates missing"; exit 1; }

# 2. plugin-company publisher module.
PUB="packages/plugin-company/src/store-publishing/publisher.ts"
PUB_TESTS="packages/plugin-company/src/store-publishing/publisher.test.ts"
ROUTE_TESTS="packages/plugin-company/src/server/store-publish-route.test.ts"
for f in "$PUB" "$PUB_TESTS" "$ROUTE_TESTS"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done
for fn in publishAgentAsTemplate publishCompanyAsTemplate listPublishedTemplates getPublishedTemplateBySlug; do
  grep -q "export async function $fn" "$PUB" \
    || { echo "FAIL: $fn not exported from $PUB"; exit 1; }
done

# 3. Routes wired into plugin-company's router.
ROUTER="packages/plugin-company/src/server/router.ts"
grep -q '"/companies/:companyId/plugin-company/agents/:agentId/publish"' "$ROUTER" \
  || { echo "FAIL: POST publish-agent route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/publish"' "$ROUTER" \
  || { echo "FAIL: POST publish-company route missing"; exit 1; }
grep -q '"/companies/:companyId/plugin-company/store/templates"' "$ROUTER" \
  || { echo "FAIL: GET list-templates route missing"; exit 1; }

# 4. Scope check (working tree + committed-ahead-of-master).
ALLOWED='^(packages/plugin-company/|packages/db/src/migrations/0068_store_templates\.sql$|packages/db/src/migrations/meta/_journal\.json$|packages/db/src/rollbacks/0068_store_templates\.down\.sql$|\.agents/company-dev/|pnpm-lock\.yaml$)'
OUT_OF_SCOPE="$( { git diff --name-only origin/master; git diff --name-only origin/master --cached 2>/dev/null || true; git ls-files --others --exclude-standard; } | sort -u | grep -vE "$ALLOWED" || true)"
if [[ -n "$OUT_OF_SCOPE" ]]; then
  echo "FAIL: A-10 scope drift. Out-of-scope:"
  echo "$OUT_OF_SCOPE"
  exit 1
fi

# 5. Build + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 6. Behavioural checks. Gate semantics are covered end-to-end by the
#    publisher.test.ts + store-publish-route.test.ts pair:
#      - publish single agent → listPublishedTemplates / GET list sees it
#      - publish entire company → multi-agent template with N employees
#      - department inference + explicit override
#      - duplicate slug → 409
#      - missing/cross-company agent → 404
#      - empty company → 409
#      - strict zod rejects malformed slug + unknown body fields
pnpm --filter "@paperclipai/plugin-company" exec vitest run \
  src/store-publishing/publisher.test.ts \
  src/server/store-publish-route.test.ts

# 7. Server typecheck confirms the plugin still resolves under the host.
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-A-10: all checks passed"
