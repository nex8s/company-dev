#!/usr/bin/env bash
# A-03: Agent role seeding — CEO seeded on company creation, hireAgent factory
# produces a new agent tagged with the correct department.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-A-03: starting"

# 1. Source files exist.
FACTORY="packages/plugin-company/src/agents/factory.ts"
PROMPTS="packages/plugin-company/src/agents/prompts.ts"
TESTS="packages/plugin-company/src/agents/factory.test.ts"
[[ -f "$FACTORY" ]] || { echo "FAIL: $FACTORY missing"; exit 1; }
[[ -f "$PROMPTS" ]] || { echo "FAIL: $PROMPTS missing"; exit 1; }
[[ -f "$TESTS" ]]   || { echo "FAIL: $TESTS missing"; exit 1; }

# 2. The expected API surface is exported.
grep -q "export async function seedCompanyAgents" "$FACTORY" \
  || { echo "FAIL: seedCompanyAgents not exported"; exit 1; }
grep -q "export async function hireAgent" "$FACTORY" \
  || { echo "FAIL: hireAgent not exported"; exit 1; }
grep -q "export async function findCeo" "$FACTORY" \
  || { echo "FAIL: findCeo not exported"; exit 1; }
grep -q "export async function listDirectReports" "$FACTORY" \
  || { echo "FAIL: listDirectReports not exported"; exit 1; }

# 3. All five hireable departments are declared.
for dept in engineering marketing operations sales support; do
  grep -q "\"$dept\"" "$PROMPTS" \
    || { echo "FAIL: department '$dept' missing from prompts catalog"; exit 1; }
done

# 4. Plugin-company exports the factory + prompts from the package entrypoint.
grep -q 'export \* from "./agents/factory.js";' packages/plugin-company/src/index.ts \
  || { echo "FAIL: plugin-company/src/index.ts does not re-export agent factory"; exit 1; }
grep -q 'export \* from "./agents/prompts.js";' packages/plugin-company/src/index.ts \
  || { echo "FAIL: plugin-company/src/index.ts does not re-export prompts catalog"; exit 1; }

# 5. Package builds + typechecks.
pnpm --filter "@paperclipai/plugin-company" build
pnpm --filter "@paperclipai/plugin-company" typecheck

# 6. Behavioural checks live in factory.test.ts — run only the A-03 test file to
#    keep the gate fast. It asserts (a) seedCompanyAgents yields 1 CEO with 0
#    direct reports, (b) hireAgent(dept='Marketing') tags the new agent with
#    role='marketing' and reports to the CEO, (c) idempotent re-seed, (d) all
#    five hireable departments, (e) runtime guards on ceo / unknown dept, (f)
#    hireAgent without a seeded CEO throws.
pnpm --filter "@paperclipai/plugin-company" exec vitest run src/agents/factory.test.ts

echo "▶ gate-A-03: all checks passed"
