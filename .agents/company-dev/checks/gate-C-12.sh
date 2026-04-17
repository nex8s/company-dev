#!/usr/bin/env bash
# C-12: Settings sub-pages — Manage Domains / Virtual Cards / Custom
# Dashboards / Connections + real Team tab.
#
# Gate (PLAN.md): each sub-page renders + CRUDs its resource. Live-wired
# to B-13 (virtual cards, agent-scoped fan-out) / B-14 (connections) /
# B-15 (domains) / A-08 (dashboards) / B-06 (team, invites, join-requests).
set -euo pipefail

TASK_ID="C-12"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "▶ gate-${TASK_ID}: starting in $REPO_ROOT"

for f in \
  "ui/src/api/plugin-connect-tools.ts" \
  "ui/src/api/plugin-dashboards.ts" \
  "ui/src/copy/settings-subpages.ts" \
  "ui/src/pages/company-tabs/settings/SubpageShell.tsx" \
  "ui/src/pages/company-tabs/settings/Domains.tsx" \
  "ui/src/pages/company-tabs/settings/Connections.tsx" \
  "ui/src/pages/company-tabs/settings/CustomDashboards.tsx" \
  "ui/src/pages/company-tabs/settings/VirtualCardsAggregate.tsx" \
  "ui/src/pages/company-tabs/settings/Team.tsx" \
  "ui/src/pages/company-tabs/settings/settings-subpages.test.tsx"; do
  [[ -f "$f" ]] || { echo "FAIL: $f missing"; exit 1; }
done

# Live wiring sanity — each page must call the real API.
grep -q 'pluginIdentityApi\.listDomains' ui/src/pages/company-tabs/settings/Domains.tsx \
  || { echo "FAIL: Domains not wired to pluginIdentityApi.listDomains"; exit 1; }
grep -q 'pluginConnectToolsApi\.listConnections' ui/src/pages/company-tabs/settings/Connections.tsx \
  || { echo "FAIL: Connections not wired to pluginConnectToolsApi.listConnections"; exit 1; }
grep -q 'pluginDashboardsApi\.listPages' ui/src/pages/company-tabs/settings/CustomDashboards.tsx \
  || { echo "FAIL: CustomDashboards not wired to pluginDashboardsApi.listPages"; exit 1; }
grep -q 'accessApi\.listCompanyMembers' ui/src/pages/company-tabs/settings/Team.tsx \
  || { echo "FAIL: Team not wired to accessApi.listCompanyMembers"; exit 1; }
grep -q 'pluginIdentityApi\.listAgentCards' ui/src/pages/company-tabs/settings/VirtualCardsAggregate.tsx \
  || { echo "FAIL: VirtualCardsAggregate not wired to pluginIdentityApi.listAgentCards"; exit 1; }

# Settings.tsx mounts the four new routes.
for slug in domains virtual-cards custom-dashboards connections; do
  grep -qE "path=\"${slug}\"" ui/src/pages/company-tabs/Settings.tsx \
    || { echo "FAIL: Settings does not mount ${slug} route"; exit 1; }
done
# Team sub-tab now uses the real component (not the placeholder).
grep -qE 'element=\{<SettingsTeam' ui/src/pages/company-tabs/Settings.tsx \
  || { echo "FAIL: Settings team route still uses the placeholder"; exit 1; }

# Brand-hex ban + reference-name guard.
for hex in "FBF9F6" "1A1A1A" "6E6E6E" "E5E5E5"; do
  for f in ui/src/pages/company-tabs/settings/*.tsx ui/src/copy/settings-subpages.ts ui/src/api/plugin-connect-tools.ts ui/src/api/plugin-dashboards.ts; do
    if grep -qE "#${hex}" "$f"; then echo "FAIL: $f contains raw brand hex #${hex}"; exit 1; fi
  done
done
for f in ui/src/pages/company-tabs/settings/*.tsx ui/src/copy/settings-subpages.ts; do
  if grep -q $'na\xc3\xafve' "$f"; then echo "FAIL: $f contains the reference brand name"; exit 1; fi
done

pnpm --filter "@paperclipai/ui" build
pnpm --filter "@paperclipai/ui" exec vitest run \
  src/pages/company-tabs/settings/settings-subpages.test.tsx

echo "▶ gate-${TASK_ID}: all checks passed"
