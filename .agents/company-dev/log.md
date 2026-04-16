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

