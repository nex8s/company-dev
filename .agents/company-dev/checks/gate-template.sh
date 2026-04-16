#!/usr/bin/env bash
# Gate script template. Copy to gate-<task-id>.sh for each task, fill in TASK_ID + the verification commands.
#
# Rules (see SELF_CHECK_PROTOCOL.md):
# - Exit 0 iff every assertion passes.
# - Never weaken assertions to make a failing task pass.
# - Gate scripts may be updated in the same commit as the task — but only to tighten, never loosen.

set -euo pipefail

TASK_ID="__REPLACE__"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# Example assertions — replace per task:
#
# 1. Package builds
# pnpm --filter @paperclipai/plugin-company build
#
# 2. Typecheck passes for the affected package only (full-repo typecheck runs separately)
# pnpm --filter @paperclipai/plugin-company typecheck
#
# 3. Tests specific to this task
# pnpm --filter @paperclipai/plugin-company test:run -- --run factory.test.ts
#
# 4. Behavioural round-trip (via a small script that exits 0 iff the feature works)
# node .agents/company-dev/checks/scripts/a-03-round-trip.mjs

echo "▶ gate-${TASK_ID}: no assertions defined — copy this template"
exit 1
