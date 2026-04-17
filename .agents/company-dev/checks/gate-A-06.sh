#!/usr/bin/env bash
# A-06: heartbeat / check-in system messages.
# Gate: an adapter error_recovery lifecycle event posts a "via check-in"
# comment onto the company chat issue (the issue currently bound to the run).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-06: starting"

# 1. Module + colocated test exist.
POSTER="packages/plugin-company/src/heartbeat/check-in-poster.ts"
TESTS="packages/plugin-company/src/heartbeat/check-in-poster.test.ts"
[[ -f "$POSTER" ]] || { echo "FAIL: $POSTER missing"; exit 1; }
[[ -f "$TESTS" ]] || { echo "FAIL: $TESTS missing"; exit 1; }

# 2. Public API surface.
grep -q "export function createCheckInPoster" "$POSTER" \
  || { echo "FAIL: createCheckInPoster not exported"; exit 1; }
grep -q "export function formatCheckInBody" "$POSTER" \
  || { echo "FAIL: formatCheckInBody not exported"; exit 1; }
grep -q "export async function resolveIssueIdForRunByExecution" "$POSTER" \
  || { echo "FAIL: resolveIssueIdForRunByExecution not exported"; exit 1; }
grep -q 'export const VIA_CHECK_IN_PREFIX = "via check-in:"' "$POSTER" \
  || { echo "FAIL: VIA_CHECK_IN_PREFIX constant missing or wrong value"; exit 1; }

# 3. The plugin index re-exports the new module so consumers can import it.
grep -q '"./heartbeat/check-in-poster.js"' packages/plugin-company/src/index.ts \
  || { echo "FAIL: plugin-company/src/index.ts does not re-export check-in-poster"; exit 1; }

# 4. No core edits.
if ! git diff --name-only origin/master..HEAD | grep -qvE '^(packages/plugin-company/|\.agents/company-dev/)'; then
  : # All changes confined to plugin-company + .agents — good.
else
  CORE_TOUCHED="$(git diff --name-only origin/master..HEAD | grep -vE '^(packages/plugin-company/|\.agents/company-dev/)' || true)"
  echo "FAIL: A-06 must not edit Paperclip core. Out-of-scope changes:"
  echo "$CORE_TOUCHED"
  exit 1
fi

# 5. Build + typecheck.
pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 6. Behavioural checks. The integration suite asserts the full gate semantics:
#    - error_recovery → "via check-in" comment posted to the run's chat issue
#    - restart + retry kinds also post
#    - run not bound to any issue → no comment, returns skipped="no-issue"
#    - re-emitting the same event → idempotent, only one comment stored
#    - companyId mismatch does not leak across companies
pnpm --filter "@paperclipai/plugin-company" exec vitest run \
  src/heartbeat/check-in-poster.test.ts

echo "▶ gate-A-06: all checks passed"
