#!/usr/bin/env bash
# A-01: plugin-company package scaffold builds, typechecks, and has a runnable (possibly empty) test suite.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-company"

echo "▶ gate-A-01: starting"

[[ -d "$PKG" ]]                        || { echo "FAIL: $PKG missing"; exit 1; }
[[ -f "$PKG/package.json" ]]           || { echo "FAIL: $PKG/package.json missing"; exit 1; }
[[ -f "$PKG/tsconfig.json" ]]          || { echo "FAIL: $PKG/tsconfig.json missing"; exit 1; }
[[ -f "$PKG/src/index.ts" ]]           || { echo "FAIL: $PKG/src/index.ts missing"; exit 1; }

# Must export a registerPlugin function (signature asserted by plugin-contract.test.ts)
grep -q "export function registerPlugin" "$PKG/src/index.ts" \
  || { echo "FAIL: registerPlugin not exported from $PKG/src/index.ts"; exit 1; }

# Package builds cleanly
pnpm --filter "@paperclipai/plugin-company" build

# Package typechecks cleanly
pnpm --filter "@paperclipai/plugin-company" typecheck

# Test runner starts even if suite is empty
pnpm --filter "@paperclipai/plugin-company" test:run

echo "▶ gate-A-01: all checks passed"
