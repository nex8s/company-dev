# Company.dev — Feature Mapping

Every view from the prototype (`ui-import/landing.html`, `ui-import/dashboard.html`) mapped to its data source. "Paperclip primitive" = reuse existing. "New" = implemented by Agent A or B in a plugin. "Port only" = pure UI port with no new backend.

| Prototype view | Route | Paperclip primitive (reuse) | New plugin / table | Owning task |
|---|---|---|---|---|
| Landing hero + composer | `/` | — | Port only (copy lives in `ui/src/copy/landing.ts`) | C-01 |
| Pricing | `/pricing` | — | plugin-payments (plan definitions) | C-11, B-07 |
| Company shell (sidebar + breadcrumb + review pill + user menu + Getting Started + company switcher) | `/c/:companyId` | orgs, agents | plugin-company (CompanyProfile, getting_started, pending_reviews) | C-03, A-01, A-02, A-04, A-05 |
| Company > Chat | `…/` (default) | tickets/comments/runs (the existing Chat page in reskin work) | plugin-company (check-in message emitter) | C-04, A-06 |
| Company > Overview (KPIs, Revenue card, AI Usage card, Team, Apps) | `…/overview` | budgets, agents | plugin-payments (credit aggregates), plugin-apps-builder (apps list) | C-05, A-07, B-08 |
| Company > Strategy (positioning / audience / strategy text, active plans, goals) | `…/strategy` | — | plugin-company (CompanyProfile fields + Plan model — reuses Paperclip's plan/goal primitive if it exists; else add) | C-05, A-02 |
| Company > Payments (Stripe empty state) | `…/payments` | — | plugin-payments | C-05, B-07 |
| Company > Settings > General | `…/settings/general` | — | plugin-company | C-05, A-02 |
| Company > Settings > Billing (Current Plan, Manage Billing, Credit Balance) | `…/settings/billing` | — | plugin-payments | C-05, B-07, B-08 |
| Company > Settings > Team (invite by email, pending join, members) | `…/settings/team` | orgs (members), invitations | Port + thin wrapper | C-05 |
| Company > Settings > Usage (KPIs, Credit Balance progress, breakdown, transaction history) | `…/settings/usage` | budgets | plugin-payments (ledger aggregates) | C-05, A-07, B-08 |
| Company > Settings > Server (Fly machine state, instance details, machine events) | `…/settings/server` | — | plugin-company (server panel endpoint A-09, Fly API pass-through) | C-05, A-09 |
| Company > Settings > Publishing (Publish Single Agent / Publish Entire Company) | `…/settings/publishing` | — | plugin-store (publishing bridge) | C-05, A-10, B-06 |
| Tasks (kanban Needs Review / In Progress / Queued / Completed) | `…/tasks` | tickets | plugin-company (review actions) | C-06, A-05 |
| Drive (files, tabs by dept, Pending) | `…/drive` | attachments | plugin-apps-builder (agent-authored files) | C-07, B-02 |
| Store (Naïve Templates — Featured grid, business categories, employee departments) | `…/store` | — | plugin-store | C-08, B-04, B-05 |
| Upgrade page (Free / Starter / Pro + Pay-as-you-go) | `/upgrade` | — | plugin-payments | C-11, B-07 |
| Top-up credits modal (20 / 50 / 100 / 250) | `/upgrade` overlay | — | plugin-payments | C-11, B-07 |
| Team > Naive [CEO] > Profile (Identity, Compute, Recursive Intelligence) | `…/team/:agentId` | agents | Port + plugin-identity (email/phone/legal entity) | C-09, A-03, B-09, B-11 |
| Team > Naive [CEO] > Chat | `…/team/:agentId/chat` | tickets/comments per-agent | Port | C-09 |
| Team > Naive [CEO] > Inbox | `…/team/:agentId/inbox` | — | plugin-identity (EmailProvider) | C-09, B-11 |
| Team > Naive [CEO] > Compute (current period credits, resource table, Vercel/Supabase Included pills) | `…/team/:agentId/compute` | budgets per agent | plugin-payments | C-09, A-07 |
| Team > Naive [CEO] > Settings (display name, dept, icon, status & budget, runtime config) | `…/team/:agentId/settings` | agents | Port | C-09 |
| Team > Landing Page Engineer > Profile (with Recursive Intelligence flow diagram: Reason / Act / Observe / Learn) | `…/team/:agentId` (dept variant) | agents, run lifecycle | Port + visualization component | C-09 |
| Team > … > Browser (live view stub) | `…/team/:agentId/browser` | — | plugin-identity (BrowserProvider) | C-09, B-12 |
| Team > … > Phone (Claim Number flow) | `…/team/:agentId/phone` | — | plugin-identity (extend EmailProvider or add PhoneProvider) | C-09, B-11 |
| Team > … > Workspace (Files / Skills toggle, file tree) | `…/team/:agentId/workspace` | skills, attachments | Port | C-09 |
| Team > … > Virtual Cards | `…/team/:agentId/virtual-cards` | — | plugin-identity (BankProvider) | C-09, B-10, B-13 |
| Apps > Landing Page > Preview | `…/apps/:appId` | — | plugin-apps-builder (iframe preview server) | C-10, B-02 |
| Apps > Landing Page > Code (file tree) | `…/apps/:appId/code` | — | plugin-apps-builder (file tree serializer) | C-10, B-03 |
| Apps > Landing Page > Deployments | `…/apps/:appId/deployments` | — | plugin-apps-builder (deployment history) | C-10, B-03 |
| Apps > Landing Page > Settings (Connections, Env Vars, Production Domain, Danger Zone) | `…/apps/:appId/settings` | — | plugin-apps-builder + plugin-integrations | C-10, B-03, B-14, B-15 |
| "Connect your tools" strip under each composer | shared component | — | plugin-integrations | C-04, B-14 |
| Sidebar "1 review waiting" popover (Tasks tab, Agents tab) | shared | — | plugin-company (listPendingReviews) | C-03, A-05 |
| Sidebar company switcher popover | shared | orgs | Port | C-03 |
| Sidebar user menu popover (Upgrade Plan, Top Up Credits, Use Emoji Icons, Settings, Support, Sign out) | shared | auth | Port + plugin-payments | C-03, B-07 |
| Sidebar Getting Started panel (7 steps, progress bar) | shared | — | plugin-company (A-04) | C-03, A-04 |

## Not in prototype — still required

| Feature | Owner | Why |
|---|---|---|
| Sign up / Sign in | Paperclip auth | Baseline |
| Password reset, email verification | Paperclip auth | Baseline |
| Docs (Mintlify) | Paperclip has it | Reuse |
| Admin panel (Company.dev operator view) | Later | Phase 2 |
| Enterprise SSO | Later | Pro-plus plan feature |
