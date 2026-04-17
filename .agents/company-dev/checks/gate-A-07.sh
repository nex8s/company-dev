#!/usr/bin/env bash
# A-07: credit ledger.
# Reuses Paperclip's budget primitives (budget_policies / budget_incidents);
# adds:
#   - top-level company balance via a new `credit_ledger` table
#   - Stripe-synced top-ups (recordTopUp + externalRef + findEntryByExternalRef)
#   - per-agent monthly budget caps with graceful pause
#   - resume on new month
#
# Gate: top-up adds credits; exceeding per-agent cap flips agent status to
# `paused`; resume recharges on new month. End-to-end test asserts the full
# flow.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-07: starting"

# 1. Schema + migration + rollback.
SCHEMA="packages/db/src/schema/credit_ledger.ts"
[[ -f "$SCHEMA" ]] || { echo "FAIL: $SCHEMA missing"; exit 1; }
grep -q 'export { creditLedger }' packages/db/src/schema/index.ts \
  || { echo "FAIL: creditLedger not re-exported from db schema index"; exit 1; }

UP_MIGRATION="$(ls packages/db/src/migrations/ | grep -E '^[0-9]{4}_.*\.sql$' | tail -n 1)"
grep -q 'CREATE TABLE "credit_ledger"' "packages/db/src/migrations/$UP_MIGRATION" \
  || { echo "FAIL: latest migration does not create credit_ledger"; exit 1; }

ROLLBACK="packages/db/src/rollbacks/${UP_MIGRATION%.sql}.down.sql"
[[ -f "$ROLLBACK" ]] || { echo "FAIL: rollback file $ROLLBACK missing"; exit 1; }
grep -q 'DROP TABLE IF EXISTS "credit_ledger"' "$ROLLBACK" \
  || { echo "FAIL: rollback does not drop credit_ledger"; exit 1; }

# 2. plugin-payments scaffold.
PKG="packages/plugin-payments"
for f in "$PKG/package.json" "$PKG/tsconfig.json" "$PKG/vitest.config.ts" \
         "$PKG/src/index.ts" "$PKG/src/schema.ts" \
         "$PKG/src/ledger/operations.ts" "$PKG/src/ledger/operations.test.ts" \
         "$PKG/src/budgets/cap-enforcement.ts" "$PKG/src/budgets/cap-enforcement.test.ts"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 3. Required exports.
OPS="$PKG/src/ledger/operations.ts"
grep -q "export async function recordTopUp" "$OPS" \
  || { echo "FAIL: recordTopUp not exported"; exit 1; }
grep -q "export async function recordUsage" "$OPS" \
  || { echo "FAIL: recordUsage not exported"; exit 1; }
grep -q "export async function getCompanyBalanceCents" "$OPS" \
  || { echo "FAIL: getCompanyBalanceCents not exported"; exit 1; }
grep -q "export async function getAgentUsageCentsInWindow" "$OPS" \
  || { echo "FAIL: getAgentUsageCentsInWindow not exported"; exit 1; }
grep -q "export async function findEntryByExternalRef" "$OPS" \
  || { echo "FAIL: findEntryByExternalRef not exported (needed for Stripe webhook idempotency)"; exit 1; }

CAPS="$PKG/src/budgets/cap-enforcement.ts"
grep -q "export async function setAgentMonthlyCap" "$CAPS" \
  || { echo "FAIL: setAgentMonthlyCap not exported"; exit 1; }
grep -q "export async function enforceAgentMonthlyCap" "$CAPS" \
  || { echo "FAIL: enforceAgentMonthlyCap not exported"; exit 1; }
grep -q "export async function resumePausedAgentsForNewMonth" "$CAPS" \
  || { echo "FAIL: resumePausedAgentsForNewMonth not exported"; exit 1; }
grep -q 'CREDIT_CAP_METRIC' "$CAPS" \
  || { echo "FAIL: CREDIT_CAP_METRIC constant missing"; exit 1; }

# 4. Diff confined to plugin-payments + db schema/migration + .agents.
# Last-commit scope check (HEAD~1..HEAD only). A multi-task branch may carry
# prior unmerged work (A-06.6 still in flight); the orchestrator does the
# branch-vs-master scope check at merge time.
ALLOWED='^(packages/plugin-payments/|packages/db/src/schema/credit_ledger\.ts$|packages/db/src/schema/index\.ts$|packages/db/src/migrations/0061_credit_ledger\.sql$|packages/db/src/migrations/meta/_journal\.json$|packages/db/src/rollbacks/0061_credit_ledger\.down\.sql$|\.agents/company-dev/|vitest\.config\.ts$|pnpm-lock\.yaml$)'
if git rev-parse HEAD~1 >/dev/null 2>&1; then
  OUT_OF_SCOPE="$(git diff --name-only HEAD~1..HEAD | grep -vE "$ALLOWED" || true)"
  if [[ -n "$OUT_OF_SCOPE" ]]; then
    echo "FAIL: A-07 latest commit drifted out of scope:"
    echo "$OUT_OF_SCOPE"
    exit 1
  fi
fi

# 5. Builds + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-payments" build
pnpm --filter "@paperclipai/plugin-payments" typecheck

# 6. Behavioural checks. The test suite covers the gate end-to-end:
#    - top-up adds credits (recordTopUp + getCompanyBalanceCents)
#    - usage exceeding the per-agent monthly cap flips agent.status to 'paused'
#      AND records a budget_incidents row tagged with the cap window
#    - the resume sweep flips status back to 'idle' on the next month when
#      the new window's usage is below cap (and resolves the stale incident)
#    - end-to-end gate scenario test wires all four operations together
pnpm --filter "@paperclipai/plugin-payments" exec vitest run

echo "▶ gate-A-07: all checks passed"
