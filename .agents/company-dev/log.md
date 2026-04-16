# Company.dev — Agent Log

Append-only log of completed tasks. Format per SELF_CHECK_PROTOCOL.md.

---

## Phase 0 · 2026-04-16 · orchestrator
**Bootstrap:** forked paperclipai/paperclip → nex8s/company-dev, cloned to ~/company-dev/, added paperclip-upstream remote, staged ui-import/ (landing.html + dashboard.html), drafted bundle docs and agent prompts, created 3 feature branches.

**Verification gate:** `pnpm install` (29s, OK with expected plugin-sdk bin warnings), `pnpm typecheck` (all packages pass), `pnpm test:run` (1486/1488 pass, 1 skipped, 1 pre-existing upstream flake — `server/src/__tests__/cli-auth-routes.test.ts › creates a CLI auth challenge with approval metadata` times out at 5s in the full suite, passes in 1.2s isolated). Flake is unrelated to Phase 0 changes; monitoring.

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
