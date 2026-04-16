# Agent B — New features: Apps builder, Store, Payments, Identity stubs

You are **Agent B** working on the `feat/new-features` branch of `~/company-dev/`.

## Read first (in order)

1. `docs/company-dev/PLAN.md` — your tasks are all the `B-NN` rows.
2. `docs/company-dev/ARCHITECTURE.md`.
3. `docs/company-dev/PROVIDER_INTERFACES.md` — this is your spec for B-09 through B-13.
4. `docs/company-dev/SELF_CHECK_PROTOCOL.md`.
5. `docs/company-dev/DEPLOYMENT.md` — so you understand which providers are Mock by default.

## Your scope

You build the net-new products that don't exist in Paperclip base:

- Apps builder (Lovable/Bolt-style — describe an app, agent builds and deploys it)
- Store of company + agent templates
- Stripe-based payments (subscriptions, top-ups, credits)
- Identity/Bank/Email/Browser provider interfaces + Mock implementations
- Integrations hub scaffold (real OAuth adapters ship in trickle after Phase 1)

All new code lives in `packages/plugin-apps-builder`, `packages/plugin-store`, `packages/plugin-payments`, `packages/plugin-identity`, `packages/plugin-integrations`.

## Branch workflow

Same as Agent A — see that prompt. Branch is `feat/new-features`.

## Hard rules

- **No real-world provider calls in Phase 1.** Everything goes through a `Mock*Provider`. Real provider implementations are Phase 2 and explicitly out of scope.
- **Stripe goes straight to test mode.** `sk_test_...` / `pk_test_...`. Never ship a secret in git. Use `.env.example` only.
- **Every provider interface has a contract test** that both the mock AND any future real impl must pass. See PROVIDER_INTERFACES.md.
- **Seed data is code, not SQL.** Store templates come from `packages/plugin-store/src/seeds/*.ts` (you can adapt content from `~/Downloads/*-paperclip-config.json` which the user provided).
- **Stripe webhook signature verification is mandatory.** No skipping in dev with `NODE_ENV` checks.
- **Idempotency.** Every Stripe webhook handler and every top-up path must be idempotent on retry.

## Apps builder specifics (B-02)

The "Landing Page Engineer" agent has a scoped skillset:

- `scaffold.next` — create a Next.js app with Tailwind
- `write.file` — write a file into the app workspace
- `run.build` — run `pnpm build` inside the app
- `deploy.vercel` — ship to Vercel (Mock in Phase 1 — logs intent, returns fake URL)

The agent is spawned when an App is created. It reads the prompt, produces files under `apps/<app_id>/` in the workspace DB, commits a file tree, and emits check-in messages through Agent A's A-06 emitter.

## Store specifics (B-04, B-05)

The 6 seed businesses:

| Slug | Title | Category |
|---|---|---|
| `faceless-youtube` | Faceless YouTube Empire | Media & Content |
| `smma` | SMMA (Social Media Marketing) | Agency & Services |
| `youtube-long-form` | YouTube Long-Form Producer | Marketing & Growth |
| `b2b-outbound-machine` | B2B Outbound Machine | Sales & Revenue |
| `dev-agency` | Dev Agency | Agency & Services |
| `devops-monitoring-ops` | DevOps Monitoring Ops | Engineering & Product |

The last three map directly to the user's existing config files in `~/Downloads/*-paperclip-config.json`. Adapt the agent definitions; write fresh copy for the first three. Keep all marketing copy in your own voice — do not copy from the reference site.

## Payments specifics (B-07)

Plans (defined in `packages/plugin-payments/src/plans.ts`):

- **Free Trial** — 1 company, 2 agents, 20 credits, 5-day trial
- **Starter** — $49/mo, 5 companies, unlimited agents, BYOK LLMs, 50 monthly credits
- **Pro** — $199/mo, seats + shared billing, 200 monthly credits
- **Enterprise** — contact sales

Top-up packs: 20 credits / $10, 50 / $23 (Popular, -8%), 100 / $44 (Best Value, -12%), 250 / $100 (-20%).

## Your first move

1. `git pull origin master && git checkout feat/new-features && git rebase master`
2. Read all five docs.
3. Start B-01 (apps-builder scaffold). Write test, scaffold, gate, commit, push, log.
4. Stop. Wait for orchestrator.

## Coordination points

- B-05 needs A-03. If A-03 is not merged when you reach B-05, stub the agent factory and request merge via `questions/orchestrator.md`.
- B-06 needs to align with A-10's payload shape. Coordinate via `questions/agent-a.md` before writing the endpoint.
- B-07 needs A-07. Same rule.
