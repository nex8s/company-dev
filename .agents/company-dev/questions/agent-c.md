# Agent C — status handoff (2026-04-17 ~05:20)

**Current task + status.** C-04 (Company > Chat view) **implementation complete** on `feat/frontend-port` at commit `9df35afa` (pushed). `gate-C-04` green (build 16.94s, 20/20 tests across CompanyChat.test.tsx + the updated CompanyShell.test.tsx). UI-only typecheck clean. **Full-repo typecheck BLOCKED** by a cross-agent collision in `packages/db`: A-04 (`0058_loving_richard_fisk.sql`) and B-05 (`0058_wise_pixie.sql`) both landed on master with migration number 0058 — `packages/db/src/check-migration-numbering.ts` trips. Not caused by C-04 and not mine to resolve. Full `pnpm test:run` therefore not run this session because the db package fails before vitest spins up.

**Merged before this session:** C-02 (4712000a), C-01 (1d9ff22e), C-03 (8f4537a9), plus shape-match patch `fix(C-03)` (775a6df5). Pushed but not yet orchestrator-verified: `feat(C-04)` (9df35afa).

**Files changed (C-04).**
- New: `ui/src/pages/CompanyChat.tsx` (chat page with nested sub-components: MessageList, MessageBubble variants, Composer, MentionPopover), `ui/src/pages/CompanyChat.test.tsx` (jsdom, 9 tests), `ui/src/hooks/useCompanyChat.ts` (state + stub reply + pure mention helpers — `detectMentionAt`, `filterMentionable`, `applyMention`), `ui/src/copy/chat.ts`, `.agents/company-dev/checks/gate-C-04.sh`.
- Modified: `ui/src/pages/CompanyShell.tsx` (nested `<Routes>` wraps main area: `index` → CompanyChat, `*` → MainContentPlaceholder), `ui/src/pages/CompanyShell.test.tsx` (mock now uses `vi.importActual('react-router-dom')`, renders wrap in MemoryRouter; new test asserts CompanyChat mounts at index).
- Stub-match patch from earlier this session: `ui/src/hooks/useCompanyShellData.ts`, `ui/src/copy/company-shell.ts`, `ui/src/pages/CompanyShell.tsx` — Getting Started stub now mirrors A-04's `Checklist` + `ChecklistStep` shape exactly; 1-line swap to useQuery when Agent A ships HTTP routes.

**What's next.** Fastest unblocked paths in order of leverage:
1. **C-05 (Overview / Strategy / Payments / Settings tabs)** — all unblocked at the stub level; C-03's breadcrumb already routes to these; B-08 not merged but shapes are in PLAN.md.
2. **C-06 (Tasks kanban)** — reuses the A-05 pending-reviews seam I already mocked in `useCompanyShellData.ts`.
3. **C-13 E2E harness** (`tests/e2e-company-dev/` + Playwright + first smoke against `/` + `/c/:companyId`) — unblocks the deferred visual-diff pieces in gate-C-01 / C-03 / C-04.
4. **C-14 brand swap** — fully unblocked mechanically but awaits user-supplied tagline + logo mark; audit pass on TODO(C-14) tags + gate script is shippable now.

**Blockers.**
- **Migration number collision (team-wide):** `packages/db/src/migrations/0058_loving_richard_fisk.sql` (A-04) and `0058_wise_pixie.sql` (B-05) share the same number. Blocks `pnpm typecheck` on the full repo for everyone. Needs Agent A or B to renumber one of them to 0059 (plus matching snapshot + rollback) and push. Orchestrator: please coordinate.
- **No HTTP routes for plugin-company exports** (already flagged to Agent A in the side-note at end of your prior message). `getChecklist`, `listPendingReviews`, CompanyProfile CRUD are all db-scoped functions today; until Agent A adds REST routes, the shell + Getting Started + pending-reviews + company profile continue to read typed-mock stubs. The seams are clean — each is a 1-line useQuery replacement.
- **Playwright harness (C-13) still absent.** gates for C-01 / C-03 / C-04 all carry inline `TODO(C-13)` markers where the visual-diff / streaming assertions are deferred. Non-blocking today; landing C-13 is the cleanest way to clear all three.

**Known env-flake list (per orchestrator policy, approved to ignore if gate green):** cli-auth-routes, issue-feedback-routes, openclaw-invite-prompt-route, agent-permissions-routes, issue-activity-events-routes. All five pass isolated in 1–2s; fail under full-suite parallel pressure. Declining root-cause work per orchestrator direction.
