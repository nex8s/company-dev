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
import { MockBankProvider } from "../bank/mock.js";
import { MockEmailProvider } from "../email/mock.js";
import {
  createPluginIdentityRouter,
  type PluginIdentityActorInfo,
} from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-identity domain router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-identity-domains-");
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
  setDenyCompanyId: (companyId: string | null) => void;
}

async function buildApp(): Promise<AppCtx> {
  const db = await freshDatabase();
  let denyCompanyId: string | null = null;
  const actor: PluginIdentityActorInfo = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };

  const app = express();
  app.use(express.json());
  app.use(
    createPluginIdentityRouter({
      db,
      bankProvider: new MockBankProvider(),
      emailProvider: new MockEmailProvider(),
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

describeEmbeddedPostgres("plugin-identity HTTP router (B-15) · domains", () => {
  it("first POST → GET round-trip: created with isDefault:true and DNS records present", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM1");

    const created = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "first.test" })
      .expect(201);

    expect(created.body.domain).toMatchObject({
      companyId: company.id,
      domain: "first.test",
      isDefault: true,
      status: "stub",
    });
    expect(Array.isArray(created.body.domain.dnsRecords)).toBe(true);
    expect(created.body.domain.dnsRecords.length).toBeGreaterThan(0);
    // Mock provider returns one CNAME + one TXT record (B-11).
    const recordTypes = created.body.domain.dnsRecords.map((r: { type: string }) => r.type).sort();
    expect(recordTypes).toContain("CNAME");

    const listed = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-identity/domains`)
      .expect(200);
    expect(listed.body.domains).toHaveLength(1);
    expect(listed.body.domains[0].domain).toBe("first.test");
    expect(listed.body.domains[0].isDefault).toBe(true);
  });

  it("second POST creates a domain with isDefault:false; only the first stays default", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM2");

    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "primary.test" })
      .expect(201);
    const second = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "secondary.test" })
      .expect(201);

    expect(second.body.domain.isDefault).toBe(false);

    const listed = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-identity/domains`)
      .expect(200);
    const defaults = listed.body.domains.filter((d: { isDefault: boolean }) => d.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].domain).toBe("primary.test");
  });

  it("POST .../default flips default — only the targeted domain is default afterward", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM3");

    const a = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "alpha.test" })
      .expect(201);
    const b = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "beta.test" })
      .expect(201);

    expect(a.body.domain.isDefault).toBe(true);
    expect(b.body.domain.isDefault).toBe(false);

    const flipped = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains/${b.body.domain.id}/default`)
      .expect(200);
    expect(flipped.body.domain.isDefault).toBe(true);

    const listed = await request(ctx.app)
      .get(`/companies/${company.id}/plugin-identity/domains`)
      .expect(200);
    const byDomain = Object.fromEntries(
      listed.body.domains.map((d: { domain: string; isDefault: boolean }) => [d.domain, d.isDefault]),
    );
    expect(byDomain).toEqual({ "alpha.test": false, "beta.test": true });
  });

  it("POST .../default returns 404 for an unknown domain id", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM4");
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains/00000000-0000-0000-0000-000000000000/default`)
      .expect(404);
  });

  it("POST validates body — non-hostname rejected with 400", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM5");
    const res = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "not_a_hostname" })
      .expect(400);
    expect(res.body.error).toMatch(/domain/);
  });

  it("POST normalizes the domain to lowercase before persisting", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM6");
    const created = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "  Mixed-CASE.Test  " })
      .expect(201);
    expect(created.body.domain.domain).toBe("mixed-case.test");
  });

  it("POST returns 409 on duplicate (companyId, domain)", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM7");
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "dupe.test" })
      .expect(201);
    const conflict = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "dupe.test" })
      .expect(409);
    expect(conflict.body.error).toMatch(/already connected/);
  });

  it("scopes domains per company — COMPANY_A's domain invisible to COMPANY_B", async () => {
    const ctx = await buildApp();
    const a = await freshCompany(ctx.db, "DA1");
    const b = await freshCompany(ctx.db, "DB1");
    await request(ctx.app)
      .post(`/companies/${a.id}/plugin-identity/domains`)
      .send({ domain: "a-only.test" })
      .expect(201);
    const inB = await request(ctx.app)
      .get(`/companies/${b.id}/plugin-identity/domains`)
      .expect(200);
    expect(inB.body.domains).toEqual([]);
  });

  it("DELETE removes the domain; second DELETE returns 404", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM8");
    const created = await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "deleteme.test" })
      .expect(201);
    await request(ctx.app)
      .delete(`/companies/${company.id}/plugin-identity/domains/${created.body.domain.id}`)
      .expect(204);
    await request(ctx.app)
      .delete(`/companies/${company.id}/plugin-identity/domains/${created.body.domain.id}`)
      .expect(404);
  });

  it("authz failure surfaces as 403 from POST", async () => {
    const ctx = await buildApp();
    const company = await freshCompany(ctx.db, "DM9");
    ctx.setDenyCompanyId(company.id);
    await request(ctx.app)
      .post(`/companies/${company.id}/plugin-identity/domains`)
      .send({ domain: "denied.test" })
      .expect(403);
  });
});
