#!/usr/bin/env bash
# A-05: pending review queue — PendingReview table, listPendingReviews,
# approve removes it from the queue, reject flips task status.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-05: starting"

# 1. Schema + migration + rollback exist and register.
SCHEMA="packages/db/src/schema/pending_reviews.ts"
[[ -f "$SCHEMA" ]] || { echo "FAIL: $SCHEMA missing"; exit 1; }
grep -q 'export { pendingReviews }' packages/db/src/schema/index.ts \
  || { echo "FAIL: pendingReviews not re-exported from db schema index"; exit 1; }

UP_MIGRATION="$(ls packages/db/src/migrations/ | grep -E '^[0-9]{4}_.*\.sql$' | tail -n 1)"
grep -q 'CREATE TABLE "pending_reviews"' "packages/db/src/migrations/$UP_MIGRATION" \
  || { echo "FAIL: latest migration does not create pending_reviews"; exit 1; }

ROLLBACK="packages/db/src/rollbacks/${UP_MIGRATION%.sql}.down.sql"
[[ -f "$ROLLBACK" ]] || { echo "FAIL: rollback file $ROLLBACK missing"; exit 1; }
grep -q 'DROP TABLE IF EXISTS "pending_reviews"' "$ROLLBACK" \
  || { echo "FAIL: rollback does not drop pending_reviews"; exit 1; }

# 2. Plugin-side API surface.
QUEUE="packages/plugin-company/src/reviews/queue.ts"
TESTS="packages/plugin-company/src/reviews/queue.test.ts"
[[ -f "$QUEUE" ]] || { echo "FAIL: $QUEUE missing"; exit 1; }
[[ -f "$TESTS" ]] || { echo "FAIL: $TESTS missing"; exit 1; }

grep -q "export async function submitForReview" "$QUEUE" \
  || { echo "FAIL: submitForReview not exported"; exit 1; }
grep -q "export async function listPendingReviews" "$QUEUE" \
  || { echo "FAIL: listPendingReviews not exported"; exit 1; }
grep -q "export async function approveReview" "$QUEUE" \
  || { echo "FAIL: approveReview not exported"; exit 1; }
grep -q "export async function rejectReview" "$QUEUE" \
  || { echo "FAIL: rejectReview not exported"; exit 1; }

# 3. Build + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 4. Behavioural checks. The test suite asserts the full gate semantics:
#    - submit puts the issue in the queue and flips it to in_review
#    - approve removes it from the queue + flips issue to done
#    - reject removes it from the queue + flips issue status back to todo
#    - already-decided reviews cannot be re-decided
#    - queue is scoped per company
pnpm --filter "@paperclipai/plugin-company" exec vitest run src/reviews/queue.test.ts

echo "▶ gate-A-05: all checks passed"
