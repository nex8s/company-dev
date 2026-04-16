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

