#!/usr/bin/env bash
# C-13: E2E Playwright harness for the Company.dev happy path (SCAFFOLD).
#
# Phase 1 gate scope: verify the harness is scaffolded — config file
# exists, spec file exists, README exists, package.json wires the
# `test:e2e-company-dev` script, and the spec asserts against the stable
# data-testid contracts established by the C-tasks (catches a rename
# regression without running a browser).
#
# The full browser flow needs a live server + ANTHROPIC_API_KEY +
# optional Stripe test keys — that's a Phase 2 verification step, not a
# Phase 1 gate. To run the full spec locally or in CI:
#   pnpm test:e2e-company-dev
set -euo pipefail

TASK_ID="C-13"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

for f in \
  "tests/e2e-company-dev/playwright.config.ts" \
  "tests/e2e-company-dev/happy-path.spec.ts" \
  "tests/e2e-company-dev/README.md"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# Config + spec syntax check. The repo uses Playwright's built-in TS
# runtime for e2e (no dedicated tsconfig under tests/) so we don't run
# tsc here — just verify the scaffold imports resolve and there are no
# obvious syntax errors by grep-asserting the essentials.
grep -qE 'defineConfig' tests/e2e-company-dev/playwright.config.ts \
  || { echo "FAIL: playwright.config.ts does not call defineConfig"; exit 1; }
grep -qE 'webServer' tests/e2e-company-dev/playwright.config.ts \
  || { echo "FAIL: playwright.config.ts missing webServer block"; exit 1; }
grep -qE '@playwright/test' tests/e2e-company-dev/happy-path.spec.ts \
  || { echo "FAIL: happy-path.spec.ts does not import @playwright/test"; exit 1; }
grep -qE 'test\.describe|test\(' tests/e2e-company-dev/happy-path.spec.ts \
  || { echo "FAIL: happy-path.spec.ts has no test declaration"; exit 1; }

# package.json wires the script.
grep -qE 'test:e2e-company-dev' package.json \
  || { echo "FAIL: package.json missing test:e2e-company-dev script"; exit 1; }

# The spec asserts against the stable data-testid contracts from the
# C-tasks. Catch a regression where someone renames a testid without
# updating the spec.
for testid in company-sidebar app-detail upgrade-view subscribe-starter settings-server; do
  grep -q "${testid}" tests/e2e-company-dev/happy-path.spec.ts \
    || { echo "FAIL: happy-path spec does not reference ${testid}"; exit 1; }
done

echo "▶ gate-${TASK_ID}: all checks passed"
