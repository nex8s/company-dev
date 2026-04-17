import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import {
  applyPendingMigrations,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { storeTemplates } from "../schema.js";
import {
  createPluginStoreRouter,
  type PluginStoreActorInfo,
} from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-store router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-store-router-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  setUnauthenticated: (v: boolean) => void;
}

async function buildHost(): Promise<AppCtx> {
  const db = await freshDatabase();
  let unauthenticated = false;
  const actor: PluginStoreActorInfo = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  const app = express();
  app.use(express.json());
  app.use(
    createPluginStoreRouter({
      db,
      assertAuthenticated: (_req: Request) => {
        if (unauthenticated) {
          throw Object.assign(new Error("unauth"), { status: 401 });
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
    setUnauthenticated: (v) => {
      unauthenticated = v;
    },
  };
}

async function seedTemplate(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  overrides: Partial<{
    slug: string;
    kind: string;
    title: string;
    category: string;
    summary: string;
    creator: string;
    skills: string[];
    employees: unknown[];
  }> = {},
) {
  const [row] = await db
    .insert(storeTemplates)
    .values({
      slug: overrides.slug ?? `slug-${Math.random().toString(36).slice(2, 10)}`,
      kind: overrides.kind ?? "employee",
      title: overrides.title ?? "Test Template",
      category: overrides.category ?? "Engineering",
      summary: overrides.summary ?? "A test template",
      creator: overrides.creator ?? "tester",
      skills: overrides.skills ?? [],
      employees: overrides.employees ?? [],
    })
    .returning();
  return row!;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-store HTTP router (B-06) · discovery", () => {
  it("GET /store/templates returns an empty list with pagination shape on a fresh DB", async () => {
    const ctx = await buildHost();
    const res = await request(ctx.app).get("/store/templates").expect(200);
    expect(res.body).toEqual({
      templates: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
  });

  it("GET /store/templates lists rows newest-first with default pagination", async () => {
    const ctx = await buildHost();
    await seedTemplate(ctx.db, { slug: "alpha", title: "Alpha" });
    await seedTemplate(ctx.db, { slug: "beta", title: "Beta" });
    await seedTemplate(ctx.db, { slug: "gamma", title: "Gamma" });

    const res = await request(ctx.app).get("/store/templates").expect(200);
    expect(res.body.templates).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
    // Most recently inserted first.
    expect(res.body.templates[0].slug).toBe("gamma");
  });

  it("GET /store/templates filters by kind", async () => {
    const ctx = await buildHost();
    await seedTemplate(ctx.db, { slug: "biz", kind: "business" });
    await seedTemplate(ctx.db, { slug: "emp", kind: "employee" });

    const res = await request(ctx.app)
      .get("/store/templates")
      .query({ kind: "business" })
      .expect(200);
    expect(res.body.templates.map((t: { slug: string }) => t.slug)).toEqual(["biz"]);
    expect(res.body.pagination.total).toBe(1);
  });

  it("GET /store/templates filters by category and free-text q (case-insensitive on title/summary)", async () => {
    const ctx = await buildHost();
    await seedTemplate(ctx.db, {
      slug: "marketing-1",
      category: "Marketing",
      title: "SEO landing pages",
      summary: "Drive organic search traffic",
    });
    await seedTemplate(ctx.db, {
      slug: "engineering-1",
      category: "Engineering",
      title: "Build a CI bot",
      summary: "Automated quality gates",
    });
    await seedTemplate(ctx.db, {
      slug: "marketing-2",
      category: "Marketing",
      title: "Newsletter writer",
      summary: "Weekly editorial content",
    });

    const cat = await request(ctx.app)
      .get("/store/templates")
      .query({ category: "Marketing" })
      .expect(200);
    expect(cat.body.pagination.total).toBe(2);
    const slugs = cat.body.templates.map((t: { slug: string }) => t.slug).sort();
    expect(slugs).toEqual(["marketing-1", "marketing-2"]);

    const q = await request(ctx.app)
      .get("/store/templates")
      .query({ q: "ORGANIC" })
      .expect(200);
    expect(q.body.templates).toHaveLength(1);
    expect(q.body.templates[0].slug).toBe("marketing-1");
  });

  it("GET /store/templates honours limit + offset and reports the total ignoring pagination", async () => {
    const ctx = await buildHost();
    for (let i = 0; i < 5; i += 1) {
      await seedTemplate(ctx.db, { slug: `t-${i}`, title: `T${i}` });
    }
    const page1 = await request(ctx.app)
      .get("/store/templates")
      .query({ limit: "2", offset: "0" })
      .expect(200);
    expect(page1.body.templates).toHaveLength(2);
    expect(page1.body.pagination).toEqual({ limit: 2, offset: 0, total: 5 });

    const page2 = await request(ctx.app)
      .get("/store/templates")
      .query({ limit: "2", offset: "2" })
      .expect(200);
    expect(page2.body.templates).toHaveLength(2);
    expect(page2.body.pagination).toEqual({ limit: 2, offset: 2, total: 5 });

    const page3 = await request(ctx.app)
      .get("/store/templates")
      .query({ limit: "2", offset: "4" })
      .expect(200);
    expect(page3.body.templates).toHaveLength(1);
    expect(page3.body.pagination).toEqual({ limit: 2, offset: 4, total: 5 });
  });

  it("GET /store/templates rejects invalid query params with 400", async () => {
    const ctx = await buildHost();
    await request(ctx.app)
      .get("/store/templates")
      .query({ limit: "0" })
      .expect(400);
    await request(ctx.app)
      .get("/store/templates")
      .query({ kind: "myspace" })
      .expect(400);
  });

  it("GET /store/templates/facets returns per-category and per-kind counts plus total", async () => {
    const ctx = await buildHost();
    await seedTemplate(ctx.db, { slug: "f1", kind: "business", category: "Marketing" });
    await seedTemplate(ctx.db, { slug: "f2", kind: "business", category: "Engineering" });
    await seedTemplate(ctx.db, { slug: "f3", kind: "employee", category: "Engineering" });
    await seedTemplate(ctx.db, { slug: "f4", kind: "employee", category: "Engineering" });

    const res = await request(ctx.app).get("/store/templates/facets").expect(200);
    expect(res.body.total).toBe(4);
    const cat = Object.fromEntries(
      res.body.categories.map((c: { category: string; count: number }) => [c.category, c.count]),
    );
    expect(cat).toEqual({ Engineering: 3, Marketing: 1 });
    const kind = Object.fromEntries(
      res.body.kinds.map((k: { kind: string; count: number }) => [k.kind, k.count]),
    );
    expect(kind).toEqual({ business: 2, employee: 2 });
  });

  it("GET /store/templates/:slug returns a single template, 404 when absent", async () => {
    const ctx = await buildHost();
    const seeded = await seedTemplate(ctx.db, { slug: "the-one" });
    const ok = await request(ctx.app).get(`/store/templates/the-one`).expect(200);
    expect(ok.body.template.id).toBe(seeded.id);

    await request(ctx.app).get(`/store/templates/missing-slug`).expect(404);
  });

  it("GET /store/templates/:slug rejects an invalid slug shape with 400", async () => {
    const ctx = await buildHost();
    await request(ctx.app).get(`/store/templates/Has Space`).expect(400);
  });

  it("authentication failure surfaces as 401 across all routes", async () => {
    const ctx = await buildHost();
    ctx.setUnauthenticated(true);
    await request(ctx.app).get("/store/templates").expect(401);
    await request(ctx.app).get("/store/templates/facets").expect(401);
    await request(ctx.app).get("/store/templates/anything").expect(401);
  });
});
