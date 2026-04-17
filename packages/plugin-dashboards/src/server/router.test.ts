import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  agents,
  applyPendingMigrations,
  companies,
  createDb,
  creditLedger,
  dashboardPages,
  getEmbeddedPostgresTestSupport,
  issues,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { createPluginDashboardsRouter } from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-dashboards tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-dashboards-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  setDenyCompanyId: (id: string | null) => void;
}

async function buildApp(): Promise<AppCtx> {
  const db = await freshDatabase();
  let denyCompanyId: string | null = null;

  const app = express();
  app.use(express.json());
  app.use(
    createPluginDashboardsRouter({
      db,
      authorizeCompanyAccess: (_req: Request, companyId: string) => {
        if (denyCompanyId && denyCompanyId === companyId) {
          const err = Object.assign(new Error("forbidden"), { status: 403 });
          throw err;
        }
      },
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status ?? 500).json({ error: err.message ?? "internal" });
  });

  return {
    db,
    app,
    setDenyCompanyId: (id) => {
      denyCompanyId = id;
    },
  };
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [c] = await db.insert(companies).values({ name: "Test Co", issuePrefix: prefix }).returning();
  return c!;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-dashboards router (A-08)", () => {
  it("POST create → GET list → GET by id round-trip", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "CRD");

    const created = await request(ctx.app)
      .post(`/companies/${co.id}/plugin-dashboards/pages`)
      .send({
        title: "Finance",
        layout: {
          widgets: [
            { id: "w1", type: "revenue" },
            {
              id: "w2",
              type: "ai-usage",
              params: { windowDays: 14 },
              position: { x: 0, y: 0, w: 6, h: 4 },
            },
          ],
        },
      })
      .expect(201);
    expect(created.body.page.title).toBe("Finance");
    expect(created.body.page.companyId).toBe(co.id);

    const list = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages`)
      .expect(200);
    expect(list.body.pages).toHaveLength(1);
    expect(list.body.pages[0].id).toBe(created.body.page.id);

    const got = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}`)
      .expect(200);
    expect(got.body.page.id).toBe(created.body.page.id);
    expect(got.body.page.layout.widgets).toHaveLength(2);
  });

  it("PATCH updates title and/or layout; rejects empty body", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "PAT");
    const created = await request(ctx.app)
      .post(`/companies/${co.id}/plugin-dashboards/pages`)
      .send({ title: "v1", layout: { widgets: [] } })
      .expect(201);

    const patched = await request(ctx.app)
      .patch(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}`)
      .send({ title: "v2" })
      .expect(200);
    expect(patched.body.page.title).toBe("v2");
    expect(patched.body.page.layout.widgets).toEqual([]);

    await request(ctx.app)
      .patch(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}`)
      .send({})
      .expect(400);
  });

  it("DELETE removes the page; subsequent GET returns 404", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "DEL");
    const created = await request(ctx.app)
      .post(`/companies/${co.id}/plugin-dashboards/pages`)
      .send({ title: "ToDelete", layout: { widgets: [] } })
      .expect(201);

    await request(ctx.app)
      .delete(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}`)
      .expect(204);
    await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}`)
      .expect(404);
  });

  it("rejects an unknown widget type with 400 (strict zod enum)", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "BAD");
    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-dashboards/pages`)
      .send({
        title: "Bad",
        layout: { widgets: [{ id: "w1", type: "explosion-meter" }] },
      })
      .expect(400);
  });

  it("rejects an unknown body field (strict schema)", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "STR");
    await request(ctx.app)
      .post(`/companies/${co.id}/plugin-dashboards/pages`)
      .send({ title: "t", layout: { widgets: [] }, extra: "nope" })
      .expect(400);
  });

  it("404 on get/patch/delete for an unknown pageId", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "NFP");
    const bogus = "00000000-0000-0000-0000-000000000000";
    await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages/${bogus}`)
      .expect(404);
    await request(ctx.app)
      .patch(`/companies/${co.id}/plugin-dashboards/pages/${bogus}`)
      .send({ title: "x" })
      .expect(404);
    await request(ctx.app)
      .delete(`/companies/${co.id}/plugin-dashboards/pages/${bogus}`)
      .expect(404);
  });

  it("propagates 403 from authorizeCompanyAccess", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "FOR");
    ctx.setDenyCompanyId(co.id);
    await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages`)
      .expect(403);
  });

  it(
    "GET render returns an envelope per widget with live data for team-status / task-kanban / ai-usage, and a stub payload for revenue",
    async () => {
      const ctx = await buildApp();
      const co = await freshCompany(ctx.db, "REN");

      // Seed minimal data for the three live resolvers.
      const [alice] = await ctx.db
        .insert(agents)
        .values({ companyId: co.id, name: "Alice", status: "idle" })
        .returning();
      const [bob] = await ctx.db
        .insert(agents)
        .values({ companyId: co.id, name: "Bob", status: "running" })
        .returning();
      await ctx.db.insert(issues).values([
        { companyId: co.id, title: "T-1", status: "todo" },
        { companyId: co.id, title: "T-2", status: "in_progress" },
        { companyId: co.id, title: "T-3", status: "done" },
      ]);
      await ctx.db.insert(creditLedger).values([
        { companyId: co.id, agentId: alice!.id, entryType: "usage", amountCents: 500 },
        { companyId: co.id, agentId: bob!.id, entryType: "usage", amountCents: 300 },
      ]);

      const created = await request(ctx.app)
        .post(`/companies/${co.id}/plugin-dashboards/pages`)
        .send({
          title: "Overview",
          layout: {
            widgets: [
              { id: "r", type: "revenue" },
              { id: "u", type: "ai-usage", params: { windowDays: 30 } },
              { id: "t", type: "team-status" },
              { id: "k", type: "task-kanban" },
            ],
          },
        })
        .expect(201);

      const render = await request(ctx.app)
        .get(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}/render`)
        .expect(200);
      expect(render.body.widgets).toHaveLength(4);
      const byId: Record<string, any> = {};
      for (const w of render.body.widgets) byId[w.id] = w;

      expect(byId.r.data.status).toBe("stubbed");
      expect(byId.r.data.provider).toBe("stripe");

      expect(byId.u.data.totalUsageCents).toBe(800);
      const aliceRow = byId.u.data.byAgent.find((r: any) => r.agentId === alice!.id);
      expect(aliceRow.usageCents).toBe(500);

      expect(byId.t.data.totalAgents).toBe(2);
      expect(byId.t.data.statusCounts.idle).toBe(1);
      expect(byId.t.data.statusCounts.running).toBe(1);

      expect(byId.k.data.totalIssues).toBe(3);
      expect(byId.k.data.columns.todo).toHaveLength(1);
      expect(byId.k.data.columns.in_progress).toHaveLength(1);
      expect(byId.k.data.columns.done).toHaveLength(1);
    },
    20_000,
  );

  it("GET render on a page with an empty widgets list returns an empty list", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "EMP");
    const created = await request(ctx.app)
      .post(`/companies/${co.id}/plugin-dashboards/pages`)
      .send({ title: "Empty", layout: { widgets: [] } })
      .expect(201);
    const render = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages/${created.body.page.id}/render`)
      .expect(200);
    expect(render.body.widgets).toEqual([]);
  });

  it("GET render returns 404 on unknown pageId", async () => {
    const ctx = await buildApp();
    const co = await freshCompany(ctx.db, "NFR");
    await request(ctx.app)
      .get(`/companies/${co.id}/plugin-dashboards/pages/00000000-0000-0000-0000-000000000000/render`)
      .expect(404);
  });

  it("GET list is scoped per-company", async () => {
    const ctx = await buildApp();
    const a = await freshCompany(ctx.db, "SA");
    const b = await freshCompany(ctx.db, "SB");
    await request(ctx.app)
      .post(`/companies/${a.id}/plugin-dashboards/pages`)
      .send({ title: "A1", layout: { widgets: [] } })
      .expect(201);
    await request(ctx.app)
      .post(`/companies/${a.id}/plugin-dashboards/pages`)
      .send({ title: "A2", layout: { widgets: [] } })
      .expect(201);
    await request(ctx.app)
      .post(`/companies/${b.id}/plugin-dashboards/pages`)
      .send({ title: "B1", layout: { widgets: [] } })
      .expect(201);

    const aList = await request(ctx.app)
      .get(`/companies/${a.id}/plugin-dashboards/pages`)
      .expect(200);
    const bList = await request(ctx.app)
      .get(`/companies/${b.id}/plugin-dashboards/pages`)
      .expect(200);
    expect(aList.body.pages).toHaveLength(2);
    expect(bList.body.pages).toHaveLength(1);

    // DB sanity: two rows for A, one for B.
    const aRows = await ctx.db.select().from(dashboardPages).where(eq(dashboardPages.companyId, a.id));
    expect(aRows).toHaveLength(2);
  });
});
