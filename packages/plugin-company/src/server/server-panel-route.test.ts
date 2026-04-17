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
import { createPluginCompanyRouter } from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping server-panel route tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-panel-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [c] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: prefix })
    .returning();
  return c!;
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
}

async function buildApp(
  opts: { config: () => import("../server-panel/resolver.js").ServerPanelResolverConfig; deps?: import("../server-panel/resolver.js").ServerPanelResolverDeps },
): Promise<AppCtx> {
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
        actorId: "user-stub",
        agentId: null,
        runId: null,
      }),
      serverPanelConfig: opts.config,
      serverPanelDeps: opts.deps,
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

describeEmbeddedPostgres("server-panel route (A-09)", () => {
  it("returns well-formed local-dev stub JSON when no Fly config is present", async () => {
    const ctx = await buildApp({
      config: () => ({ flyAppName: null, flyApiToken: null }),
    });
    const co = await freshCompany(ctx.db, "PAN");

    const res = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-company/server-panel`)
      .expect(200);
    expect(res.body.serverPanel.mode).toBe("local-dev-stub");
    expect(res.body.serverPanel.instance).toMatchObject({
      machineId: "local-dev",
      region: "local",
      state: "started",
    });
    expect(res.body.serverPanel.machineEvents).toHaveLength(1);
    expect(typeof res.body.serverPanel.fetchedAt).toBe("string");
  });

  it("returns well-formed `mode: fly` JSON when FLY_APP_NAME + FLY_API_TOKEN are present", async () => {
    const machines = [
      {
        id: "machine-1",
        state: "started",
        region: "iad",
        config: {
          image: "registry.fly.io/app:deploy-1",
          guest: { cpu_kind: "shared", cpus: 2, memory_mb: 1024 },
        },
      },
    ];
    const events = [{ id: "e1", type: "launch", status: "success", timestamp: "2026-04-17T12:00:00Z" }];
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = url.endsWith("/machines") ? machines : events;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const ctx = await buildApp({
      config: () => ({ flyAppName: "test-app", flyApiToken: "test-token" }),
      deps: { fetch: fetchImpl },
    });
    const co = await freshCompany(ctx.db, "FLY");

    const res = await request(ctx.app)
      .get(`/companies/${co.id}/plugin-company/server-panel`)
      .expect(200);
    expect(res.body.serverPanel.mode).toBe("fly");
    expect(res.body.serverPanel.instance.machineId).toBe("machine-1");
    expect(res.body.serverPanel.instance.appName).toBe("test-app");
    expect(res.body.serverPanel.instance.cpus).toBe(2);
    expect(res.body.serverPanel.machineEvents).toHaveLength(1);
  });

  it("returns 400 for a malformed companyId path param", async () => {
    const ctx = await buildApp({
      config: () => ({ flyAppName: null, flyApiToken: null }),
    });
    await request(ctx.app)
      .get("/companies/not-a-uuid/plugin-company/server-panel")
      .expect(400);
  });
});
