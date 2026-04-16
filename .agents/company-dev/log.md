# Company.dev — Agent Log

Append-only log of completed tasks. Format per SELF_CHECK_PROTOCOL.md.

---

## Phase 0 · 2026-04-16 · orchestrator
**Bootstrap:** forked paperclipai/paperclip → nex8s/company-dev, cloned to ~/company-dev/, added paperclip-upstream remote, staged ui-import/ (landing.html + dashboard.html), drafted bundle docs and agent prompts, created 3 feature branches.

**Verification gate:** `pnpm install` (29s, OK with expected plugin-sdk bin warnings), `pnpm typecheck` (all packages pass), `pnpm test:run` (1486/1488 pass, 1 skipped, 1 pre-existing upstream flake — `server/src/__tests__/cli-auth-routes.test.ts › creates a CLI auth challenge with approval metadata` times out at 5s in the full suite, passes in 1.2s isolated). Flake is unrelated to Phase 0 changes; monitoring.

---

## C-02 · 2026-04-17 00:33 · agent-C
**Commit:** d0968d8b on `feat/frontend-port` (pushed to origin)
**Files:** ui/src/design/tokens.ts (new), ui/src/design/tokens.test.ts (new), ui/src/design/marketing.css (new), ui/tailwind.config.ts (new), ui/src/pages/Landing.tsx (new), ui/src/index.css (modified — adds `@config "../tailwind.config.ts"` and `@import "./design/marketing.css"`), .agents/company-dev/checks/gate-C-02.sh (new)
**Tests:** tokens.test.ts › exposes the four brand color tokens at their prototype values (pass), › registers DotGothic16 as the display face and Geist as sans (pass), › exposes cloud-glide and marquee animations with matching keyframes (pass), › exposes a Google Fonts href loading both families (pass), › tailwind.config.ts imports color/font/animation/keyframe tokens from ./src/design/tokens (pass), › Landing.tsx imports from @/design/tokens (pass)
**Gate output (tail):**
```
✓ built in 23.48s
RUN  v3.2.4 /Users/deusnexus/company-dev/ui
 ✓ src/design/tokens.test.ts (6 tests) 3ms
Test Files  1 passed (1)
     Tests  6 passed (6)
▶ gate-C-02: all checks passed
```
**Full-repo checks:**
- `pnpm typecheck`: all packages pass (all `Done`, no errors).
- `pnpm test:run`: 1491/1494 pass, 1 skipped, **2 new pre-existing flakes** observed:
  - `server/src/__tests__/issue-feedback-routes.test.ts › flushes a newly shared feedback trace immediately after saving the vote` — times out at 5s in full suite, passes in **1.6s isolated**.
  - `server/src/__tests__/openclaw-invite-prompt-route.test.ts › rejects non-CEO agent callers` — times out at 5s in full suite, passes in **1.6s isolated**.
  - Same class as the Phase 0 `cli-auth-routes.test.ts` flake: suite-level parallel contention, not a C-02 regression. C-02 touches only `ui/` and `.agents/` — no server code. Flagged to Orchestrator in `.agents/company-dev/questions/orchestrator.md`.

**Notes for next task (C-01):** Landing.tsx is currently a one-word scaffold; C-01 replaces the body with the full hero + composer + ambient cloud graphic. The `bg-cream`, `text-ink`, `text-mist`, `border-hairline`, `font-display`, `font-sans`, `animate-cloud-glide`, `animate-marquee` utilities are all wired. The prototype's named classes `bg-lines`, `bg-glow`, `dot-matrix`, `mask-cloud-left`, `mask-cloud-right` are shipped in `marketing.css` and can be used verbatim. Copy still needs to land in `ui/src/copy/landing.ts` per the hard rules — not created yet; C-01 owns it.

---

## A-01 · 2026-04-17 00:58 · agent-A
**Commit:** 4d7cb91a on `feat/backend-wiring` (pushed to origin)
**Files:** packages/plugin-company/package.json (new), packages/plugin-company/tsconfig.json (new), packages/plugin-company/vitest.config.ts (new), packages/plugin-company/src/index.ts (new — exports `registerPlugin`), packages/plugin-company/src/index.test.ts (new), pnpm-lock.yaml (workspace entry added)
**Tests:** index.test.ts › exports a registerPlugin function (pass), › registerPlugin returns the plugin name (pass)
**Gate output (tail):**
```
> @paperclipai/plugin-company@0.3.1 test:run
> vitest run
 RUN  v3.2.4 /Users/deusnexus/company-dev/packages/plugin-company
 ✓ src/index.test.ts (2 tests) 3ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  425ms
▶ gate-A-01: all checks passed
```
**Full-repo checks:**
- `pnpm typecheck`: all packages pass (all `Done`, no errors).
- `pnpm test:run`: **262/262 files pass, 1487/1488 tests pass, 1 skipped**, exit 0 in 136s. None of the flakes from prior runs (cli-auth-routes, issue-feedback-routes, openclaw-invite-prompt-route) reproduced on this run.

**Environment note:** first attempt at `pnpm test:run` on 2026-04-17 00:23 hit 3 failures in `workspace-runtime.test.ts` and `worktree.test.ts` — all `ENOSPC: No space left on device` provisioning embedded-postgres / git worktrees. Disk was at 100% (111 MiB free). After the orchestrator freed ~5.6 GiB, the suite passed cleanly. Not a code regression.

**Cross-agent note:** while checking out `feat/backend-wiring`, I found my `packages/plugin-company/` scaffold and Agent B's `packages/plugin-apps-builder/` scaffold (plus `gate-B-01.sh`, B's log entry, and B's `questions/orchestrator.md` entry) had all been left uncommitted in Agent C's working tree on `feat/frontend-port`. I stashed B's work separately with a clear `ORPHANED-ON-C-BRANCH` label for recovery — see `git stash list` on `feat/frontend-port`:
- `stash@{0}`: B's log.md + questions/orchestrator.md tracked modifications
- `stash@{1}`: B's plugin-apps-builder + gate-B-01.sh untracked files

Agent B needs to recover these onto `feat/new-features` before their next push.

**Notes for next task (A-02):** Picking up A-02 (CompanyProfile schema + Drizzle migration in `packages/db`) next. Depends on A-01 (now pushed); no other blockers. A-02 adds the `company_profiles` table — fields per PLAN.md A-02: name, description, positioning, target audience, strategy text, incorporated bool, logo, trial state. Gate: migration applies cleanly on a fresh DB + round-trip insert+select test.

## B-01 · 2026-04-17 01:05 · agent-B
**Commit:** 0b9f54e0 on `feat/new-features` (pushed to origin)
**Files:** packages/plugin-apps-builder/package.json (new), packages/plugin-apps-builder/tsconfig.json (new), packages/plugin-apps-builder/vitest.config.ts (new), packages/plugin-apps-builder/src/index.ts (new), packages/plugin-apps-builder/src/schema.ts (new), packages/plugin-apps-builder/src/apps.ts (new), packages/plugin-apps-builder/src/apps.test.ts (new), .agents/company-dev/checks/gate-B-01.sh (new), .agents/company-dev/questions/orchestrator.md (new on this branch)
**Tests:** apps.test.ts › creates an App row with the required columns (pass), › attaches a channel to an existing App (pass), › throws when attaching a channel to an unknown App (pass)
**Gate output (tail):**
```
> @paperclipai/plugin-apps-builder@0.1.0 test:run
> vitest run
 RUN  v3.2.4 /Users/deusnexus/company-dev-b/packages/plugin-apps-builder
 ✓ src/apps.test.ts (3 tests) 7ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  735ms
▶ gate-B-01: all checks passed
```
**Full-repo checks:**
- `pnpm typecheck`: all packages pass (exit 0).
- `pnpm test:run`: see full-suite-concurrency note in `questions/orchestrator.md`. A `pnpm dev` is running in the shared `~/company-dev` parent repo (PID 14912, started 7:44PM) and Agents A/C worktrees have each been running test:run concurrently — the combined embedded-postgres pressure is producing unrelated timeout failures in server tests (none touch this plugin's code). When only one worktree runs the suite at a time it passes (Agent A's A-01 log entry on `feat/backend-wiring` recorded a 262/262-file clean run after disk was freed). Orchestrator needs to verify on a quiesced checkout.

**Cross-agent blocker handling:** PLAN.md marks B-01 "Blocked by A-01". When I first ran this, A-01 hadn't merged, so I scaffolded by mirroring the conventions `gate-A-01.sh` asserts. A-01 has since landed on `feat/backend-wiring`; this package's `registerPlugin` export matches A-01's pattern. The `apps` table still uses unconstrained UUIDs for `company_id` and `channel_id` — A-02 (`company_profiles`) and B-02 (channel shape) haven't landed, so no FK is declared yet. Will tighten on rebase once those merge.

**Environment note:** first push attempt collided with Agent C's session in the shared `~/company-dev` working tree — my scaffold files got stashed by agent-A as `ORPHANED-ON-C-BRANCH` (stash@{1}), my log/questions edits stranded on `feat/frontend-port` (stash@{0}). Per orchestrator guidance, now working in a dedicated `git worktree` at `~/company-dev-b` pinned to `feat/new-features`. Agents A, B, C should each hold their own worktree going forward.

**Notes for next task (B-02):** `AppsRepository` is in-memory only. B-02 (apps builder worker loop) needs a Drizzle-backed implementation persisting to the `apps` table exported from this package, plus emission of Agent A's A-06 "via check-in" messages. A-03 and A-06 are the blockers; A-03 is next on Agent A's plan, A-06 later. Will stub + flag in `questions/orchestrator.md` at B-02 start if they haven't merged.

---

## B-04 · 2026-04-17 02:10 · agent-B
**Commit:** (pending push) on `feat/new-features`
**Files:** packages/plugin-store/package.json (new), packages/plugin-store/tsconfig.json (new), packages/plugin-store/vitest.config.ts (new), packages/plugin-store/src/index.ts (new — `registerPlugin`), packages/plugin-store/src/schema.ts (new — `store_templates` table), packages/plugin-store/src/types.ts (new — `SeedTemplate`, `TemplateEmployee`, `StoreTemplateRecord`), packages/plugin-store/src/repo.ts (new — `InMemoryStoreTemplatesRepository`, `listTemplates`), packages/plugin-store/src/repo.test.ts (new — 8 tests), packages/plugin-store/src/seeds/{faceless-youtube,smma,youtube-long-form,b2b-outbound-machine,dev-agency,devops-monitoring-ops,index}.ts (7 new), .agents/company-dev/checks/gate-B-04.sh (new)
**Tests:** repo.test.ts › loads exactly 6 seed templates (pass), › seeds each of the 6 expected slugs (pass), › every seed has the required shape (pass), › listTemplates filters by category (pass), › listTemplates filters by kind (pass), › listTemplates combines category + kind filters (pass), › getBySlug returns a loaded template (pass), › rejects duplicate seed slugs on a second loadSeeds (pass)
**Gate output (tail):**
```
> @paperclipai/plugin-store@0.1.0 test:run
> vitest run
 RUN  v3.2.4 /Users/deusnexus/company-dev-b/packages/plugin-store
 ✓ src/repo.test.ts (8 tests) 11ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  422ms
▶ gate-B-04: all checks passed
```
**Full-repo checks:**
- `pnpm typecheck`: all packages pass (exit 0).
- `pnpm test:run`: 263 files total · 262 passed, 1 failed · 1492 tests passed, 1 failed, 1 skipped, wall 138s.
  - Single failure: `agent-permissions-routes.test.ts > redacts agent detail for authenticated company members without agent admin permission` — 5037ms timeout in full suite, passes cleanly in **12s isolated (17/17 tests, every subtest ≤800ms)**.
  - Same class/signature as the three orchestrator-approved environmental flakes (`cli-auth-routes`, `issue-feedback-routes`, `openclaw-invite-prompt-route`) — parallel suite contention on embedded-postgres. Requesting the orchestrator add this one to the approved list (see `questions/orchestrator.md`).
  - This B-04 change is plugin-store only; zero touchpoints on server/agent-permissions code.

**Seed sourcing:** The first 3 (`faceless-youtube`, `smma`, `youtube-long-form`) are fresh copy in my own voice. The last 3 (`b2b-outbound-machine`, `dev-agency`, `devops-monitoring-ops`) adapt the agent role definitions from `~/Downloads/*-paperclip-config.json` (renaming generic "Engineer" slots to `Backend Engineer` / `Frontend Engineer` / `Integrations Engineer` in dev-agency; title-casing responsibilities). Summaries and titles are written fresh; no marketing copy copied from the reference source.

**Notes for next task:** B-05 (Store "Get" flow — install creates a new company + agents + skills in one transaction) depends on A-03 (agent seeding). B-06 (Store publishing — receives A-10 payload) depends on A-10. Neither is merged yet. Likely next: B-07 (Stripe — depends on A-07, not merged) or B-09/B-10/B-11/B-12 (provider interface stubs — all only blocked by A-01, which has merged). Will pick one of the provider stubs if nothing unblocks more meaningfully.
