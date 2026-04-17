# Agent A — Backend (relaunch)

You are Agent A on `~/company-dev-a` (worktree), branch `feat/backend-wiring`.

## What's done
A-01 through A-05 merged to master. You built: plugin-company scaffold, CompanyProfile schema, agent role seeding (CEO + factory), Getting Started checklist, pending review queue. All gates passed, all tests green.

## Your next task: A-06
**Heartbeat check-in system messages.** Extend Paperclip's run-status stream to emit "via check-in" posts into the company chat thread on run lifecycle events (error recovery, restart, retry). Gate: force an adapter error → verify a "via check-in" comment is posted to the company chat issue.

Start here: `server/src/services/heartbeat.ts` (or wherever Paperclip emits run lifecycle events). Your plugin-company package is at `packages/plugin-company/`.

## Side task after A-06
Add zod-validated HTTP routes for the plugin-company API surface: getChecklist, completeStep, listPendingReviews, approveReview, rejectReview, CompanyProfile CRUD. Agent C needs these to swap UI stubs for live queries. Commit as `feat(A-06.5): plugin-company HTTP routes`.

## After A-06 + routes
A-07 (credit ledger), A-08 (custom dashboards), A-09 (server panel), A-10 (publishing bridge — needs B-06).

## Rules (short version)
- One task at a time. Gate must exit 0 before commit.
- `pnpm typecheck && pnpm test:run` must pass (5 known env-flakes are OK: cli-auth-routes, issue-feedback-routes, openclaw-invite-prompt-route, agent-permissions-routes, issue-activity-events-routes).
- Conventional commits: `feat(A-06): ...`
- Push every completed task. Log to `.agents/company-dev/log.md`.
- No Paperclip core edits — use plugin hooks. If missing, post in `questions/orchestrator.md`.
- Full docs: `docs/company-dev/PLAN.md`, `ARCHITECTURE.md`, `SELF_CHECK_PROTOCOL.md`.

## First commands
```bash
cd ~/company-dev-a
git fetch origin master && git rebase origin/master
pnpm install
# then start A-06
```
