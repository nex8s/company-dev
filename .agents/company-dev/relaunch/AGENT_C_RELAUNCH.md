# Agent C — Frontend port (relaunch)

You are Agent C on `~/company-dev-c` (worktree), branch `feat/frontend-port`.

## What's done
C-01 (landing page), C-02 (design tokens + Tailwind), C-03 (company shell — sidebar, popovers, Getting Started), C-04 (Company Chat view) — all merged to master. The Getting Started stub matches A-04's exact Checklist shape for 1-line swap when HTTP routes land.

## Your next task: C-05
**Company > Overview / Strategy / Payments / Settings tabs.** These are the 5 sub-tabs inside the company shell breadcrumb. Reference `ui-import/dashboard.html` for layout.

- **Overview**: KPIs (Team count, Tasks, Credits, Approvals), Revenue card (Stripe empty state), AI Usage card. Data sources: A-03 agents, A-05 reviews, A-07 credits (not merged — stub).
- **Strategy**: Positioning, Target Audience, Strategy text, Active Plans, Goals. Data: A-02 CompanyProfile (merged — fields exist).
- **Payments**: Stripe empty state with "Connect Stripe" CTA. Stub until B-07.
- **Settings**: General (logo, name, desc) / Billing / Team / Usage / Server / Publishing — inner tab strip. General reads CompanyProfile (A-02 merged). Others stub until respective B tasks merge.

All copy in `ui/src/copy/company-tabs.ts`. Stubs use the hook-seam pattern from C-03/C-04.

## After C-05
C-06 (Tasks kanban — A-05 merged, unblocked), C-08 (Store view — B-04/B-05 merged, unblocked), then C-09 once B-10–B-12 merge.

## Rules (short version)
- Copy in `ui/src/copy/*.ts`. No raw hex of brand tokens in components. No reference-brand names.
- Every data-bound component has skeleton + error states.
- Shared popover/collapsible via shadcn/radix (already set up in C-03).
- Gate must exit 0. `pnpm typecheck && pnpm test:run` must pass (5 known env-flakes OK).
- Conventional commits: `feat(C-05): ...`
- Push every completed task. Log to `.agents/company-dev/log.md`.
- Full docs: `docs/company-dev/PLAN.md`, `FEATURE_MAPPING.md`, `SELF_CHECK_PROTOCOL.md`.
- Reference prototype: `ui-import/dashboard.html`.

## First commands
```bash
cd ~/company-dev-c
git fetch origin master && git rebase origin/master
pnpm install
# then start C-05
```
