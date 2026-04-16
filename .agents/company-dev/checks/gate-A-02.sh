#!/usr/bin/env bash
# A-02: CompanyProfile schema + Drizzle migration applies cleanly on a fresh DB
# and a round-trip insert+select test passes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-02: starting"

# 1. Schema file exists and is registered in the db package's schema index.
SCHEMA_FILE="packages/db/src/schema/company_profiles.ts"
[[ -f "$SCHEMA_FILE" ]] || { echo "FAIL: $SCHEMA_FILE missing"; exit 1; }
grep -q 'export { companyProfiles } from "./company_profiles.js";' packages/db/src/schema/index.ts \
  || { echo "FAIL: companyProfiles not re-exported from packages/db/src/schema/index.ts"; exit 1; }

# 2. The plugin-company package re-exports the schema.
grep -q 'export \* from "./schema.js";' packages/plugin-company/src/index.ts \
  || { echo "FAIL: plugin-company/src/index.ts does not re-export schema"; exit 1; }

# 3. The generated up migration and its rollback both exist.
UP_MIGRATION="$(ls packages/db/src/migrations/ | grep -E '^[0-9]{4}_.*\.sql$' | tail -n 1)"
[[ -n "$UP_MIGRATION" ]] || { echo "FAIL: no numbered up migration found"; exit 1; }
echo "  up migration: $UP_MIGRATION"

# The tail migration must create the company_profiles table.
grep -q 'CREATE TABLE "company_profiles"' "packages/db/src/migrations/$UP_MIGRATION" \
  || { echo "FAIL: latest migration does not create company_profiles"; exit 1; }

ROLLBACK_FILE="packages/db/src/rollbacks/${UP_MIGRATION%.sql}.down.sql"
[[ -f "$ROLLBACK_FILE" ]] || { echo "FAIL: rollback file $ROLLBACK_FILE missing"; exit 1; }
grep -q 'DROP TABLE IF EXISTS "company_profiles"' "$ROLLBACK_FILE" \
  || { echo "FAIL: rollback does not drop company_profiles"; exit 1; }

# 4. The db package still passes its own check-migration-numbering + build.
pnpm --filter "@paperclipai/db" build

# 5. The plugin-company package builds and typechecks.
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 6. The plugin-company test suite passes — includes the round-trip test that
#    (a) spins up a fresh embedded Postgres, (b) applies all pending migrations
#    including ours, (c) inserts + selects a company_profiles row, (d) asserts
#    unique company_id, (e) asserts cascade delete from companies.
pnpm --filter "@paperclipai/plugin-company" test:run

echo "▶ gate-A-02: all checks passed"
