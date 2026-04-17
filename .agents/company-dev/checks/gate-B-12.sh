#!/usr/bin/env bash
# B-12: BrowserProvider interface + MockBrowserProvider + contract test.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PKG="packages/plugin-identity"

echo "▶ gate-B-12: starting"

[[ -f "$PKG/src/browser/provider.ts" ]]               || { echo "FAIL: browser/provider.ts missing"; exit 1; }
[[ -f "$PKG/src/browser/mock.ts" ]]                   || { echo "FAIL: browser/mock.ts missing"; exit 1; }
[[ -f "$PKG/src/browser/contract.ts" ]]               || { echo "FAIL: browser/contract.ts missing"; exit 1; }
[[ -f "$PKG/src/browser/mock.contract.test.ts" ]]     || { echo "FAIL: browser/mock.contract.test.ts missing"; exit 1; }
[[ -f "$PKG/src/browser/index.ts" ]]                  || { echo "FAIL: browser/index.ts missing"; exit 1; }

grep -q 'export \* from "./browser/index.js"' "$PKG/src/index.ts" \
  || { echo "FAIL: browser re-export missing from $PKG/src/index.ts"; exit 1; }

grep -q "export interface BrowserProvider" "$PKG/src/browser/provider.ts" \
  || { echo "FAIL: BrowserProvider interface not defined"; exit 1; }

grep -q "export class MockBrowserProvider" "$PKG/src/browser/mock.ts" \
  || { echo "FAIL: MockBrowserProvider class not exported"; exit 1; }

grep -q "runBrowserProviderContract" "$PKG/src/browser/contract.ts" \
  || { echo "FAIL: runBrowserProviderContract not defined"; exit 1; }

for method in "startSession" "attachTool" "getLiveViewUrl" "stopSession" "getSessionArtifacts"; do
  grep -q "$method" "$PKG/src/browser/provider.ts" \
    || { echo "FAIL: BrowserProvider is missing method $method"; exit 1; }
done

pnpm --filter "@paperclipai/plugin-identity" build
pnpm --filter "@paperclipai/plugin-identity" typecheck
pnpm --filter "@paperclipai/plugin-identity" test:run

echo "▶ gate-B-12: all checks passed"
