#!/usr/bin/env bash
# C-07: Drive view (files by department + pending review tab).
#
# Gate (PLAN.md): uploading a file shows it; agent-produced files appear
# in the right dept tab. There is no `plugin-drive` HTTP route on master
# yet (Paperclip ships per-issue documents and per-app files but no
# cross-issue aggregation), so the Drive view today reads from a typed
# mock shaped exactly like the future
# `GET /companies/:companyId/plugin-drive/files` response. The dept-
# routing + pending-tab UX is verified end-to-end against that mock;
# when the HTTP route mounts, swap MOCK_FILES in `useDriveData` for a
# `useQuery`.
set -euo pipefail

TASK_ID="C-07"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

for f in \
  "ui/src/copy/drive.ts" \
  "ui/src/hooks/useDriveData.ts" \
  "ui/src/pages/Drive.tsx" \
  "ui/src/pages/Drive.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

grep -qE 'from\s+"@/copy/drive"' ui/src/pages/Drive.tsx \
  || { echo "FAIL: Drive does not import from @/copy/drive"; exit 1; }
grep -qE 'from\s+"@/hooks/useDriveData"' ui/src/pages/Drive.tsx \
  || { echo "FAIL: Drive does not import from @/hooks/useDriveData"; exit 1; }

# CompanyShell mounts the route + hides the breadcrumb on /drive.
grep -qE 'path="drive"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell missing /drive route"; exit 1; }
grep -qE '/drive' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: ShellBreadcrumbSlot has no /drive branch"; exit 1; }
grep -qE 'navigate\(`/c/\$\{companyId\}/drive`\)' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell sidebar Drive button is not wired"; exit 1; }

# Brand-hex ban + reference-name guard.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in ui/src/pages/Drive.tsx ui/src/copy/drive.ts ui/src/hooks/useDriveData.ts; do
    if grep -qE "#${hex}" "$f"; then echo "FAIL: $f contains raw brand hex #${hex}"; exit 1; fi
  done
done
for f in ui/src/pages/Drive.tsx ui/src/copy/drive.ts ui/src/hooks/useDriveData.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then echo "FAIL: $f contains the reference brand name"; exit 1; fi
done

pnpm --filter "@paperclipai/ui" build
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/Drive.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
