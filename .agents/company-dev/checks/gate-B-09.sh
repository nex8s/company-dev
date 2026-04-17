#!/usr/bin/env bash
# B-09: IdentityProvider interface + MockIdentityProvider + contract test.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-identity"

echo "▶ gate-B-09: starting"

[[ -f "$PKG/package.json" ]]                              || { echo "FAIL: $PKG/package.json missing"; exit 1; }
[[ -f "$PKG/tsconfig.json" ]]                             || { echo "FAIL: $PKG/tsconfig.json missing"; exit 1; }
[[ -f "$PKG/src/index.ts" ]]                              || { echo "FAIL: $PKG/src/index.ts missing"; exit 1; }
[[ -f "$PKG/src/identity/provider.ts" ]]                  || { echo "FAIL: provider.ts missing"; exit 1; }
[[ -f "$PKG/src/identity/mock.ts" ]]                      || { echo "FAIL: mock.ts missing"; exit 1; }
[[ -f "$PKG/src/identity/contract.ts" ]]                  || { echo "FAIL: contract.ts missing"; exit 1; }
[[ -f "$PKG/src/identity/mock.contract.test.ts" ]]        || { echo "FAIL: mock.contract.test.ts missing"; exit 1; }

grep -q "export function registerPlugin" "$PKG/src/index.ts" \
  || { echo "FAIL: registerPlugin not exported from $PKG/src/index.ts"; exit 1; }

grep -q "export interface IdentityProvider" "$PKG/src/identity/provider.ts" \
  || { echo "FAIL: IdentityProvider interface not defined"; exit 1; }

grep -q "export class MockIdentityProvider" "$PKG/src/identity/mock.ts" \
  || { echo "FAIL: MockIdentityProvider class not exported"; exit 1; }

grep -q "runIdentityProviderContract" "$PKG/src/identity/contract.ts" \
  || { echo "FAIL: runIdentityProviderContract not defined"; exit 1; }

# All four interface methods from PROVIDER_INTERFACES.md must be declared
for method in "createLegalEntity" "getLegalEntity" "listForCompany" "dissolveLegalEntity"; do
  grep -q "$method" "$PKG/src/identity/provider.ts" \
    || { echo "FAIL: IdentityProvider is missing method $method"; exit 1; }
done

pnpm --filter "@paperclipai/plugin-identity" build
pnpm --filter "@paperclipai/plugin-identity" typecheck
pnpm --filter "@paperclipai/plugin-identity" test:run

echo "▶ gate-B-09: all checks passed"
