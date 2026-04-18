# Company.dev E2E harness (C-13)

Playwright harness that walks the `PLAN.md` happy-path gate:

```
landing loads → signup → create company → CEO seeded →
hire marketer → approve draft → launch app →
subscribe Starter → verify Server panel
```

## Run

```bash
pnpm test:e2e-company-dev           # headless
pnpm test:e2e-company-dev:headed    # with a visible browser
```

The config bootstraps a throwaway Paperclip instance in `local_trusted`
mode on port `3299` (override with `COMPANY_DEV_E2E_PORT`). It uses a
temp `PAPERCLIP_HOME`, so existing dev servers aren't touched.

## Environment flags

- `COMPANY_DEV_E2E_SKIP_LLM=false` — enable LLM-dependent assertions
  (hire marketer, approve draft). Requires `ANTHROPIC_API_KEY`.
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TOPUP_*`
  — set to a test-mode Stripe price id to enable the subscribe-redirect
  assertion. When unset, the spec renders the Upgrade page but stops
  short of clicking Subscribe (button is disabled in that case).

## Notes for the next maintainer

- Test selectors use the `data-testid` contracts established by the
  C-tasks. If you rename one, the spec will fail loudly rather than
  silently.
- LLM steps and the Stripe step are gated behind env flags so CI can
  run a fast sanity pass without keys; the full gate requires both.
- The spec lives in a single file so the end-to-end flow reads like
  a checklist. Pull helpers out into `./helpers/` if it grows past
  ~300 lines.
