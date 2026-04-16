#!/usr/bin/env bash
# B-05: Store "Get" install flow — installing a business template creates a
# new company with CEO + one agent per seed employee + skills attached, in a
# single transaction. Gate asserts file presence, schema columns, migration
# exists, and the integration test passes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-store"

echo "▶ gate-B-05: starting"

# Files required for B-05
[[ -f "$PKG/src/install.ts" ]]                                  || { echo "FAIL: $PKG/src/install.ts missing"; exit 1; }
[[ -f "$PKG/src/install.test.ts" ]]                             || { echo "FAIL: $PKG/src/install.test.ts missing"; exit 1; }
[[ -f "packages/db/src/schema/template_installations.ts" ]]     || { echo "FAIL: template_installations schema missing"; exit 1; }

# Migration for template_installations must exist and be registered in the journal
MIGRATION_MATCH=$(ls packages/db/src/migrations/*.sql | xargs grep -l "CREATE TABLE \"template_installations\"" 2>/dev/null || true)
[[ -n "$MIGRATION_MATCH" ]] \
  || { echo "FAIL: no migration creates the template_installations table"; exit 1; }
grep -q "template_installations" packages/db/src/schema/index.ts \
  || { echo "FAIL: packages/db/src/schema/index.ts does not export templateInstallations"; exit 1; }

# installTemplate + related helpers must be exported from the plugin entrypoint
for symbol in "installTemplate" "getInstalledSkills" "getInstallationForCompany" "countAgentsForCompany"; do
  grep -q "$symbol" "$PKG/src/index.ts" \
    || { echo "FAIL: $symbol not exported from $PKG/src/index.ts"; exit 1; }
done

# template_installations table must include the five B-05-required columns
for col in "company_id" "template_slug" "template_kind" "skills" "employees"; do
  grep -q "\"$col\"" packages/db/src/schema/template_installations.ts \
    || { echo "FAIL: template_installations schema missing column \"$col\""; exit 1; }
done

# Every seed employee must declare a department (added in B-05 for the install flow)
for seed in "$PKG/src/seeds/"{faceless-youtube,smma,youtube-long-form,b2b-outbound-machine,dev-agency,devops-monitoring-ops}.ts; do
  emp_count=$(grep -c "role:" "$seed")
  dept_count=$(grep -c "department:" "$seed")
  [[ "$emp_count" = "$dept_count" ]] \
    || { echo "FAIL: $seed has $emp_count employees but $dept_count departments"; exit 1; }
done

# Package builds, typechecks, test:run (which runs the embedded-postgres integration test)
pnpm --filter "@paperclipai/plugin-store" build
pnpm --filter "@paperclipai/plugin-store" typecheck
pnpm --filter "@paperclipai/plugin-store" test:run

echo "▶ gate-B-05: all checks passed"
