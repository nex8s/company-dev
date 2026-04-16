# Company.dev — Agent Log

Append-only log of completed tasks. Format per SELF_CHECK_PROTOCOL.md.

---

## Phase 0 · 2026-04-16 · orchestrator
**Bootstrap:** forked paperclipai/paperclip → nex8s/company-dev, cloned to ~/company-dev/, added paperclip-upstream remote, staged ui-import/ (landing.html + dashboard.html), drafted bundle docs and agent prompts, created 3 feature branches.

**Verification gate:** `pnpm install` (29s, OK with expected plugin-sdk bin warnings), `pnpm typecheck` (all packages pass), `pnpm test:run` (1486/1488 pass, 1 skipped, 1 pre-existing upstream flake — `server/src/__tests__/cli-auth-routes.test.ts › creates a CLI auth challenge with approval metadata` times out at 5s in the full suite, passes in 1.2s isolated). Flake is unrelated to Phase 0 changes; monitoring.

---

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
