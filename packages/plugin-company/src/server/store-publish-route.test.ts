import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  agents,
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { storeTemplates } from "@paperclipai/plugin-store";
import { createPluginCompanyRouter } from "./router.js";
import { hireAgent, seedCompanyAgents } from "../agents/factory.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping store-publish route tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-publish-route-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [c] = await db.insert(companies).values({ name: "Test Co", issuePrefix: prefix }).returning();
  return c!;
}

async function buildApp() {
  const db = await freshDatabase();
  const app = express();
  app.use(express.json());
  app.use(
    createPluginCompanyRouter({
      db,
      authorizeCompanyAccess: (_req: Request, _companyId: string) => {
        /* allow all */
      },
      resolveActorInfo: () => ({
        actorType: "user",
        actorId: "tester",
        agentId: null,
        runId: null,
      }),
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status ?? 500).json({ error: err.message ?? "internal" });
  });
  return { db, app };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("store publishing routes (A-10)", () => {
  it("POST publish-agent → GET list sees it; GET list?kind=employee filters", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R01");
    await seedCompanyAgents(ctx.db, { companyId: co.id });
    const marketer = await hireAgent(ctx.db, { companyId: co.id, department: "marketing", name: "Mira" });

    const publishRes = await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/agents/${marketer.id}/publish`)
      .send({
        slug: "acme-mira",
        category: "Marketing",
        creator: "acme-team",
        responsibilities: ["Campaigns"],
        skills: ["content"],
      })
      .expect(201);
    expect(publishRes.body.template.slug).toBe("acme-mira");
    expect(publishRes.body.template.kind).toBe("employee");

    const listRes = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-company/store/templates?kind=employee`)
      .expect(200);
    expect(listRes.body.templates).toHaveLength(1);
    expect(listRes.body.templates[0].slug).toBe("acme-mira");

    const allRes = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-company/store/templates`)
      .expect(200);
    expect(allRes.body.templates).toHaveLength(1);
  });

  it("POST publish-company → multi-agent template lands with correct employee count", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R02");
    await seedCompanyAgents(ctx.db, { companyId: co.id });
    await hireAgent(ctx.db, { companyId: co.id, department: "engineering", name: "Eli" });
    await hireAgent(ctx.db, { companyId: co.id, department: "sales", name: "Sam" });

    const res = await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/publish`)
      .send({ slug: "acme-full", category: "Business", creator: "acme-team" })
      .expect(201);
    expect(res.body.template.kind).toBe("business");
    expect(res.body.template.employees.length).toBeGreaterThanOrEqual(3);

    const listRes = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-company/store/templates?kind=business`)
      .expect(200);
    expect(listRes.body.templates).toHaveLength(1);
    expect(listRes.body.templates[0].slug).toBe("acme-full");
    // sanity: store_templates row actually persisted
    const [row] = await ctx.db.select().from(storeTemplates).where(eq(storeTemplates.slug, "acme-full"));
    expect(row?.kind).toBe("business");
  });

  it("POST publish-agent → 404 when the agentId is not in the company", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R03");
    const other = await freshCompany(ctx.db, "R04");
    await seedCompanyAgents(ctx.db, { companyId: other.id });
    const [otherAgent] = await ctx.db.select().from(agents).where(eq(agents.companyId, other.id));

    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/agents/${otherAgent!.id}/publish`)
      .send({ slug: "wrong-co", category: "x", creator: "y" })
      .expect(404);
  });

  it("POST publish-agent → 409 on duplicate slug", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R05");
    await seedCompanyAgents(ctx.db, { companyId: co.id });
    const a = await hireAgent(ctx.db, { companyId: co.id, department: "engineering", name: "A" });

    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/agents/${a.id}/publish`)
      .send({ slug: "shared", category: "Engineering", creator: "acme-team" })
      .expect(201);
    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/agents/${a.id}/publish`)
      .send({ slug: "shared", category: "Engineering", creator: "acme-team" })
      .expect(409);
  });

  it("POST publish-company → 409 when the company has no agents", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R06");
    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/publish`)
      .send({ slug: "empty", category: "x", creator: "y" })
      .expect(409);
  });

  it("POST publish-agent → 400 on a malformed slug", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R07");
    const { ceo } = await seedCompanyAgents(ctx.db, { companyId: co.id });
    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/agents/${ceo.id}/publish`)
      .send({ slug: "Bad Slug!", category: "x", creator: "y" })
      .expect(400);
  });

  it("POST publish-agent → 400 on unknown body fields (strict schema)", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R08");
    const { ceo } = await seedCompanyAgents(ctx.db, { companyId: co.id });
    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-company/agents/${ceo.id}/publish`)
      .send({ slug: "acme-ok", category: "x", creator: "y", extra: "nope" })
      .expect(400);
  });

  it("GET list?kind=... → 400 on an unknown kind filter", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "R09");
    await request(ctx.app)
      .get(`/companies/${co.id}/plugin-company/store/templates?kind=explosive`)
      .expect(400);
  });
});
