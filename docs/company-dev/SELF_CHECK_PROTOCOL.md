# Company.dev — Self-Check Protocol

**This is non-negotiable.** We're wiring a backend onto a live frontend and silent failures cascade. Every task in `PLAN.md` has a gate; the gate is the only source of truth for "done".

## Rules

A task is `done` only when **all** of the following hold:

1. The matching `.agents/company-dev/checks/gate-<id>.sh` script exits 0.
2. The agent has written `*.test.ts` (colocated with the code) covering the task's behaviour.
3. `pnpm typecheck` passes on the whole repo (no errors, no skipped).
4. `pnpm test:run` passes on the whole repo.
5. The agent has pushed the commit to its branch AND posted in `.agents/company-dev/log.md`:
   - task id
   - files changed
   - test names that cover the task
   - last 10 lines of the gate output
6. The Orchestrator has pulled the branch on a clean checkout AND re-run the gate AND `pnpm test:run` AND confirmed both exit 0.

**A task is NOT done because the agent says so.** It is done because the gate passed on a clean checkout AND the Orchestrator has verified.

## Agent cadence

For each task, in order:

```
1. Read the task description in PLAN.md and PROVIDER_INTERFACES.md / ARCHITECTURE.md as relevant.
2. Write the test first (or at least alongside) — what's the minimum behaviour that proves this works?
3. Write the implementation.
4. Run the gate locally: bash .agents/company-dev/checks/gate-<id>.sh
5. If it fails, fix. Do NOT move on.
6. If it passes: pnpm typecheck && pnpm test:run.
7. If either fails: fix. Do NOT move on.
8. Commit with Conventional Commits format: feat(X-NN): <summary>
9. Push to the agent's branch.
10. Append an entry to .agents/company-dev/log.md with the fields above.
11. Wait for Orchestrator confirmation before starting the next task.
```

## Orchestrator cadence

For each completed task posted in `log.md`:

```
1. git fetch && git checkout <agent-branch> && git pull
2. pnpm install (only if lockfile changed)
3. bash .agents/company-dev/checks/gate-<id>.sh
4. pnpm typecheck && pnpm test:run
5. If all green: open PR from agent branch to master, merge squash with the same commit message.
6. If any red: post in .agents/company-dev/questions/<agent>.md with the failure, block the agent until fixed.
7. After merge: agents rebase their branches on master.
```

## When a gate is wrong or too narrow

If during implementation the agent finds the gate script doesn't actually test what the task requires (or tests it poorly):

- The agent MUST update the gate script in the same commit.
- The update MUST tighten the gate, never weaken it.
- The Orchestrator reviews the gate change as part of the PR.

Weakening a gate ("I couldn't get this to pass so I made it looser") is grounds for reverting the whole task.

## Cross-agent blockers

If Agent X depends on something Agent Y is building and can't proceed:

- Agent X writes a stub for the dependency that satisfies the interface and lets X's own tests pass.
- Agent X posts in `.agents/company-dev/questions/orchestrator.md` describing the blocker.
- The Orchestrator coordinates or the user resolves.
- When Agent Y's task merges, Agent X rebases and removes the stub.

## Silent failure traps to check for

Paperclip has a long-running agent process; UI talks to it over WebSocket. These classes of bugs have bitten us:

- Agent posts a message but the UI hook subscribed to the stream silently drops it → always `console.assert` the message arrives in the component's effect.
- A migration runs on dev DB but not staging DB → every migration has a `migrate:down` AND a smoke test that boots on a freshly-seeded DB.
- Stripe webhook arrives before the local DB has the subscription row → webhook handler must be idempotent and retry-tolerant; test with an out-of-order delivery.
- Provider interface "works in Mock" but the real impl returns a different response shape → contract tests run against both every CI.

## Log format

`.agents/company-dev/log.md`:

```markdown
## A-03 · 2026-04-17 14:02 · agent-A
**Files:** packages/plugin-company/src/agents/factory.ts, packages/plugin-company/src/agents/factory.test.ts, packages/db/migrations/0042_seed_ceo.sql
**Tests:** factory.test.ts › creates a CEO on company creation (pass), factory.test.ts › hireAgent tags dept correctly (pass)
**Gate output (tail):**
  PASS  packages/plugin-company/src/agents/factory.test.ts
    ✓ creates a CEO on company creation
    ✓ hireAgent tags dept correctly
  gate-A-03.sh: all checks passed
```

## Non-negotiables

- Never `--skip-typecheck` in production code.
- Never `--no-verify` on commits. If a pre-commit hook fails, fix the underlying cause.
- Never mark a task done while another agent is blocked on you and you haven't responded in `questions/`.
- Never work on two tasks at once. Finish → gate → log → rebase → next.
