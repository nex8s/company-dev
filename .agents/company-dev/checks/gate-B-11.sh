#!/usr/bin/env bash
# B-11: EmailProvider interface + MockEmailProvider + contract test.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-identity"

echo "▶ gate-B-11: starting"

[[ -f "$PKG/src/email/provider.ts" ]]               || { echo "FAIL: email/provider.ts missing"; exit 1; }
[[ -f "$PKG/src/email/mock.ts" ]]                   || { echo "FAIL: email/mock.ts missing"; exit 1; }
[[ -f "$PKG/src/email/contract.ts" ]]               || { echo "FAIL: email/contract.ts missing"; exit 1; }
[[ -f "$PKG/src/email/mock.contract.test.ts" ]]     || { echo "FAIL: email/mock.contract.test.ts missing"; exit 1; }
[[ -f "$PKG/src/email/index.ts" ]]                  || { echo "FAIL: email/index.ts missing"; exit 1; }

grep -q 'export \* from "./email/index.js"' "$PKG/src/index.ts" \
  || { echo "FAIL: email re-export missing from $PKG/src/index.ts"; exit 1; }

grep -q "export interface EmailProvider" "$PKG/src/email/provider.ts" \
  || { echo "FAIL: EmailProvider interface not defined"; exit 1; }

grep -q "export class MockEmailProvider" "$PKG/src/email/mock.ts" \
  || { echo "FAIL: MockEmailProvider class not exported"; exit 1; }

grep -q "runEmailProviderContract" "$PKG/src/email/contract.ts" \
  || { echo "FAIL: runEmailProviderContract not defined"; exit 1; }

for method in "provisionInbox" "sendEmail" "listMessages" "registerCustomDomain"; do
  grep -q "$method" "$PKG/src/email/provider.ts" \
    || { echo "FAIL: EmailProvider is missing method $method"; exit 1; }
done

pnpm --filter "@paperclipai/plugin-identity" build
pnpm --filter "@paperclipai/plugin-identity" typecheck
pnpm --filter "@paperclipai/plugin-identity" test:run

echo "▶ gate-B-11: all checks passed"
