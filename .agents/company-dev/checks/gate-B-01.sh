#!/usr/bin/env bash
# B-01: plugin-apps-builder package scaffold builds, typechecks, and test proves
# creating an App row + attaching a channel.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-apps-builder"

echo "▶ gate-B-01: starting"

[[ -d "$PKG" ]]                        || { echo "FAIL: $PKG missing"; exit 1; }
[[ -f "$PKG/package.json" ]]           || { echo "FAIL: $PKG/package.json missing"; exit 1; }
[[ -f "$PKG/tsconfig.json" ]]          || { echo "FAIL: $PKG/tsconfig.json missing"; exit 1; }
[[ -f "$PKG/src/index.ts" ]]           || { echo "FAIL: $PKG/src/index.ts missing"; exit 1; }
[[ -f "$PKG/src/schema.ts" ]]          || { echo "FAIL: $PKG/src/schema.ts missing"; exit 1; }
[[ -f "$PKG/src/apps.ts" ]]            || { echo "FAIL: $PKG/src/apps.ts missing"; exit 1; }
[[ -f "$PKG/src/apps.test.ts" ]]       || { echo "FAIL: $PKG/src/apps.test.ts missing"; exit 1; }

# Must export a registerPlugin function (same contract as plugin-company A-01)
grep -q "export function registerPlugin" "$PKG/src/index.ts" \
  || { echo "FAIL: registerPlugin not exported from $PKG/src/index.ts"; exit 1; }

# Apps table must include the six columns PLAN.md B-01 requires
for col in "company_id" "channel_id" "connections" "env_vars" "production_domain"; do
  grep -q "\"$col\"" "$PKG/src/schema.ts" \
    || { echo "FAIL: apps schema missing column \"$col\""; exit 1; }
done

# Package builds, typechecks, tests pass
pnpm --filter "@paperclipai/plugin-apps-builder" build
pnpm --filter "@paperclipai/plugin-apps-builder" typecheck
pnpm --filter "@paperclipai/plugin-apps-builder" test:run

echo "▶ gate-B-01: all checks passed"
