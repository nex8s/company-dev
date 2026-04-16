# Company.dev — PLAN (source of truth)

Task breakdown for the three parallel agent workstreams. Every task has:
- **ID** (`A-01`, `B-03`, `C-12`)
- **Gate** — the `.agents/company-dev/checks/gate-<id>.sh` script that must exit 0 before the task is marked done
- **Blocked by** — upstream tasks that must merge first
- **Owner** — the agent who executes

Agents work on their own branch. The Orchestrator merges to `master` task-by-task once the gate passes.

---

## Agent A — Backend & Paperclip extension (branch: `feat/backend-wiring`)

Extends Paperclip without forking its internals. New capabilities land as workspace packages (`packages/plugin-*`) or dedicated subdirs under `server/src/` so upstream remains mergeable.

| ID | Task | Gate | Blocked by |
|---|---|---|---|
| A-01 | Add `packages/plugin-company` scaffold (pnpm workspace entry, tsconfig, vitest, exports a registerPlugin function consumed by server boot). | gate-A-01.sh: package builds, typechecks, empty test suite runs | — |
| A-02 | Define `CompanyProfile` schema (name, description, positioning, target audience, strategy text, incorporated bool, logo, trial state). Drizzle migration in `packages/db`. | gate-A-02.sh: migration applies cleanly on a fresh DB; round-trip insert+select test passes | A-01 |
| A-03 | Agent role seeding — "Naive (CEO)" seeded on company creation; factory for hiring dept agents (Engineering / Marketing / Operations / Sales / Support) with default system prompts. | gate-A-03.sh: creating a company yields 1 CEO + 0 direct-reports; hireAgent(dept='Marketing') yields a new agent with correct dept tag | A-02 |
| A-04 | "Getting Started" checklist state machine — 7 steps, each completable programmatically (Incorporate, Domain, Email inboxes, Stripe billing, Deploy first app, Google Search Console, Custom dashboard pages). Progress persisted per company. | gate-A-04.sh: complete step 5 → progress=1/7; subsequent steps complete independently; state survives restart | A-02 |
| A-05 | "1 review waiting" queue — `PendingReview` table, query `listPendingReviews(companyId)`, transitions approve/reject. | gate-A-05.sh: submit a task as pending; it appears in queue; approve removes it; reject flips task status | A-03 |
| A-06 | Heartbeat/check-in system messages — extend Paperclip's run-status stream to emit "via check-in" system posts into the company chat thread on run lifecycle events (error recovery, restart, retry). | gate-A-06.sh: force an adapter error; verify a "via check-in" comment is posted to the company chat issue | A-03 |
| A-07 | Credit ledger — reuse Paperclip's budget primitives; add top-level company balance, Stripe-synced top-ups, per-agent monthly budget caps with graceful pause. | gate-A-07.sh: top-up adds credits; exceeding per-agent cap flips agent status to `paused`; resume recharges on new month | A-03 |
| A-08 | Custom dashboards — schema for `DashboardPage` (company_id, title, JSON widget layout). HTTP routes to CRUD. Widget types: revenue (Stripe), ai-usage, team-status, task-kanban. | gate-A-08.sh: create → list → render-data endpoint returns widget payload | A-07 |
| A-09 | Company "Server" panel — expose Fly machine metadata (CPU/RAM/Storage/Region/State/Machine events) if deployed on Fly; return a local-dev stub otherwise. | gate-A-09.sh: endpoint returns well-formed JSON in both modes | A-01 |
| A-10 | Publishing → Store bridge — endpoint to publish an agent or full company as a Store template (Naive Templates). | gate-A-10.sh: publish single agent → appears in Store listing; bundle entire company → multi-agent template appears | A-03, B-06 |

---

## Agent B — New features: Apps builder, Store, Payments, Identity stubs (branch: `feat/new-features`)

New products that don't live in Paperclip base.

| ID | Task | Gate | Blocked by |
|---|---|---|---|
| B-01 | Apps builder scaffold — `packages/plugin-apps-builder`. Model: `App` (company_id, name, channel_id, connections JSON, env vars, production_domain). | gate-B-01.sh: plugin builds; can create an App row and attach a channel | A-01 |
| B-02 | Apps builder worker loop — given a prompt + App row, spawn the "Landing Page Engineer" agent with a scoped skillset (scaffold Next.js, write files, deploy to Vercel via stub). | gate-B-02.sh: create App with prompt → agent produces files under `apps/<app_id>/` → commits file tree to DB → emits "Deployed app" check-in | B-01, A-03, A-06 |
| B-03 | Preview / Code / Deployments / Settings tabs backend — file tree serializer, deployment history, env var CRUD. | gate-B-03.sh: each tab has an endpoint returning expected shape | B-02 |
| B-04 | Store schema — `StoreTemplate` (kind: business|employee, category, skills[], employees[], creator, download_count). Seed with 6 starter businesses (Faceless YouTube, SMMA, YouTube Long-Form, B2B Outbound, Dev Agency, DevOps Monitoring) from `~/Downloads/*-paperclip-config.json`. | gate-B-04.sh: seed loads 6 templates; `listTemplates(category=?)` returns expected filters | A-01 |
| B-05 | Store "Get" flow — installing a business template creates a new company with all its agents + skills in one transaction. | gate-B-05.sh: install "SMMA" → new company with 4 agents, skills attached, starts idle | B-04, A-03 |
| B-06 | Store publishing — receives Agent A's A-10 payload and writes to `StoreTemplate`. | gate-B-06.sh: Agent A's gate-A-10 round-trip passes against this endpoint | B-04 |
| B-07 | Stripe integration — checkout session creator, customer portal link, webhook handler (subscription.created, .updated, .deleted, invoice.paid). Plans: Free Trial / Starter $49 / Pro $149, plus pay-as-you-go top-ups (20 / 50 / 100 / 250 credits). | gate-B-07.sh: webhook signature check passes; subscription state reflected in DB; top-up credits added to ledger | A-07 |
| B-08 | Billing / Usage / Server settings tabs backend — match the Company Settings UI (current plan card, manage billing portal link, credit balance, usage breakdown, transaction history, server instance details). | gate-B-08.sh: endpoints return shape expected by the dashboard prototype | B-07, A-07, A-09 |
| B-09 | `IdentityProvider` interface + `MockIdentityProvider` (logs intent + returns fake success). Real provider implementations (Stripe Atlas / Firstbase) deferred to Phase 2. | gate-B-09.sh: provider interface contract test passes; mock returns well-formed response | A-01 |
| B-10 | `BankProvider` interface + `MockBankProvider` (virtual cards, transactions). Real (Mercury / Column / Stripe Issuing) Phase 2. | gate-B-10.sh: provider interface contract test passes | A-01 |
| B-11 | `EmailProvider` interface + `MockEmailProvider` (inbox storage, send). Real (Resend + custom domain per agent) Phase 2. | gate-B-11.sh: provider contract test passes; emails land in mock inbox queryable by agent | A-01 |
| B-12 | `BrowserProvider` interface + `MockBrowserProvider` (session lifecycle, live-view URL stub). Real (Browserbase / Steel) Phase 2. | gate-B-12.sh: provider contract test passes | A-01 |
| B-13 | Virtual Cards UI backend — list/assign/create cards per agent via BankProvider. | gate-B-13.sh: create card for agent → list returns it with masked PAN | B-10 |
| B-14 | Connect-tools integrations hub scaffold — pluggable adapter pattern. Initial adapters: Notion, Slack, Figma, GitHub, Linear, Vercel (read-only OAuth scopes). OSS integration project (user-provided) will be merged LATER. | gate-B-14.sh: connection record stored with token; `listConnections(companyId)` returns it | A-01 |
| B-15 | Domains management — list domains, connect/buy domain, mark default, register email active per domain. | gate-B-15.sh: create domain → appears in list with `default:true` if first; connect custom domain flow records DNS CNAME target | B-11 |

---

## Agent C — Frontend port, integration wiring, E2E (branch: `feat/frontend-port`)

Ports `ui-import/landing.html` and `ui-import/dashboard.html` into the existing `ui/` React package. Wires API calls. Writes E2E.

| ID | Task | Gate | Blocked by |
|---|---|---|---|
| C-01 | Port landing page to `ui/src/pages/Landing.tsx` (or `marketing/` route). Swap hard-coded copy + brand marks placeholder text → Company.dev's voice (strings in `ui/src/copy/landing.ts`). Keep visual system (cream, pixel display font, black pill CTA). | gate-C-01.sh: route renders without error; Playwright visual diff threshold met vs a reviewed golden screenshot | — |
| C-02 | Design tokens + Tailwind theme — extract the prototype's palette/fonts/shadows into `ui/tailwind.config.ts` extend block + a token export. | gate-C-02.sh: `pnpm --filter @paperclipai/ui build` succeeds; token file exists and is imported by Landing | — |
| C-03 | Company shell — left sidebar + top breadcrumb + review-waiting pill + company switcher + user menu + Getting Started panel. Route `/c/:companyId`. | gate-C-03.sh: sidebar renders with all sections; all popovers open/close; switches company on select | A-01, A-04 |
| C-04 | Company > Chat view wired to the backing issue thread (reuse the Chat page from the existing reskin work in `~/company` where compatible). | gate-C-04.sh: Playwright: user sends a message → bubble appears; @mention autocomplete works; agent reply streams in | C-03, A-06 |
| C-05 | Company > Overview / Strategy / Payments / Settings tabs. | gate-C-05.sh: tabs click-switch; each reads live data from Agent A + B endpoints | C-03, A-02, B-08 |
| C-06 | Tasks kanban board (Needs Review / In Progress / Queued / Completed). Drag-drop optional. Approve/Reject actions wired to A-05. | gate-C-06.sh: create a pending-review task → appears in Needs Review column → Approve clears it | C-03, A-05 |
| C-07 | Drive view (files created by agents, grouped by department, pending review tab). | gate-C-07.sh: uploading a file shows it; agent-produced files appear in the right dept tab | C-03, B-02 |
| C-08 | Store view — grid of Featured / Business Categories / Employee Departments. "Get" installs a template. | gate-C-08.sh: click Get on a seeded template → new company created → redirects to its Chat view | C-03, B-04, B-05 |
| C-09 | Team > Employee detail — single generic component parameterized by agent id. Tabs: Profile / Chat / Browser / Phone / Workspace / Virtual Cards / Inbox / Compute / Settings. CEO variant hides Browser/Phone/Virtual Cards tabs. | gate-C-09.sh: each tab renders for CEO and a department agent without error; content comes from live API | C-03, A-03, B-10, B-11, B-12, B-13 |
| C-10 | Apps > Landing Page detail — Preview / Code / Deployments / Settings. Iframe preview, file tree, deployment history, env var editor. | gate-C-10.sh: all four tabs render for a seeded App; editing an env var persists | C-03, B-02, B-03 |
| C-11 | Upgrade page + Top-up modal wired to Stripe Checkout (B-07). | gate-C-11.sh: click Subscribe → redirect to Stripe test checkout URL; webhook lands → plan state flips in UI | C-03, B-07 |
| C-12 | Settings → Manage Domains / Virtual Cards / Custom Dashboards / Connections sub-pages. | gate-C-12.sh: each sub-page renders + CRUDs its resource | C-03, B-13, B-14, B-15, A-08 |
| C-13 | Full E2E happy path — Playwright: sign up → create company → hire CEO → CEO hires Marketer → Marketer produces a draft → review approve → launch first App via builder → subscribe Starter via Stripe test → verify Server panel shows instance details. | gate-C-13.sh: Playwright run exits 0 against a clean local stack | all prior |
| C-14 | Remove/replace all reference-brand copy and logo marks before public launch. Search the codebase for the reference product name; replace with Company.dev branding. | gate-C-14.sh: `grep -riE 'reference-brand-pattern' ui/ server/ docs/company-dev/` returns zero hits outside of NOTICE.md and historical migration notes | C-01 |

---

## Cross-cutting

- Every task that touches schema must add a migration AND a rollback script.
- Every new HTTP route must have a zod schema validator on both request and response.
- Every UI component that reads data must show a skeleton state + an error state.
- Every provider interface must have a contract test (`*.contract.test.ts`) that both the mock and any future real implementation pass.

## Verification gates

See `docs/company-dev/SELF_CHECK_PROTOCOL.md` for the exact rules. Summary: a task is **not** done until its gate script exits 0 on a clean checkout AND the Orchestrator has verified.

## Merge order (Orchestrator enforces)

1. A-01 → B-01 and C-02 unblock in parallel
2. A-02, A-03 → unblock most of A and all of C-03+
3. A-05, A-07 → unblock B-07, C-06, C-11
4. B-04 → B-05 → C-08
5. B-07 → C-11
6. All done → C-13 E2E → Phase 2 deploy
