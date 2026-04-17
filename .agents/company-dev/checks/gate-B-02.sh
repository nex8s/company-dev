#!/usr/bin/env bash
# B-02: Apps builder worker loop — given a prompt + App row, spawn the
# "Landing Page Engineer" agent with a scoped skillset and produce files
# under `apps/<app_id>/`.
#
# Gate criterion (PLAN.md): create App with prompt → agent produces files
# under apps/<app_id>/ → commits file tree to DB → emits "Deployed app"
# check-in.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-apps-builder"

echo "▶ gate-B-02: starting"

[[ -f "$PKG/src/builder/scaffold.ts" ]]               || { echo "FAIL: builder/scaffold.ts missing"; exit 1; }
[[ -f "$PKG/src/builder/build.ts" ]]                  || { echo "FAIL: builder/build.ts missing"; exit 1; }
[[ -f "$PKG/src/builder/build.test.ts" ]]             || { echo "FAIL: builder/build.test.ts missing"; exit 1; }

# Public surface of the builder
grep -q "export.*buildApp" "$PKG/src/builder/build.ts" \
  || { echo "FAIL: buildApp not exported from builder/build.ts"; exit 1; }
grep -q "LANDING_PAGE_ENGINEER_NAME" "$PKG/src/builder/build.ts" \
  || { echo "FAIL: LANDING_PAGE_ENGINEER_NAME not declared"; exit 1; }
grep -q "DEPLOYED_CHECK_IN_PREFIX" "$PKG/src/builder/build.ts" \
  || { echo "FAIL: DEPLOYED_CHECK_IN_PREFIX not declared"; exit 1; }

# Scaffold paths are rooted under apps/<app_id>/ (the gate's literal requirement).
grep -q 'apps/${input.appId}' "$PKG/src/builder/scaffold.ts" \
  || { echo "FAIL: scaffold does not root paths under apps/<app_id>/"; exit 1; }

# DB schema + migration
[[ -f "packages/db/src/schema/apps.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/apps.ts missing"; exit 1; }
[[ -f "packages/db/src/schema/app_files.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/app_files.ts missing"; exit 1; }
grep -q 'export { apps }' packages/db/src/schema/index.ts \
  || { echo "FAIL: apps not re-exported from db schema/index.ts"; exit 1; }
grep -q 'export { appFiles }' packages/db/src/schema/index.ts \
  || { echo "FAIL: appFiles not re-exported from db schema/index.ts"; exit 1; }
migration_file=$(find packages/db/src/migrations -maxdepth 1 -name '0063_*.sql' | head -1)
[[ -n "$migration_file" ]] \
  || { echo "FAIL: 0063 apps/app_files migration missing"; exit 1; }
grep -q 'CREATE TABLE "apps"' "$migration_file" \
  || { echo "FAIL: 0063 migration does not CREATE TABLE apps"; exit 1; }
grep -q 'CREATE TABLE "app_files"' "$migration_file" \
  || { echo "FAIL: 0063 migration does not CREATE TABLE app_files"; exit 1; }

# Plugin must be in root vitest projects list
grep -q '"packages/plugin-apps-builder"' vitest.config.ts \
  || { echo "FAIL: packages/plugin-apps-builder not in root vitest.config.ts projects"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-apps-builder" build
pnpm --filter "@paperclipai/plugin-apps-builder" typecheck
pnpm --filter "@paperclipai/plugin-apps-builder" test:run

echo "▶ gate-B-02: all checks passed"
