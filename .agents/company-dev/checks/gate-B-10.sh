#!/usr/bin/env bash
# B-10: BankProvider interface + MockBankProvider + contract test.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-identity"

echo "▶ gate-B-10: starting"

[[ -f "$PKG/src/bank/provider.ts" ]]               || { echo "FAIL: bank/provider.ts missing"; exit 1; }
[[ -f "$PKG/src/bank/mock.ts" ]]                   || { echo "FAIL: bank/mock.ts missing"; exit 1; }
[[ -f "$PKG/src/bank/contract.ts" ]]               || { echo "FAIL: bank/contract.ts missing"; exit 1; }
[[ -f "$PKG/src/bank/mock.contract.test.ts" ]]     || { echo "FAIL: bank/mock.contract.test.ts missing"; exit 1; }
[[ -f "$PKG/src/bank/index.ts" ]]                  || { echo "FAIL: bank/index.ts missing"; exit 1; }

grep -q 'export \* from "./bank/index.js"' "$PKG/src/index.ts" \
  || { echo "FAIL: bank re-export missing from $PKG/src/index.ts"; exit 1; }

grep -q "export interface BankProvider" "$PKG/src/bank/provider.ts" \
  || { echo "FAIL: BankProvider interface not defined"; exit 1; }

grep -q "export class MockBankProvider" "$PKG/src/bank/mock.ts" \
  || { echo "FAIL: MockBankProvider class not exported"; exit 1; }

grep -q "runBankProviderContract" "$PKG/src/bank/contract.ts" \
  || { echo "FAIL: runBankProviderContract not defined"; exit 1; }

# All five interface methods from PROVIDER_INTERFACES.md must be declared
for method in "openAccount" "issueVirtualCard" "listCards" "listTransactions" "freezeCard"; do
  grep -q "$method" "$PKG/src/bank/provider.ts" \
    || { echo "FAIL: BankProvider is missing method $method"; exit 1; }
done

# plugin-identity must be in root vitest projects list so the contract tests actually run
grep -q '"packages/plugin-identity"' vitest.config.ts \
  || { echo "FAIL: packages/plugin-identity not in root vitest.config.ts projects"; exit 1; }

pnpm --filter "@paperclipai/plugin-identity" build
pnpm --filter "@paperclipai/plugin-identity" typecheck
pnpm --filter "@paperclipai/plugin-identity" test:run

echo "▶ gate-B-10: all checks passed"
