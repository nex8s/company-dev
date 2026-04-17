import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import {
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  createPluginPaymentsRouter,
  type PluginPaymentsActorInfo,
} from "./router.js";
import { MockStripeClient } from "../stripe/mock-client.js";
import { getSubscriptionForCompany } from "../billing/subscriptions.js";
import { getCompanyBalanceCents } from "../ledger/operations.js";
import type { StripeWebhookEvent } from "../stripe/types.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-payments router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-payments-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: prefix })
    .returning();
  return company!;
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  stripe: MockStripeClient;
  setDenyCompanyId: (companyId: string | null) => void;
}

async function buildHost(env: Record<string, string> = {}): Promise<AppCtx> {
  const db = await freshDatabase();
  const stripe = new MockStripeClient();
  let denyCompanyId: string | null = null;
  const actor: PluginPaymentsActorInfo = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  const app = express();
  // Mirror server/src/app.ts: capture rawBody for webhook signature check.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(
    createPluginPaymentsRouter({
      db,
      stripe,
      webhookSecret: "whsec_mock",
      env: env as NodeJS.ProcessEnv,
      authorizeCompanyAccess: (_req: Request, companyId: string) => {
        if (denyCompanyId && denyCompanyId === companyId) {
          throw Object.assign(new Error("forbidden"), { status: 403 });
        }
      },
      resolveActorInfo: () => actor,
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status ?? 500).json({ error: err.message ?? "internal" });
  });

  return {
    db,
    app,
    stripe,
    setDenyCompanyId: (id) => {
      denyCompanyId = id;
    },
  };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-payments HTTP router (B-07)", () => {
  it("GET /catalog lists the three plans + four top-ups, reporting priceConfigured status", async () => {
    const ctx = await buildHost({ STRIPE_PRICE_STARTER: "price_starter_test" });
    const company = await freshCompany(ctx.db, "CAT");
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/catalog`)
      .expect(200);
    expect(res.body.plans.map((p: { key: string }) => p.key).sort()).toEqual(["pro", "starter"]);
    const starter = res.body.plans.find((p: { key: string }) => p.key === "starter");
    const pro = res.body.plans.find((p: { key: string }) => p.key === "pro");
    expect(starter.priceConfigured).toBe(true);
    expect(pro.priceConfigured).toBe(false);
    expect(res.body.topUps.map((o: { credits: number }) => o.credits)).toEqual([20, 50, 100, 250]);
  });

  it("POST /checkout/subscription creates a customer + returns a checkout URL with metadata tagging the plan", async () => {
    const ctx = await buildHost({ STRIPE_PRICE_STARTER: "price_starter_test" });
    const company = await freshCompany(ctx.db, "SUB");
    const res = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/checkout/subscription`)
      .send({
        plan: "starter",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
      .expect(201);
    expect(res.body.checkout.id).toMatch(/^cs_mock_/);
    expect(res.body.checkout.url).toContain("checkout.stripe.mock");
    expect(res.body.checkout.url).toContain(encodeURIComponent("price_starter_test"));
  });

  it("POST /checkout/subscription returns 503 when the plan's Stripe price id env var is unset", async () => {
    const ctx = await buildHost(); // no env
    const company = await freshCompany(ctx.db, "NPR");
    const res = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/checkout/subscription`)
      .send({
        plan: "pro",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
      .expect(503);
    expect(res.body.error).toMatch(/STRIPE_PRICE_PRO/);
  });

  it("POST /checkout/top-up rejects an unsupported credits amount with 400", async () => {
    const ctx = await buildHost({ STRIPE_PRICE_TOPUP_50: "price_topup_50" });
    const company = await freshCompany(ctx.db, "TU1");
    const res = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/checkout/top-up`)
      .send({
        credits: 33,
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
      .expect(400);
    expect(res.body.error).toMatch(/credits/);
  });

  it("POST /portal hands a billing portal URL scoped to the company's Stripe customer", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "PRT");
    const res = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/portal`)
      .send({ returnUrl: "https://app.test/settings" })
      .expect(200);
    expect(res.body.portal.url).toContain("billing.stripe.mock");
  });

  it("webhook: subscription.created is persisted in billing_subscriptions", async () => {
    const ctx = await buildHost({ STRIPE_PRICE_STARTER: "price_starter_test" });
    const company = await freshCompany(ctx.db, "WH1");

    // First call /checkout/subscription so billing_customers knows about this company.
    const checkout = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/checkout/subscription`)
      .send({
        plan: "starter",
        successUrl: "https://app.test/s",
        cancelUrl: "https://app.test/c",
      })
      .expect(201);
    expect(checkout.body.checkout.id).toBeDefined();
    const stripeCustomerId = await lookupStripeCustomer(ctx.db, company.id);

    const event: StripeWebhookEvent = {
      id: "evt_test_1",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_test_1",
          customer: stripeCustomerId,
          status: "active",
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_678_400,
          cancel_at: null,
          canceled_at: null,
          items: { data: [{ price: { id: "price_starter_test" } }] },
          metadata: { "companydev.plan": "starter" },
        },
      },
    };

    const res = await request(ctx.app)
      .post(`/webhooks/stripe`)
      .set("stripe-signature", "t=1,v1=mock")
      .set("content-type", "application/json")
      .send(event)
      .expect(200);
    expect(res.body).toEqual({ received: true, handled: true });

    const sub = await getSubscriptionForCompany(ctx.db, company.id);
    expect(sub).not.toBeNull();
    expect(sub!.plan).toBe("starter");
    expect(sub!.status).toBe("active");
    expect(sub!.stripeSubscriptionId).toBe("sub_test_1");
  });

  it("webhook: invoice.paid for a top_up-tagged invoice credits the ledger (idempotent on replay)", async () => {
    const ctx = await buildHost({ STRIPE_PRICE_TOPUP_50: "price_topup_50" });
    const company = await freshCompany(ctx.db, "WH2");

    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/checkout/top-up`)
      .send({
        credits: 50,
        successUrl: "https://app.test/s",
        cancelUrl: "https://app.test/c",
      })
      .expect(201);
    const stripeCustomerId = await lookupStripeCustomer(ctx.db, company.id);

    const event: StripeWebhookEvent = {
      id: "evt_invoice_1",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_50",
          customer: stripeCustomerId,
          subscription: null,
          amount_paid: 4500,
          currency: "usd",
          status: "paid",
          metadata: { "companydev.kind": "top_up", "companydev.credits": "50" },
        },
      },
    };

    // First delivery: ledger gains +$45.00.
    await request(ctx.app)
      .post(`/webhooks/stripe`)
      .set("stripe-signature", "t=1,v1=mock")
      .set("content-type", "application/json")
      .send(event)
      .expect(200);
    expect(await getCompanyBalanceCents(ctx.db, company.id)).toBe(4500);

    // Replay with same invoice id is idempotent via external_ref.
    await request(ctx.app)
      .post(`/webhooks/stripe`)
      .set("stripe-signature", "t=1,v1=mock")
      .set("content-type", "application/json")
      .send(event)
      .expect(200);
    expect(await getCompanyBalanceCents(ctx.db, company.id)).toBe(4500);
  });

  it("webhook: subscription.deleted marks the row canceled and sets canceled_at", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "WH3");
    // Seed a customer row directly so the webhook can resolve the company.
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/portal`)
      .send({ returnUrl: "https://app.test/r" })
      .expect(200);
    const stripeCustomerId = await lookupStripeCustomer(ctx.db, company.id);

    // Create, then delete.
    const createdEvent: StripeWebhookEvent = {
      id: "evt_created_del",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_del",
          customer: stripeCustomerId,
          status: "active",
          current_period_start: 1,
          current_period_end: 2,
          cancel_at: null,
          canceled_at: null,
          items: { data: [{ price: { id: "p" } }] },
          metadata: { "companydev.plan": "pro" },
        },
      },
    };
    const deletedEvent: StripeWebhookEvent = {
      id: "evt_deleted_del",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_del",
          customer: stripeCustomerId,
          status: "canceled",
          current_period_start: 1,
          current_period_end: 2,
          cancel_at: null,
          canceled_at: 1_700_100_000,
          items: { data: [{ price: { id: "p" } }] },
          metadata: { "companydev.plan": "pro" },
        },
      },
    };
    for (const event of [createdEvent, deletedEvent]) {
      await request(ctx.app)
        .post(`/webhooks/stripe`)
        .set("stripe-signature", "t=1,v1=mock")
        .set("content-type", "application/json")
        .send(event)
        .expect(200);
    }

    const sub = await getSubscriptionForCompany(ctx.db, company.id);
    expect(sub!.status).toBe("canceled");
    expect(sub!.canceledAt).toBeInstanceOf(Date);
  });

  it("webhook: rejects a bad signature with 400", async () => {
    const ctx = await buildHost();
    await request(ctx.app)
      .post(`/webhooks/stripe`)
      .set("stripe-signature", "t=1,v1=wrong")
      .set("content-type", "application/json")
      .send({})
      .expect(400);
  });

  it("webhook: missing Stripe-Signature header returns 400", async () => {
    const ctx = await buildHost();
    await request(ctx.app)
      .post(`/webhooks/stripe`)
      .set("content-type", "application/json")
      .send({ foo: "bar" })
      .expect(400);
  });

  it("GET /subscription returns null until a subscription event lands", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "GSR");
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/subscription`)
      .expect(200);
    expect(res.body.subscription).toBeNull();
  });

  it("authz failure on company routes surfaces as 403", async () => {
    const ctx = await buildHost({ STRIPE_PRICE_STARTER: "price_starter_test" });
    const company = await freshCompany(ctx.db, "FBD");
    ctx.setDenyCompanyId(company.id);
    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/subscription`)
      .expect(403);
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-payments/checkout/subscription`)
      .send({
        plan: "starter",
        successUrl: "https://app.test/s",
        cancelUrl: "https://app.test/c",
      })
      .expect(403);
  });
});

async function lookupStripeCustomer(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  companyId: string,
): Promise<string> {
  const { billingCustomers } = await import("@paperclipai/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.companyId, companyId))
    .limit(1);
  if (!row) throw new Error("billing_customers row missing for company");
  return row.stripeCustomerId;
}
