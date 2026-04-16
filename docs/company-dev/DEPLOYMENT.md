# Company.dev — Deployment

One Docker image. Same code runs locally, on Fly, on Railway, on Vercel+Neon. Pick the platform by matching your scale + constraints.

## Local development

```bash
pnpm install
pnpm dev:once         # one-shot server + UI
# or
pnpm dev              # watch mode
```

Embedded Postgres is started automatically under `~/.company/postgres-data` (Paperclip default). UI at `http://localhost:5173`, server at `http://localhost:4316`.

No Stripe / Resend / Browserbase keys required — all providers fall back to their Mock implementation.

## Fly.io (recommended)

**Why:** Fly runs long-lived Node processes cheaply, supports websockets natively (agent heartbeats), global Postgres addon, Dockerfile-first. Typical monthly bill for a solo founder: ~$12 (shared-cpu-1x machine + 1GB RAM + 10GB Postgres).

```bash
fly launch --dockerfile Dockerfile --name company-dev-staging
fly postgres create --name company-dev-db
fly postgres attach company-dev-db --app company-dev-staging
fly secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

Promote to prod: `fly apps create company-dev` then repeat with prod secrets and a larger machine (`fly scale vm shared-cpu-2x --memory 2048`).

## Railway (secondary)

Similar shape to Fly but with a slightly cleaner CI experience for teams used to Heroku-style deploys.

```bash
railway init
railway add postgresql
railway variables set STRIPE_SECRET_KEY=sk_test_... ANTHROPIC_API_KEY=sk-ant-...
railway up
```

## Vercel + Neon (tertiary — only if the team insists)

Vercel's serverless model is awkward for Paperclip's long-running agent processes. If you must:

- Deploy the **UI** (Next.js or Vite-built static) to Vercel.
- Deploy the **server** separately to Fly or Railway (Vercel's serverless functions time out before most runs complete).
- Use **Neon** for Postgres (`DATABASE_URL=postgres://...neon.tech/...`).
- Configure the UI's `VITE_API_URL` to point at the Fly/Railway server URL.

Do not try to run Paperclip's server on Vercel's Edge or Node serverless runtime — agent runs frequently exceed the 300s / 900s hard limits.

## Required environment variables

Minimum for prod:

```
DATABASE_URL=postgres://...
ANTHROPIC_API_KEY=sk-ant-...                # default CEO/strategy model
OPENAI_API_KEY=sk-...                       # optional, for GPT-4o-mini bulk tier
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SESSION_SECRET=<generate: openssl rand -hex 32>

COMPANY_IDENTITY_PROVIDER=mock              # flip to real per provider when ready
COMPANY_BANK_PROVIDER=mock
COMPANY_EMAIL_PROVIDER=mock
COMPANY_BROWSER_PROVIDER=mock
```

## Health + smoke checks

- `/healthz` — returns 200 when server is up
- `/readyz` — returns 200 when DB migrations are applied and all configured providers respond
- `./scripts/smoke/company-dev-e2e.sh` — hits the signup → create-company → hire-agent → first-message loop against the deployed URL (written by Agent C as part of C-13)

## Rollback

Every release tag produces a Docker image with that tag. `fly deploy --image registry.fly.io/company-dev:v0.1.0-rc1` rolls back. Database migrations have rollback scripts alongside each forward migration (rule enforced by `plugin-db` contract test).
