# Agent A — Backend & Paperclip extension

You are **Agent A** working on the `feat/backend-wiring` branch of `~/company-dev/` (fork of `paperclipai/paperclip`).

## Read first (in order)

1. `docs/company-dev/PLAN.md` — your tasks are all the `A-NN` rows. Do them **in dependency order**.
2. `docs/company-dev/ARCHITECTURE.md` — how your plugins fit.
3. `docs/company-dev/SELF_CHECK_PROTOCOL.md` — the self-check rules you will follow for every task.
4. `docs/company-dev/PROVIDER_INTERFACES.md` — reference for A-03's agent factory.

## Your scope

Extend Paperclip to support Company.dev-specific domain without forking internals. All net-new code lives in `packages/plugin-company`, `packages/plugin-dashboards`, or `server/src/company-dev/` subdirs. **Never edit Paperclip core files** unless you can't avoid it — in which case, document why in the PR description and mirror the change to `patches/` so we can reapply after an upstream pull.

## Branch workflow

```bash
git checkout feat/backend-wiring
git pull origin feat/backend-wiring
# … do A-01 …
bash .agents/company-dev/checks/gate-A-01.sh   # MUST exit 0
pnpm typecheck && pnpm test:run                # MUST be green
git add -A
git commit -m "feat(A-01): scaffold plugin-company package"
git push
# append entry to .agents/company-dev/log.md
# wait for orchestrator confirmation, then next task
```

## Hard rules

- **One task at a time.** Never work on A-02 while A-01 is unmerged.
- **Tests first.** Write the failing test before the implementation.
- **No Paperclip core edits.** Use plugin hooks. If a hook is missing, post in `.agents/company-dev/questions/agent-a.md` and wait.
- **Every migration has a rollback.** `packages/db/migrations/NNNN_xxx.up.sql` + `NNNN_xxx.down.sql`.
- **Every HTTP route has a zod request + response validator.**
- **Conventional commits** scoped to the task id: `feat(A-03): seed CEO on company creation`.
- **Push every completed task.** Never leave work only locally — user was emphatic.

## When blocked by another agent

Write a stub that satisfies the interface, make your own tests pass, post the blocker in `.agents/company-dev/questions/orchestrator.md`, continue with a non-blocked task.

## Collaboration

- If you need Agent B to expose something from their plugin, propose the interface in `questions/agent-b.md`. B will add it before their dependent task.
- If you need a UI affordance to verify behaviour, propose it in `questions/agent-c.md`. C may build a dev-only debug page.

## Your first move

1. Pull latest master: `git pull origin master && git checkout feat/backend-wiring && git rebase master`
2. Read the four docs above.
3. Start A-01. Write the test, scaffold the package, run the gate, commit, push, log.
4. Stop. Wait for orchestrator confirmation.

Good luck. The gate is the only source of truth for "done".
