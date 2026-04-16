# Company.dev — Architecture

## One-sentence shape

Company.dev is **Paperclip** (the open-source AI agent orchestrator) **+ a SaaS wrapper**: subscription billing, an Apps builder, a Store of company templates, an integrations hub, and stubbed-but-pluggable real-world identity (LLC / bank / email / browser) — all deployed as a single Docker image to Fly / Railway / Vercel.

## Layering

```
┌────────────────────────────────────────────────────────────────────┐
│  ui/  (React + Vite + Tailwind)                                    │
│  - marketing: Landing, Pricing, Enterprise                         │
│  - app:       Company shell, Chat, Overview, Tasks, Drive,         │
│               Store, Team/Agent detail, Apps detail, Settings      │
│               (ported from ui-import/*.html)                       │
└───────────▲────────────────────────────────────────────────────────┘
            │ HTTP / WebSocket (unchanged from Paperclip)
┌───────────┴────────────────────────────────────────────────────────┐
│  server/  (Node + tsx runtime, Paperclip's existing server)        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Paperclip core (unchanged, upstream-mergeable)             │  │
│  │  - orgs, agents, tickets, runs, comments, heartbeats        │  │
│  │  - budgets, governance, audit logs, multi-company isolation │  │
│  │  - plugin/skill system, adapter system                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Company.dev plugins (new, live under packages/plugin-*)    │  │
│  │  - plugin-company         CompanyProfile, Getting Started,  │  │
│  │                           review queue, check-in messages    │  │
│  │  - plugin-apps-builder    App model, builder worker,        │  │
│  │                           preview/code/deploy/env tabs      │  │
│  │  - plugin-store           Templates, Get install flow,      │  │
│  │                           publishing bridge                 │  │
│  │  - plugin-payments        Stripe Checkout, portal, webhooks,│  │
│  │                           credit ledger                     │  │
│  │  - plugin-integrations    OAuth-based connectors (Notion,   │  │
│  │                           Slack, Figma, GitHub, Linear,     │  │
│  │                           Vercel, …)                        │  │
│  │  - plugin-identity        IdentityProvider / BankProvider / │  │
│  │                           EmailProvider / BrowserProvider   │  │
│  │                           interfaces + MockXxxProvider impls│  │
│  │  - plugin-dashboards      Custom dashboard pages + widgets  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## Why plugins

Paperclip already has a plugin contract. Every Company.dev-specific feature lives in its own workspace package so:
- `git pull paperclip-upstream master` keeps working without rebase pain
- Paperclip base stays MIT-useful for anyone who wants just the orchestrator
- Each plugin has its own test suite and gate script

## Data layer

Postgres via Drizzle (Paperclip default). Company.dev adds tables:

| Table | Owner plugin | Purpose |
|---|---|---|
| `company_profiles` | plugin-company | Name / description / positioning / trial state |
| `getting_started` | plugin-company | 7-step checklist progress per company |
| `pending_reviews` | plugin-company | Review queue items |
| `apps` | plugin-apps-builder | Apps (name, channel_id, env vars, prod domain) |
| `app_deployments` | plugin-apps-builder | Deployment history |
| `store_templates` | plugin-store | Published agent / company templates |
| `subscriptions` | plugin-payments | Stripe subscription mirrors |
| `credit_ledger` | plugin-payments | All credit transactions (top-ups, usage, rollovers) |
| `integrations` | plugin-integrations | OAuth tokens per company per provider |
| `identities` | plugin-identity | Legal entities per company + agent |
| `virtual_cards` | plugin-identity | BankProvider-managed cards |
| `agent_inboxes` | plugin-identity | EmailProvider-managed inboxes |
| `browser_sessions` | plugin-identity | BrowserProvider live-view sessions |
| `dashboard_pages` | plugin-dashboards | Chat-built custom pages |

Each table defined in `packages/plugin-<name>/src/schema.ts` and registered into Drizzle via a plugin hook Paperclip already exposes.

## Real-world identity — Phase 1 stub strategy

Every "real-world" primitive (LLC formation, bank account, email, browser) has:

1. A **provider interface** — `IdentityProvider`, `BankProvider`, `EmailProvider`, `BrowserProvider`. See `docs/company-dev/PROVIDER_INTERFACES.md`.
2. A **Mock implementation** that logs intent and returns fake success. Good enough for demos and for the product flow to feel complete.
3. A **documented swap path** — which real provider to wire for each abstraction, what secrets it needs, estimated cost per action, legal/KYC requirements.

Phase 2 (after paying customers exist) swaps Mock for real on a per-provider cadence. No architectural change needed.

## Frontend

Existing `ui/` is Paperclip's React + Vite + Tailwind stack. Agent C ports the HTML prototypes into `ui/src/pages/` and `ui/src/components/`. Routing:

```
/                             Landing (marketing)
/pricing                      Pricing
/enterprise                   Enterprise
/login, /signup, /upgrade     Auth + subscription
/c/:companyId                 Company shell (Chat default)
/c/:companyId/overview        Overview tab
/c/:companyId/strategy        Strategy tab
/c/:companyId/payments        Payments tab
/c/:companyId/settings/*      Settings sub-tabs
/c/:companyId/tasks           Kanban
/c/:companyId/drive           Drive
/c/:companyId/store           Store
/c/:companyId/team/:agentId/* Employee detail (9 sub-tabs)
/c/:companyId/apps/:appId/*   App detail (Preview / Code / Deployments / Settings)
/store                        Global Store (unauthed-viewable)
```

## Deployment surface

Single Docker image (Paperclip's existing Dockerfile extended). Default Fly. Works on Railway and Vercel+Neon with env-var swaps. See `docs/company-dev/DEPLOYMENT.md`.

## Upstream mergeability

- All net-new code lives in `packages/plugin-*` or `.agents/company-dev/`.
- Minimum patches to Paperclip core — prefer plugin hooks.
- When a hook is missing, submit a PR upstream before landing a local patch.
- `paperclip-upstream` remote stays configured. Monthly: `git pull paperclip-upstream master` on a merge branch, resolve, PR.
