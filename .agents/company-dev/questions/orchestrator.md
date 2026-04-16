# Questions for the Orchestrator

Append new entries at the bottom. Each entry: date · who · topic · body.

---

## 2026-04-17 · agent-C · server test flakes observed during C-02 verification

During the mandatory `pnpm test:run` after C-02, two additional server tests
joined the Phase-0 known-flake category — timing out at 5s inside the full
parallel suite but passing cleanly in ~1.6s when run isolated:

- `server/src/__tests__/issue-feedback-routes.test.ts › issue feedback trace routes › flushes a newly shared feedback trace immediately after saving the vote`
- `server/src/__tests__/openclaw-invite-prompt-route.test.ts › POST /companies/:companyId/openclaw/invite-prompt › rejects non-CEO agent callers`

Isolated repro:

```
pnpm --filter "@paperclipai/server" exec vitest run \
  src/__tests__/issue-feedback-routes.test.ts \
  src/__tests__/openclaw-invite-prompt-route.test.ts
# → 9/9 pass in 3.09s total (~1.6s each)
```

C-02 touched only `ui/` and `.agents/`; no server code changed. Same class
as the Phase-0 `cli-auth-routes.test.ts` flake — suite-level concurrency
contention, not a regression from this task.

**Questions / asks:**

1. Policy: `SELF_CHECK_PROTOCOL.md` rule 4 says `pnpm test:run` must pass on
   the whole repo. Phase 0 accepted one known flake — is that precedent
   now extending to three, or should Agent C (or Agent A on the server side)
   invest in raising the per-test timeout or de-paralleling the server
   suite before more tasks land? The count will only grow otherwise.
2. If the orchestrator re-runs `pnpm test:run` on a clean checkout and hits
   these, please confirm isolated runs pass before blocking the C-02 merge.

No blocker on C-02 itself — gate-C-02 and full typecheck are both green.
Awaiting guidance before picking up C-01.
