# Orchestrator State — 2026-04-17 05:55

## Master tip
`81298947` on `origin/master`

## Merged tasks (14/39 = 36%)

| ID | Task | Merge commit |
|---|---|---|
| A-01 | plugin-company scaffold | 4712000a |
| A-02 | CompanyProfile schema + migration | 3d830650 |
| A-03 | Agent role seeding (CEO + factory) | 084ef70e |
| A-04 | Getting Started checklist | f4b0ae13 |
| A-05 | Pending review queue | 164d8e88 |
| B-01 | plugin-apps-builder scaffold | 646dd3eb |
| B-04 | Store schema + 6 seed templates | fa91e5f3 |
| B-05 | Store "Get" install flow | 5c045f7d |
| B-09 | IdentityProvider + MockIdentityProvider | be706661 |
| C-01 | Landing page port | 1d9ff22e |
| C-02 | Design tokens + Tailwind theme | 4712000a |
| C-03 | Company shell (sidebar, popovers, Getting Started) | 8f4537a9 |
| C-04 | Company Chat view + C-03 stub-match patch | cb5a634f |
| A-06 | heartbeat check-in poster (plugin-company) | 81298947 |

## Next tasks per agent

### Agent A — next: A-06.5 (HTTP routes + run-stream wiring) — AUTHORIZED 2026-04-17 05:55
- Branch: `feat/backend-wiring` at 40ff1adb (merged to master via 81298947)
- Scope: zod-validated HTTP routes for plugin-company (getChecklist, completeStep, listPendingReviews, approveReview, rejectReview, CompanyProfile CRUD) + subscribe A-06 check-in-poster to Paperclip's run-status stream in the same plugin-bootstrap module
- Unblocks: Agent C's C-05 (swap stubs for live queries)
- Handoff file: `.agents/company-dev/questions/agent-a.md`

### Agent B — next: B-10 (BankProvider + Mock)
- Branch: `feat/new-features` at 1ae0f49f
- Status: B-09 done and merged, B-10 next, then B-11, B-12
- Note: stray conflict marker in `packages/db/src/migrations/meta/0058_snapshot.json` (non-blocking for B-10–B-12)
- Handoff file: `.agents/company-dev/questions/agent-b.md`

### Agent C — next: C-05 (Overview/Strategy/Payments/Settings tabs)
- Branch: `feat/frontend-port` at 541c5df5
- Status: C-04 done and merged
- Next ranking: C-05 → C-06 → C-13 → C-14
- Blockers: no HTTP routes for plugin-company (Agent A side task); C-13 Playwright harness absent
- Handoff file: `.agents/company-dev/questions/agent-c.md`

## Known environmental flakes (5 tests)
These pass isolated, timeout at 5s under full-suite parallelism. Don't block task completion.
1. `server/src/__tests__/cli-auth-routes.test.ts`
2. `server/src/__tests__/issue-feedback-routes.test.ts`
3. `server/src/__tests__/openclaw-invite-prompt-route.test.ts`
4. `server/src/__tests__/agent-permissions-routes.test.ts`
5. `server/src/__tests__/issue-activity-events-routes.test.ts`

## Merge conflict fix applied
09b8b800 — resolved conflict markers in schema/index.ts + _journal.json, renumbered B-05's migration 0058→0060.

## Agent worktrees
- `~/company-dev` — orchestrator (master)
- `~/company-dev-a` — Agent A (feat/backend-wiring)
- `~/company-dev-b` — Agent B (feat/new-features)
- `~/company-dev-c` — Agent C (feat/frontend-port)

## Key docs (for relaunch prompts)
- `docs/company-dev/PLAN.md` — full task breakdown
- `docs/company-dev/ARCHITECTURE.md` — how plugins fit
- `docs/company-dev/FEATURE_MAPPING.md` — every view → data source
- `docs/company-dev/PROVIDER_INTERFACES.md` — B-09 through B-12 spec
- `docs/company-dev/SELF_CHECK_PROTOCOL.md` — verification rules
- `.agents/company-dev/prompts/AGENT_{A,B,C}_PROMPT.md` — original agent briefs

## Vitest config
Fixed in 164d8e88 — plugin-company, plugin-apps-builder, plugin-store added to root vitest.config.ts projects list. Future plugins (plugin-identity, plugin-payments, plugin-integrations, plugin-dashboards) need to be added when scaffolded.

## Stripe / integrations / LLM keys
All placeholder (.env.example). Stripe test keys needed for B-07. Anthropic key needed for E2E (C-13). User said "LATER" for both.

## Disk
~4.6 GB free. Tier 1+2 cleanup (~9.3 GB reclaimable from old node_modules + caches) was proposed but not authorized yet.
