#!/usr/bin/env bash
# A-04: Getting Started checklist state machine — 7 steps, per-company
# progress persisted in Postgres. Completing a step bumps progress; state
# survives restart.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-04: starting"

# 1. Schema + migration + rollback files exist.
SCHEMA="packages/db/src/schema/getting_started.ts"
[[ -f "$SCHEMA" ]] || { echo "FAIL: $SCHEMA missing"; exit 1; }
grep -q 'export { gettingStarted' packages/db/src/schema/index.ts \
  || { echo "FAIL: gettingStarted not re-exported from db schema index"; exit 1; }

UP_MIGRATION="$(ls packages/db/src/migrations/ | grep -E '^[0-9]{4}_.*\.sql$' | tail -n 1)"
grep -q 'CREATE TABLE "getting_started"' "packages/db/src/migrations/$UP_MIGRATION" \
  || { echo "FAIL: latest migration does not create getting_started"; exit 1; }

ROLLBACK="packages/db/src/rollbacks/${UP_MIGRATION%.sql}.down.sql"
[[ -f "$ROLLBACK" ]] || { echo "FAIL: rollback file $ROLLBACK missing"; exit 1; }
grep -q 'DROP TABLE IF EXISTS "getting_started"' "$ROLLBACK" \
  || { echo "FAIL: rollback does not drop getting_started"; exit 1; }

# 2. Plugin-side state machine files exist and export the expected API.
CHECKLIST="packages/plugin-company/src/getting-started/checklist.ts"
STEPS="packages/plugin-company/src/getting-started/steps.ts"
TESTS="packages/plugin-company/src/getting-started/checklist.test.ts"
[[ -f "$CHECKLIST" ]] || { echo "FAIL: $CHECKLIST missing"; exit 1; }
[[ -f "$STEPS" ]]     || { echo "FAIL: $STEPS missing"; exit 1; }
[[ -f "$TESTS" ]]     || { echo "FAIL: $TESTS missing"; exit 1; }

grep -q "export async function getChecklist" "$CHECKLIST" \
  || { echo "FAIL: getChecklist not exported"; exit 1; }
grep -q "export async function completeStep" "$CHECKLIST" \
  || { echo "FAIL: completeStep not exported"; exit 1; }
grep -q "export async function resetStep" "$CHECKLIST" \
  || { echo "FAIL: resetStep not exported"; exit 1; }

# 3. All seven step keys are in the catalog, in order.
for step in incorporate domain email_inboxes stripe_billing deploy_first_app google_search_console custom_dashboard_pages; do
  grep -q "\"$step\"" "$STEPS" \
    || { echo "FAIL: step '$step' missing from steps catalog"; exit 1; }
done

# 4. Package builds + typechecks.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 5. Behavioural checks — run only A-04's tests to keep the gate fast.
#    The suite covers: initial 0/7, complete step -> 1/7, independent
#    subsequent completes, idempotent re-complete, state survives restart,
#    resetStep, unknown-key rejection, per-company isolation.
pnpm --filter "@paperclipai/plugin-company" exec vitest run src/getting-started/checklist.test.ts

echo "▶ gate-A-04: all checks passed"
