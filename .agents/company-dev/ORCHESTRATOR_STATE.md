# Orchestrator State — 2026-04-17 15:45

## Master tip
`41cf76e3` on `origin/master`

## Merged tasks (20/39 = 51%)

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
| A-06.5 | plugin-company HTTP routes + check-in wiring | 584e0359 |
| C-05 | Overview/Strategy/Payments/Settings tabs | 4d7bb086 |
| B-10 | BankProvider + MockBankProvider + contract | 92ba0a7e |
| B-11 | EmailProvider + MockEmailProvider + contract | 92ba0a7e |
| B-12 | BrowserProvider + MockBrowserProvider + contract | 92ba0a7e |
| C-06 | Tasks kanban + sidebar wiring (live Needs Review) | 41cf76e3 |

## Next tasks per agent

### Agent A — next: A-06.6 (runtime-new-company auto-wire) then A-07 — AUTHORIZED 2026-04-17 14:15
- Branch: `feat/backend-wiring` at a1cfb7cc (merged via 584e0359)
- A-06.6 scope: add `subscribeAllCompaniesLiveEvents` to `server/src/services/live-events.ts` and swap the boot-time per-company loop in `app.ts` for a single global subscription. Option (1) from the agent-A question. Keeps us off the plugin-event-bus path for now and works for any company lifecycle.
- Unblocks (still): Agent C's C-05 already unblocked by A-06.5 — HTTP routes live and mounted at `/api/companies/:companyId/plugin-company/*`.
- Handoff file: `.agents/company-dev/questions/agent-a.md`

### Agent B — next: B-13 (Virtual Cards UI backend) — AUTHORIZED 2026-04-17 14:25
- Branch: `feat/new-features` at 6bcbc59b (merged via 92ba0a7e)
- Status: B-10/B-11/B-12 all done and merged in one group
- Next ranking: B-13 → B-14 (Connect-tools scaffold) → B-15 (Domains mgmt). B-06 blocked on A-10; B-07 on A-07; B-08 on B-07+A-07+A-09.
- Bonus: `vitest.config.ts` now includes `plugin-identity` in projects (consistent with prior 164d8e88 pattern)
- Handoff file: `.agents/company-dev/questions/agent-b.md`

### Agent C — next: C-08 (Store view) OR C-09 (Employees view) — BOTH AUTHORIZED 2026-04-17 15:45
- Branch: `feat/frontend-port` at 2e28cab6 (merged via 41cf76e3)
- Status: C-06 done and merged; Needs Review column live against A-06.5 endpoints
- C-08: Store view — B-04/B-05 merged, install-flow contract exists. Same sidebar-sibling pattern as Tasks.
- C-09: **now unblocked** — B-10/B-11/B-12 all landed in 92ba0a7e. Employee detail tabs can render against all four MockProvider contracts.
- Other queued: C-13 (Playwright harness), C-14 (brand swap)
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
