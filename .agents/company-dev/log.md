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
