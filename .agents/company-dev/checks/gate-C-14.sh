#!/usr/bin/env bash
# C-14: Brand copy swap to Company.dev.
#
# Gate (PLAN.md): zero hits of the reference-brand pattern across
# ui/ server/ docs/company-dev/ packages/ — outside of:
#   - NOTICE.md (credits the upstream fork)
#   - ui-import/ (frozen reference prototype, by design)
#   - .agents/company-dev/log.md (historical agent log, appends only)
#   - docs/company-dev/PLAN.md (historical planning doc; A-03's CEO
#     agent spec says "Naive (CEO)" — the CEO agent NAME is kept)
#
# "Reference brand" here = the diacritical "Naïve" name plus the
# lower-cased URL/domain patterns that used to carry it (`usenaive`,
# `.naive.ai`). The ASCII agent name "Naive" is Company.dev's chosen
# default CEO display name and is intentionally preserved — see
# `packages/plugin-company/src/agents/factory.ts`.
set -euo pipefail

TASK_ID="C-14"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

SCAN_DIRS=(ui server docs/company-dev packages)
PATTERNS=(
  $'na\xc3\xafve'      # "Naïve" case-insensitive covers NAÏVE too via -i
  'usenaive'
  '\.naive\.ai'
  'naive-style'
)

# Allowlist of files that may legitimately mention the reference brand.
EXCLUDES=(
  "NOTICE.md"
  "ui-import/"
  ".agents/company-dev/log.md"
  "node_modules/"
)

declare -a grep_exclude_args=()
for ex in "${EXCLUDES[@]}"; do
  grep_exclude_args+=("--exclude-dir=${ex%/}")
done

fail=0
for pat in "${PATTERNS[@]}"; do
  hits=$(grep -rniE "$pat" \
    --include="*.ts" --include="*.tsx" --include="*.md" \
    --include="*.json" --include="*.css" --include="*.html" \
    "${grep_exclude_args[@]}" \
    "${SCAN_DIRS[@]}" 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    echo "FAIL: reference-brand pattern '$pat' found:"
    echo "$hits"
    fail=1
  fi
done
[[ $fail -eq 0 ]] || exit 1

# Positive assertion — the chosen brand is actually in use where we
# expect it (copy files, NOTICE). This catches a regression where
# someone accidentally blanks everything.
grep -qE 'Company\.dev' NOTICE.md \
  || { echo "FAIL: NOTICE.md does not mention Company.dev"; exit 1; }
grep -qrE 'Company\.dev' ui/src/copy/ \
  || { echo "FAIL: no ui/src/copy/ file mentions Company.dev"; exit 1; }

# Agent CEO display name stays "Naive" (ASCII) — catch a mistaken
# over-swap that changed the agent identity.
grep -qE 'CEO_DEFAULT_NAME\s*=\s*"Naive"' \
  packages/plugin-company/src/agents/factory.ts \
  || { echo "FAIL: CEO_DEFAULT_NAME changed away from 'Naive' — that's the agent display name, not the brand"; exit 1; }

echo "▶ gate-${TASK_ID}: all checks passed"
