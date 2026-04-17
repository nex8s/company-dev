#!/usr/bin/env bash
# C-11: Upgrade page + Top-up modal wired to Stripe Checkout (B-07).
#
# Gate (PLAN.md): click Subscribe → redirect to Stripe test checkout URL.
# Verified end-to-end against the live B-07 endpoints; the Subscribe and
# Purchase Credits handlers POST `/checkout/{subscription,top-up}`, then
# set `window.location.href` to the returned `checkout.url`.
set -euo pipefail

TASK_ID="C-11"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

for f in \
  "ui/src/api/plugin-payments.ts" \
  "ui/src/copy/payments.ts" \
  "ui/src/pages/payments/Upgrade.tsx" \
  "ui/src/pages/payments/TopUpModal.tsx" \
  "ui/src/pages/payments/Upgrade.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# Wiring sanity — the page must hit the live B-07 endpoints.
for fn in getCatalog getSubscription createSubscriptionCheckout createTopUpCheckout; do
  grep -qrE "pluginPaymentsApi\.${fn}" ui/src/pages/payments/ \
    || { echo "FAIL: payments pages do not call pluginPaymentsApi.${fn}"; exit 1; }
done

# Shell wires /upgrade + the trial subscribe link + UserMenu items to navigate.
grep -qE 'path="upgrade"' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell missing /upgrade route"; exit 1; }
grep -qE 'navigate\(`/c/\$\{companyId\}/upgrade`\)' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: CompanyShell does not navigate to /upgrade"; exit 1; }
grep -qE '/upgrade' ui/src/pages/CompanyShell.tsx \
  || { echo "FAIL: ShellBreadcrumbSlot has no /upgrade branch"; exit 1; }

# Brand-hex ban + reference-name guard.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in ui/src/pages/payments/*.tsx ui/src/copy/payments.ts ui/src/api/plugin-payments.ts; do
    if grep -qE "#${hex}" "$f"; then
      echo "FAIL: $f contains raw brand hex #${hex}"; exit 1
    fi
  done
done
for f in ui/src/pages/payments/*.tsx ui/src/copy/payments.ts ui/src/api/plugin-payments.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then echo "FAIL: $f contains the reference brand name"; exit 1; fi
done

pnpm --filter "@paperclipai/ui" build
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/payments/Upgrade.test.tsx \
  src/pages/CompanyShell.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
