#!/usr/bin/env bash
# B-04: plugin-store scaffold + StoreTemplate schema + 6 seeded templates + listTemplates filter.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-store"

echo "▶ gate-B-04: starting"

[[ -d "$PKG" ]]                        || { echo "FAIL: $PKG missing"; exit 1; }
[[ -f "$PKG/package.json" ]]           || { echo "FAIL: $PKG/package.json missing"; exit 1; }
[[ -f "$PKG/tsconfig.json" ]]          || { echo "FAIL: $PKG/tsconfig.json missing"; exit 1; }
[[ -f "$PKG/src/index.ts" ]]           || { echo "FAIL: $PKG/src/index.ts missing"; exit 1; }
[[ -f "$PKG/src/schema.ts" ]]          || { echo "FAIL: $PKG/src/schema.ts missing"; exit 1; }
[[ -f "$PKG/src/types.ts" ]]           || { echo "FAIL: $PKG/src/types.ts missing"; exit 1; }
[[ -f "$PKG/src/repo.ts" ]]            || { echo "FAIL: $PKG/src/repo.ts missing"; exit 1; }
[[ -f "$PKG/src/repo.test.ts" ]]       || { echo "FAIL: $PKG/src/repo.test.ts missing"; exit 1; }

# Must export a registerPlugin function (same contract as plugin-company / plugin-apps-builder)
grep -q "export function registerPlugin" "$PKG/src/index.ts" \
  || { echo "FAIL: registerPlugin not exported from $PKG/src/index.ts"; exit 1; }

# store_templates table must include the six PLAN.md-required columns
for col in "kind" "category" "skills" "employees" "creator" "download_count"; do
  grep -q "\"$col\"" "$PKG/src/schema.ts" \
    || { echo "FAIL: store_templates schema missing column \"$col\""; exit 1; }
done

# Exactly 6 seed modules for the 6 starter businesses (plus the aggregator index.ts)
SEED_COUNT=$(ls "$PKG/src/seeds/" | grep -cE '^(faceless-youtube|smma|youtube-long-form|b2b-outbound-machine|dev-agency|devops-monitoring-ops)\.ts$')
[[ "$SEED_COUNT" = "6" ]] \
  || { echo "FAIL: expected 6 starter-business seed files, found $SEED_COUNT"; exit 1; }
[[ -f "$PKG/src/seeds/index.ts" ]]     || { echo "FAIL: $PKG/src/seeds/index.ts missing"; exit 1; }

# Package builds, typechecks, tests pass (tests assert seed=6 + listTemplates filters)
pnpm --filter "@paperclipai/plugin-store" build
pnpm --filter "@paperclipai/plugin-store" typecheck
pnpm --filter "@paperclipai/plugin-store" test:run

echo "▶ gate-B-04: all checks passed"
