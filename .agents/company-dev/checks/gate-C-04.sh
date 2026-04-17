#!/usr/bin/env bash
# C-04: Company > Chat view.
#
# Gate (from PLAN.md): Playwright: user sends a message → bubble appears;
# @mention autocomplete works; agent reply streams in.
#
# Playwright harness lands in C-13 under `tests/e2e-company-dev/`. Until
# then the render contract + mention-helper pure-function contract + stub
# reply-delay smoke is what enforces correctness. TODO(C-13): wire the
# Playwright happy-path into this gate.
#
# A-06 (heartbeat/check-in system-message emitter) has not merged — the
# seed thread contains stubbed "via check-in" system messages and the
# user-send flow stubs a 300ms agent reply. Three swap points in
# `useCompanyChat.ts` are tagged `TODO(A-06)` for the literal replacement.
set -euo pipefail

TASK_ID="C-04"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

# 1. Required files exist.
for f in \
  "ui/src/pages/CompanyChat.tsx" \
  "ui/src/pages/CompanyChat.test.tsx" \
  "ui/src/copy/chat.ts" \
  "ui/src/hooks/useCompanyChat.ts"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# 2. CompanyChat imports copy + chat hook + shell data hook for mentions.
grep -qE 'from\s+"@/copy/chat"' ui/src/pages/CompanyChat.tsx \
  || { echo "FAIL: CompanyChat does not import from @/copy/chat"; exit 1; }
grep -qE 'from\s+"@/hooks/useCompanyChat"' ui/src/pages/CompanyChat.tsx \
  || { echo "FAIL: CompanyChat does not import from @/hooks/useCompanyChat"; exit 1; }
grep -qE 'from\s+"@/hooks/useCompanyShellData"' ui/src/pages/CompanyChat.tsx \
  || { echo "FAIL: CompanyChat does not import from @/hooks/useCompanyShellData"; exit 1; }

# 3. CompanyShell wires CompanyChat at the index route so /c/:companyId
#    renders Chat by default (ARCHITECTURE.md: "Company shell (Chat default)").
grep -qE '<Route\s+index\s+element=\{<CompanyChat' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not render CompanyChat at its index route"; exit 1; }

# 4. Brand-hex ban — same as C-01/C-03.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  if grep -qE "#${hex}" ui/src/pages/CompanyChat.tsx; then
    echo "FAIL: CompanyChat.tsx contains raw brand hex #${hex} — use the Tailwind utility"
    exit 1
  fi
done

# 5. Reference-brand-name local guard.
for f in \
  "ui/src/pages/CompanyChat.tsx" \
  "ui/src/copy/chat.ts" \
  "ui/src/hooks/useCompanyChat.ts"; do
  if grep -q $'na\xc3\xafve' "$f"; then
    echo "FAIL: $f contains the reference brand name"
    exit 1
  fi
done

# 6. UI package builds cleanly.
pnpm --filter "@paperclipai/ui" build

# 7. Chat tests pass (render + mention popover + stub reply timer + pure
#    helpers). Shell gate-C-03 already covers the /c/:companyId index route
#    mounting CompanyChat.
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/CompanyChat.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
