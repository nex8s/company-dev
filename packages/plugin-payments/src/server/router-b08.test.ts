import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import {
  agents,
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
import { recordTopUp, recordUsage } from "../ledger/operations.js";
import { upsertSubscription } from "../billing/subscriptions.js";
import {
  LocalServerInfoProvider,
  type ServerInfoProvider,
  type ServerInstanceInfo,
} from "../server-info/provider.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping B-08 router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-payments-b08-");
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

async function freshAgent(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  companyId: string,
  name: string,
) {
  const [agent] = await db
    .insert(agents)
    .values({ companyId, name, role: "engineering", title: "Engineer" })
    .returning();
  return agent!;
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  setServerInfo: (provider: ServerInfoProvider) => void;
}

async function buildHost(
  opts: { now?: () => Date; serverInfo?: ServerInfoProvider } = {},
): Promise<AppCtx> {
  const db = await freshDatabase();
  let serverInfo: ServerInfoProvider = opts.serverInfo ?? new LocalServerInfoProvider();
  const actor: PluginPaymentsActorInfo = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  const app = express();
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
      stripe: new MockStripeClient(),
      webhookSecret: "whsec_mock",
      env: {} as NodeJS.ProcessEnv,
      now: opts.now,
      // Wrap so each test can hot-swap.
      serverInfo: { getServerInfo: (input) => serverInfo.getServerInfo(input) },
      authorizeCompanyAccess: () => {},
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
    setServerInfo: (next) => {
      serverInfo = next;
    },
  };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-payments HTTP router (B-08) · settings tabs", () => {
  it("Billing tab: returns null plan + zero balance for a fresh company", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "BL1");
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/billing/summary`)
      .expect(200);
    expect(res.body.billing).toEqual({ plan: null, balanceCents: 0 });
  });

  it("Billing tab: surfaces plan metadata + balance after a subscription + top-up land", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "BL2");
    await upsertSubscription(ctx.db, {
      companyId: company.id,
      stripeSubscriptionId: "sub_starter",
      plan: "starter",
      status: "active",
      currentPeriodStart: new Date(2026, 3, 1),
      currentPeriodEnd: new Date(2026, 4, 1),
      cancelAt: null,
      canceledAt: null,
    });
    await recordTopUp(ctx.db, {
      companyId: company.id,
      amountCents: 4500,
      externalRef: "stripe:invoice:in_1",
      description: "Stripe top-up: 50 credits",
    });
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/billing/summary`)
      .expect(200);
    expect(res.body.billing.plan).toMatchObject({
      key: "starter",
      displayName: "Starter",
      monthlyPriceCents: 4900,
      status: "active",
    });
    expect(res.body.billing.plan.currentPeriodEnd).toBe(new Date(2026, 4, 1).toISOString());
    expect(res.body.billing.balanceCents).toBe(4500);
  });

  it("Usage tab: returns balance + per-agent breakdown for the current month, scoped to the configured `now`", async () => {
    const fixedNow = new Date("2026-04-15T12:00:00Z");
    const ctx = await buildHost({ now: () => fixedNow });
    const company = await freshCompany(ctx.db, "US1");
    const alice = await freshAgent(ctx.db, company.id, "Alice");
    const bob = await freshAgent(ctx.db, company.id, "Bob");

    await recordTopUp(ctx.db, { companyId: company.id, amountCents: 10_000 });
    await recordUsage(ctx.db, {
      companyId: company.id,
      agentId: alice.id,
      amountCents: 250,
    });
    await recordUsage(ctx.db, {
      companyId: company.id,
      agentId: alice.id,
      amountCents: 100,
    });
    await recordUsage(ctx.db, {
      companyId: company.id,
      agentId: bob.id,
      amountCents: 75,
    });

    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/usage/summary`)
      .expect(200);

    expect(res.body.usage.balanceCents).toBe(10_000 - (250 + 100 + 75));
    expect(res.body.usage.totalUsageCents).toBe(425);
    expect(res.body.usage.window.start).toBe(new Date(Date.UTC(2026, 3, 1)).toISOString());
    expect(res.body.usage.window.end).toBe(new Date(Date.UTC(2026, 4, 1)).toISOString());
    const byAgentSorted = [...res.body.usage.byAgent].sort(
      (a: { usageCents: number }, b: { usageCents: number }) => b.usageCents - a.usageCents,
    );
    expect(byAgentSorted).toEqual([
      { agentId: alice.id, usageCents: 350, entryCount: 2 },
      { agentId: bob.id, usageCents: 75, entryCount: 1 },
    ]);
  });

  it("Usage tab: transactions endpoint returns ledger entries newest-first with limit", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "US2");
    for (let i = 0; i < 4; i += 1) {
      await recordTopUp(ctx.db, {
        companyId: company.id,
        amountCents: 100 + i,
        externalRef: `ref-${i}`,
      });
    }

    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/usage/transactions`)
      .query({ limit: "2" })
      .expect(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions[0].externalRef).toBe("ref-3");
    expect(res.body.transactions[1].externalRef).toBe("ref-2");
    expect(res.body.transactions[0]).toMatchObject({
      entryType: "top_up",
      amountCents: 103,
    });
    expect(typeof res.body.transactions[0].createdAt).toBe("string");
  });

  it("Usage tab: transactions `before` cursor pages backwards in time", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "US3");
    for (let i = 0; i < 3; i += 1) {
      await recordTopUp(ctx.db, {
        companyId: company.id,
        amountCents: 100,
        externalRef: `ref-${i}`,
      });
    }

    const first = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/usage/transactions`)
      .query({ limit: "1" })
      .expect(200);
    expect(first.body.transactions).toHaveLength(1);
    const cursor = first.body.transactions[0].createdAt;

    const next = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/usage/transactions`)
      .query({ limit: "5", before: cursor })
      .expect(200);
    expect(next.body.transactions.length).toBeGreaterThan(0);
    for (const t of next.body.transactions) {
      expect(Date.parse(t.createdAt)).toBeLessThan(Date.parse(cursor));
    }
  });

  it("Server tab: returns the LocalServerInfoProvider stub by default", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "SV1");
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/server/info`)
      .expect(200);
    expect(res.body.server).toMatchObject({
      instanceId: "local-dev",
      region: "local",
      state: "running",
      source: "local-dev",
    });
    expect(res.body.server.cpu).toMatchObject({ cores: 4 });
    expect(res.body.server.machineEvents.length).toBeGreaterThan(0);
  });

  it("Server tab: a swapped ServerInfoProvider is honoured (A-09 swap point)", async () => {
    const flyish: ServerInfoProvider = {
      async getServerInfo({ companyId }): Promise<ServerInstanceInfo> {
        return {
          instanceId: `fly-${companyId.slice(0, 4)}`,
          region: "iad",
          state: "running",
          cpu: { cores: 2, utilizationPct: 38.7 },
          ramMb: { total: 1024, usedPct: 51.2 },
          storageGb: { total: 10, usedPct: 22.1 },
          uptimeSeconds: 12345,
          machineEvents: [
            {
              id: "ev1",
              timestamp: new Date().toISOString(),
              type: "started",
              message: "Fly machine booted",
            },
          ],
          source: "fly",
        };
      },
    };
    const ctx = await buildHost({ serverInfo: flyish });
    const company = await freshCompany(ctx.db, "SV2");
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/server/info`)
      .expect(200);
    expect(res.body.server.source).toBe("fly");
    expect(res.body.server.region).toBe("iad");
    expect(res.body.server.cpu.utilizationPct).toBe(38.7);
  });

  it("query validation: invalid `limit` is 400", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "QV1");
    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/usage/transactions`)
      .query({ limit: "not-a-number" })
      .expect(400);
    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-payments/usage/transactions`)
      .query({ before: "not-a-date" })
      .expect(400);
  });
});
