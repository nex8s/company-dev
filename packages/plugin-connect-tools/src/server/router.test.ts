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
  createPluginConnectToolsRouter,
  type PluginConnectToolsActorInfo,
} from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-connect-tools router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-connect-tools-router-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  setActor: (actor: PluginConnectToolsActorInfo | null) => void;
  setDenyCompanyId: (companyId: string | null) => void;
}

async function buildApp(): Promise<AppCtx> {
  const db = await freshDatabase();
  let actor: PluginConnectToolsActorInfo | null = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  let denyCompanyId: string | null = null;

  const app = express();
  app.use(express.json());
  app.use(
    createPluginConnectToolsRouter({
      db,
      authorizeCompanyAccess: (_req: Request, companyId: string) => {
        if (denyCompanyId && denyCompanyId === companyId) {
          throw Object.assign(new Error("forbidden"), { status: 403 });
        }
      },
      resolveActorInfo: () => {
        if (!actor) throw Object.assign(new Error("unauth"), { status: 401 });
        return actor;
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
    setActor: (next) => {
      actor = next;
    },
    setDenyCompanyId: (id) => {
      denyCompanyId = id;
    },
  };
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: prefix })
    .returning();
  return company!;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-connect-tools HTTP router (B-14) · connections", () => {
  it("POST → GET round-trip: a stored connection appears in listConnections", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "GO1");

    const created = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-connect-tools/connections`)
      .send({
        toolKind: "github",
        label: "nex8s",
        token: "ghp_test_token_xyz4242",
        scopes: ["repo:read", "read:user"],
      })
      .expect(201);

    expect(created.body.connection).toMatchObject({
      companyId: company.id,
      toolKind: "github",
      label: "nex8s",
      scopes: ["repo:read", "read:user"],
      tokenLast4: "4242",
    });
    // Raw token must not leak through the DTO.
    expect(created.body.connection.token).toBeUndefined();

    const listed = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-connect-tools/connections`)
      .expect(200);

    expect(listed.body.connections).toHaveLength(1);
    expect(listed.body.connections[0].id).toBe(created.body.connection.id);
    expect(listed.body.connections[0].tokenLast4).toBe("4242");
    expect(listed.body.connections[0].token).toBeUndefined();
  });

  it("GET adapters lists the six scaffolded tools", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "AD1");
    const res = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-connect-tools/adapters`)
      .expect(200);
    const kinds = res.body.adapters.map((a: { kind: string }) => a.kind).sort();
    expect(kinds).toEqual(["figma", "github", "linear", "notion", "slack", "vercel"]);
  });

  it("scopes connections per company — COMPANY_A's connection is invisible to COMPANY_B", async () => {
    const ctx = await buildApp();
    const a = await freshCompany(ctx.db, "AAB");
    const b = await freshCompany(ctx.db, "BBB");

    await request(ctx.app)
      .post(`/companies/${a.id}/plugin-connect-tools/connections`)
      .send({ toolKind: "slack", label: "main", token: "t1" })
      .expect(201);

    const listB = await request(ctx.app)
      .get(`/companies/${b.id}/plugin-connect-tools/connections`)
      .expect(200);
    expect(listB.body.connections).toEqual([]);
  });

  it("DELETE removes the connection and a follow-up GET no longer returns it", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DEL");
    const created = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-connect-tools/connections`)
      .send({ toolKind: "figma", label: "design", token: "f1" })
      .expect(201);

    await request(ctx.app)
      .delete(`/companies/${company.id}/plugin-connect-tools/connections/${created.body.connection.id}`)
      .expect(204);

    const listed = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-connect-tools/connections`)
      .expect(200);
    expect(listed.body.connections).toEqual([]);
  });

  it("DELETE returns 404 for an unknown connection id", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "404");
    await request(ctx.app)
      .delete(`/companies/${company.id}/plugin-connect-tools/connections/00000000-0000-0000-0000-000000000000`)
      .expect(404);
  });

  it("POST validates body — unknown toolKind is rejected", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "BAD");
    const res = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-connect-tools/connections`)
      .send({ toolKind: "myspace", label: "x", token: "t" })
      .expect(400);
    expect(res.body.error).toMatch(/toolKind/);
  });

  it("POST returns 409 on duplicate (companyId, toolKind, label)", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DUP");
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-connect-tools/connections`)
      .send({ toolKind: "linear", label: "primary", token: "t1" })
      .expect(201);
    const conflict = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-connect-tools/connections`)
      .send({ toolKind: "linear", label: "primary", token: "t2" })
      .expect(409);
    expect(conflict.body.error).toMatch(/already exists/);
  });

  it("POST surfaces the host's authz failure as 403", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "FBD");
    ctx.setDenyCompanyId(company.id);
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-connect-tools/connections`)
      .send({ toolKind: "notion", label: "x", token: "t" })
      .expect(403);
  });
});
