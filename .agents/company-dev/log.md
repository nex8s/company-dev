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

## A-02 · 2026-04-17 01:58 · agent-A
**Commit:** 54dc7946 on `feat/backend-wiring` (pushed to origin)
**Worktree:** `~/company-dev-a` (dedicated Agent-A worktree, created this session per orchestrator guidance after shared-worktree branch collisions on 2026-04-17 ~00:45)
**Files:**
- `packages/db/src/schema/company_profiles.ts` (new — Drizzle table)
- `packages/db/src/schema/index.ts` (re-export)
- `packages/db/src/migrations/0057_aberrant_baron_strucker.sql` (new — drizzle-generated forward migration)
- `packages/db/src/migrations/meta/0057_snapshot.json` + `_journal.json` (drizzle-kit bookkeeping)
- `packages/db/src/rollbacks/0057_aberrant_baron_strucker.down.sql` (new — hand-written rollback sibling)
- `packages/plugin-company/src/schema.ts` (new — re-exports `companyProfiles` + typed `CompanyProfile` / `NewCompanyProfile` / `TrialState`)
- `packages/plugin-company/src/index.ts` (re-exports `./schema.js`)
- `packages/plugin-company/src/company-profile.test.ts` (new — embedded-postgres round-trip tests)
- `packages/plugin-company/package.json` (adds `@paperclipai/db` + `drizzle-orm` deps)
- `.agents/company-dev/checks/gate-A-02.sh` (new)
- `pnpm-lock.yaml`

**Tests:** `company-profile.test.ts`:
- `round-trips an insert+select on a freshly-migrated database` (pass, 12.2s)
- `enforces one profile per company (unique company_id)` (pass, 13.7s)
- `cascades delete from companies to company_profiles` (pass, 13.9s)

**Gate output (tail):**
```
 RUN  v3.2.4 /Users/deusnexus/company-dev-a/packages/plugin-company
 ✓ src/index.test.ts (2 tests) 20ms
 ✓ src/company-profile.test.ts (3 tests) 39832ms
 Test Files  2 passed (2)
      Tests  5 passed (5)
   Duration  55.94s
▶ gate-A-02: all checks passed
```

**Full-repo checks:**
- `pnpm typecheck`: all packages pass (exit 0).
- `pnpm test:run`: **260/262 files pass, 1485/1488 tests pass, 1 skipped, 2 failed** — both suite-parallelism flakes, verified passing in isolation:
  - `server/src/__tests__/assets.test.ts › accepts PNG image uploads and returns an asset path` — timed out at 5s in full suite, passed in **1.9s isolated**.
  - `paperclipai/src/__tests__/company-import-export-e2e.test.ts › exports a company package and imports it into new and existing companies` — timed out at 60s in full suite, passed in **26.8s isolated**.
  - Same class as the Phase 0 (cli-auth-routes) and C-02 (issue-feedback-routes, openclaw-invite-prompt-route) flakes. A-02 touches only `packages/db/src/{schema,migrations,rollbacks}` and `packages/plugin-company/` — no server route code, no import/export code. Flagged for orchestrator follow-up.

**Design decisions (for orchestrator review):**
1. **Schema location** — ARCHITECTURE.md §3 says "Each table defined in `packages/plugin-<name>/src/schema.ts` and registered into Drizzle via a plugin hook Paperclip already exposes." However, `packages/db/drizzle.config.ts` only scans `./dist/schema/*.js`, and the "plugin hook" for schema registration is not yet wired. To avoid a Paperclip core edit, I placed the table definition in `packages/db/src/schema/company_profiles.ts` (consistent with existing precedents like `plugin_company_settings.ts`, `plugin_entities.ts`) and have `plugin-company/src/schema.ts` re-export it plus the Infer types. Flagging for future unification when a real plugin-schema registration hook lands.
2. **Rollback location** — Agent A's hard rule specifies "`packages/db/migrations/NNNN_xxx.up.sql` + `NNNN_xxx.down.sql`". The existing Paperclip convention is `packages/db/src/migrations/NNNN_name.sql` (no `.up` suffix, no siblings), enforced by `check-migration-numbering.ts` which flags any two files with the same 4-digit prefix as duplicates. I placed the rollback in a new sibling directory `packages/db/src/rollbacks/` (not inside `migrations/`) so the Paperclip numbering check stays clean. The rollback is documentation-only — not auto-applied by the drizzle migrator.
3. **Unique company_id** — enforced the 1:1 relation via `uniqueIndex("company_profiles_company_uq")` on `company_id` and asserted it in the test.
4. **Cascade delete** — `ON DELETE cascade` from `companies.id`; verified in the test.
5. **Trial state** — stored as `text` with default `'trial'`. Valid values documented as `trial | active | expired | paused` in the `TrialState` type alias. A-04's Getting Started state machine will drive transitions; A-02 only establishes the column.

**Notes for next task (A-03):** Agent role seeding — "Naive (CEO)" seeded on company creation + factory for hiring dept agents (Engineering / Marketing / Operations / Sales / Support). Blocked-by: A-02 (just merged locally). Will land the seed logic in `packages/plugin-company/src/agents/factory.ts`; tests will spin up embedded-postgres via the same harness as A-02, apply migrations, create a company, and assert CEO seed + hireAgent tagging.
