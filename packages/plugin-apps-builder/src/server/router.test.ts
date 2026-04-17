import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import {
  applyPendingMigrations,
  apps,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { buildApp } from "../builder/build.js";
import {
  createPluginAppsBuilderRouter,
  type PluginAppsBuilderActorInfo,
} from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-apps-builder router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-apps-builder-router-");
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

async function freshApp(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  companyId: string,
  name: string,
) {
  const [app] = await db.insert(apps).values({ companyId, name }).returning();
  return app!;
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  setDenyCompanyId: (companyId: string | null) => void;
}

async function buildHost(): Promise<AppCtx> {
  const db = await freshDatabase();
  let denyCompanyId: string | null = null;
  const actor: PluginAppsBuilderActorInfo = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  const app = express();
  app.use(express.json());
  app.use(
    createPluginAppsBuilderRouter({
      db,
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

describeEmbeddedPostgres("plugin-apps-builder HTTP router (B-03) · tabs", () => {
  it("GET /apps/:appId returns the App DTO for an in-company lookup", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "TAB");
    const app = await freshApp(ctx.db, company.id, "My App");

    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}`)
      .expect(200);

    expect(res.body.app).toMatchObject({
      id: app.id,
      companyId: company.id,
      name: "My App",
      envVars: {},
    });
    expect(typeof res.body.app.createdAt).toBe("string");
  });

  it("GET /apps/:appId returns 404 for cross-company lookups", async () => {
    const ctx = await buildHost();
    const a = await freshCompany(ctx.db, "CAA");
    const b = await freshCompany(ctx.db, "CBB");
    const app = await freshApp(ctx.db, a.id, "A");
    await request(ctx.app)
      .get(`/companies/${b.id}/plugin-apps-builder/apps/${app.id}`)
      .expect(404);
  });

  it("Preview tab: returns productionDomain + status, both 'not_deployed' until buildApp runs", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "PRE");
    const app = await freshApp(ctx.db, company.id, "Preview");

    const before = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/preview`)
      .expect(200);
    expect(before.body.preview).toEqual({ productionDomain: null, status: "not_deployed" });

    await buildApp(ctx.db, { appId: app.id, prompt: "go" });

    const after = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/preview`)
      .expect(200);
    expect(after.body.preview.status).toBe("deployed");
    expect(after.body.preview.productionDomain).toMatch(/^https:\/\/.+\.vercel\.stub\.test$/);
  });

  it("Code tab: GET /files returns a tree plus a flat list; blob fetch returns content", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "COD");
    const app = await freshApp(ctx.db, company.id, "Code");
    await buildApp(ctx.db, { appId: app.id, prompt: "hello" });

    const list = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/files`)
      .expect(200);
    expect(list.body.count).toBeGreaterThan(0);
    expect(list.body.tree.kind).toBe("directory");
    const topLevelNames = list.body.tree.children.map((c: { name: string }) => c.name);
    expect(topLevelNames).toContain("package.json");
    expect(topLevelNames).toContain("app");

    const blob = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/files/blob`)
      .query({ path: "package.json" })
      .expect(200);
    expect(blob.body.file.path).toBe(`apps/${app.id}/package.json`);
    expect(() => JSON.parse(blob.body.file.content)).not.toThrow();
  });

  it("Code tab: GET /files/blob 404s for an unknown path", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "BLB");
    const app = await freshApp(ctx.db, company.id, "Blob");
    await buildApp(ctx.db, { appId: app.id, prompt: "x" });

    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/files/blob`)
      .query({ path: "does-not-exist.txt" })
      .expect(404);
  });

  it("Deployments tab: returns a chronological list after each buildApp", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "DEP");
    const app = await freshApp(ctx.db, company.id, "Deploy");

    const empty = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/deployments`)
      .expect(200);
    expect(empty.body.deployments).toEqual([]);

    await buildApp(ctx.db, { appId: app.id, prompt: "one" });
    await buildApp(ctx.db, { appId: app.id, prompt: "two" });

    const list = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/deployments`)
      .expect(200);
    expect(list.body.deployments).toHaveLength(2);
    for (const d of list.body.deployments) {
      expect(d.status).toBe("succeeded");
      expect(d.url).toMatch(/^https:\/\/.+\.vercel\.stub\.test$/);
      expect(typeof d.triggeredAt).toBe("string");
    }
    // Newest-first ordering.
    const ts0 = Date.parse(list.body.deployments[0].triggeredAt);
    const ts1 = Date.parse(list.body.deployments[1].triggeredAt);
    expect(ts0).toBeGreaterThanOrEqual(ts1);
  });

  it("Settings tab: PATCH merges env vars, GET reads them back, DELETE removes a key", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "ENV");
    const app = await freshApp(ctx.db, company.id, "Env");

    const initial = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env`)
      .expect(200);
    expect(initial.body.envVars).toEqual({});

    const merged = await request(ctx.app)
      .patch(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env`)
      .send({ envVars: { API_KEY: "secret", DEBUG: "1" } })
      .expect(200);
    expect(merged.body.envVars).toEqual({ API_KEY: "secret", DEBUG: "1" });

    const partial = await request(ctx.app)
      .patch(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env`)
      .send({ envVars: { API_KEY: "rotated" } })
      .expect(200);
    expect(partial.body.envVars).toEqual({ API_KEY: "rotated", DEBUG: "1" });

    const afterDelete = await request(ctx.app)
      .delete(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env/DEBUG`)
      .expect(200);
    expect(afterDelete.body.envVars).toEqual({ API_KEY: "rotated" });
  });

  it("Settings tab: PATCH rejects invalid env var keys (lowercase, dashes) with 400", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "VAL");
    const app = await freshApp(ctx.db, company.id, "Val");
    const res = await request(ctx.app)
      .patch(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env`)
      .send({ envVars: { "bad-key": "x" } })
      .expect(400);
    expect(res.body.error).toMatch(/envVars|bad-key/i);
  });

  it("Settings tab: DELETE rejects invalid env var keys (lowercase) with 400", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "DLV");
    const app = await freshApp(ctx.db, company.id, "Dlv");
    await request(ctx.app)
      .delete(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env/lowercase`)
      .expect(400);
  });

  it("authz failure surfaces as 403 across tabs", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "FBD");
    const app = await freshApp(ctx.db, company.id, "Fbd");
    ctx.setDenyCompanyId(company.id);

    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/preview`)
      .expect(403);
    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/files`)
      .expect(403);
    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/deployments`)
      .expect(403);
    await request(ctx.app)
      .get(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env`)
      .expect(403);
    await request(ctx.app)
      .patch(`/companies/${company.id}/plugin-apps-builder/apps/${app.id}/env`)
      .send({ envVars: {} })
      .expect(403);
  });

  it("unknown appId surfaces as 404 across tabs", async () => {
    const ctx = await buildHost();
    const company = await freshCompany(ctx.db, "404");
    const missing = "00000000-0000-0000-0000-000000000000";
    for (const tail of ["preview", "files", "deployments", "env"]) {
      await request(ctx.app)
        .get(`/companies/${company.id}/plugin-apps-builder/apps/${missing}/${tail}`)
        .expect(404);
    }
  });
});
