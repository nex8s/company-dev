#!/usr/bin/env bash
# B-07: Stripe integration — checkout session creator, customer portal link,
# webhook handler (subscription.*, invoice.paid), plans + top-ups.
#
# Gate criterion (PLAN.md): webhook signature check passes; subscription
# state reflected in DB; top-up credits added to ledger.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-payments"

echo "▶ gate-B-07: starting"

# 1. Stripe client surface
[[ -f "$PKG/src/stripe/types.ts" ]]                    || { echo "FAIL: stripe/types.ts missing"; exit 1; }
[[ -f "$PKG/src/stripe/mock-client.ts" ]]              || { echo "FAIL: stripe/mock-client.ts missing"; exit 1; }
grep -q "interface StripeClient" "$PKG/src/stripe/types.ts" \
  || { echo "FAIL: StripeClient interface not declared"; exit 1; }
grep -q "export class MockStripeClient" "$PKG/src/stripe/mock-client.ts" \
  || { echo "FAIL: MockStripeClient not exported"; exit 1; }
grep -q "StripeSignatureError" "$PKG/src/stripe/types.ts" \
  || { echo "FAIL: StripeSignatureError not declared"; exit 1; }

# 2. Billing domain (catalog + customer/subscription persistence + webhook dispatcher)
[[ -f "$PKG/src/billing/catalog.ts" ]]                 || { echo "FAIL: billing/catalog.ts missing"; exit 1; }
[[ -f "$PKG/src/billing/customers.ts" ]]               || { echo "FAIL: billing/customers.ts missing"; exit 1; }
[[ -f "$PKG/src/billing/subscriptions.ts" ]]           || { echo "FAIL: billing/subscriptions.ts missing"; exit 1; }
[[ -f "$PKG/src/billing/webhook-handler.ts" ]]         || { echo "FAIL: billing/webhook-handler.ts missing"; exit 1; }
for k in "starter" "pro"; do
  grep -q "\"$k\"" "$PKG/src/billing/catalog.ts" \
    || { echo "FAIL: plan '$k' missing from catalog"; exit 1; }
done
for c in 20 50 100 250; do
  grep -q "credits: $c" "$PKG/src/billing/catalog.ts" \
    || { echo "FAIL: top-up $c credits missing from catalog"; exit 1; }
done

# 3. HTTP router + supertest suite
[[ -f "$PKG/src/server/router.ts" ]]                   || { echo "FAIL: server/router.ts missing"; exit 1; }
[[ -f "$PKG/src/server/router.test.ts" ]]              || { echo "FAIL: server/router.test.ts missing"; exit 1; }
for route in "/checkout/subscription" "/checkout/top-up" "/portal" "/subscription" "/webhooks/stripe"; do
  grep -q "$route" "$PKG/src/server/router.ts" \
    || { echo "FAIL: route $route missing from router"; exit 1; }
done

# 4. DB: billing_customers + billing_subscriptions schema + migration 0067
[[ -f "packages/db/src/schema/billing_customers.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/billing_customers.ts missing"; exit 1; }
[[ -f "packages/db/src/schema/billing_subscriptions.ts" ]] \
  || { echo "FAIL: packages/db/src/schema/billing_subscriptions.ts missing"; exit 1; }
grep -q 'export { billingCustomers }' packages/db/src/schema/index.ts \
  || { echo "FAIL: billingCustomers not re-exported from db schema/index.ts"; exit 1; }
grep -q 'export { billingSubscriptions }' packages/db/src/schema/index.ts \
  || { echo "FAIL: billingSubscriptions not re-exported from db schema/index.ts"; exit 1; }
migration_file=$(find packages/db/src/migrations -maxdepth 1 -name '0067_billing.sql' | head -1)
[[ -n "$migration_file" ]] \
  || { echo "FAIL: 0067_billing.sql missing"; exit 1; }
grep -q 'CREATE TABLE "billing_customers"' "$migration_file" \
  || { echo "FAIL: 0067 migration missing CREATE TABLE billing_customers"; exit 1; }
grep -q 'CREATE TABLE "billing_subscriptions"' "$migration_file" \
  || { echo "FAIL: 0067 migration missing CREATE TABLE billing_subscriptions"; exit 1; }

# 5. Host mount
[[ -f "server/src/routes/plugin-payments.ts" ]] \
  || { echo "FAIL: server/src/routes/plugin-payments.ts mount file missing"; exit 1; }
grep -q "pluginPaymentsRoutes" server/src/app.ts \
  || { echo "FAIL: pluginPaymentsRoutes not mounted in server/src/app.ts"; exit 1; }
grep -q '"@paperclipai/plugin-payments"' server/package.json \
  || { echo "FAIL: server/package.json missing @paperclipai/plugin-payments dep"; exit 1; }

pnpm --filter "@paperclipai/db" build
pnpm --filter "@paperclipai/plugin-payments" build
pnpm --filter "@paperclipai/plugin-payments" typecheck
pnpm --filter "@paperclipai/plugin-payments" test:run
pnpm --filter "@paperclipai/server" typecheck

echo "▶ gate-B-07: all checks passed"
