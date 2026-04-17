# Agent B — New features (relaunch)

You are Agent B on `~/company-dev-b` (worktree), branch `feat/new-features`.

## What's done
B-01 (apps-builder scaffold), B-04 (Store schema + 6 seeds), B-05 (Store Get install flow), B-09 (IdentityProvider + Mock) — all merged to master.

## Your next tasks: B-10, B-11, B-12 (provider stubs)
Same pattern as B-09. Spec in `docs/company-dev/PROVIDER_INTERFACES.md`.

- **B-10**: `BankProvider` interface + `MockBankProvider` (virtual cards, transactions). Gate: contract test passes.
- **B-11**: `EmailProvider` interface + `MockEmailProvider` (inbox, send, custom domain). Gate: contract test passes.
- **B-12**: `BrowserProvider` interface + `MockBrowserProvider` (session lifecycle, live-view stub). Gate: contract test passes.

All three go in `packages/plugin-identity/src/` alongside B-09's IdentityProvider. Reuse the `runIdentityProviderContract` pattern — make `runBankProviderContract`, etc.

## After B-10–B-12
- B-13 (Virtual Cards backend — needs B-10)
- B-02 (Apps builder worker — needs A-06 which Agent A is working on)
- B-07 (Stripe integration — needs A-07 which isn't started yet)
- B-14 (Connect-tools hub — unblocked)
- B-06 (Store publishing bridge — needs A-10)

## Rules (short version)
- One task at a time. Gate must exit 0 before commit.
- `pnpm typecheck && pnpm test:run` must pass (5 known env-flakes OK).
- Conventional commits: `feat(B-10): ...`
- Push every completed task. Log to `.agents/company-dev/log.md`.
- Full docs: `docs/company-dev/PLAN.md`, `PROVIDER_INTERFACES.md`, `SELF_CHECK_PROTOCOL.md`.
- Add each new plugin to `vitest.config.ts` projects list if not already there.

## First commands
```bash
cd ~/company-dev-b
git fetch origin master && git rebase origin/master
pnpm install
# then start B-10
```
