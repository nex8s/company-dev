import { afterEach, describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  deleteConnection,
  getConnection,
  listConnections,
  listConnectionsByKind,
  storeConnection,
} from "./connections.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-connect-tools storage tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-connect-tools-storage-");
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

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-connect-tools storage (B-14)", () => {
  it("stores a connection and listConnections returns it", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "ABC");

    const stored = await storeConnection(db, {
      companyId: company.id,
      toolKind: "github",
      label: "nex8s",
      token: "ghp_test_token",
      scopes: ["repo:read", "read:user"],
      metadata: { installationId: 12345 },
    });

    expect(stored).toMatchObject({
      companyId: company.id,
      toolKind: "github",
      label: "nex8s",
      token: "ghp_test_token",
      scopes: ["repo:read", "read:user"],
      metadata: { installationId: 12345 },
    });
    expect(stored.id).toBeTruthy();
    expect(stored.connectedAt).toBeInstanceOf(Date);

    const listed = await listConnections(db, company.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(stored.id);
    expect(listed[0].token).toBe("ghp_test_token");
  });

  it("listConnections is scoped per company", async () => {
    const db = await freshDatabase();
    const a = await freshCompany(db, "AAA");
    const b = await freshCompany(db, "BBB");

    await storeConnection(db, {
      companyId: a.id,
      toolKind: "notion",
      label: "workspace-a",
      token: "tok-a",
    });
    await storeConnection(db, {
      companyId: b.id,
      toolKind: "notion",
      label: "workspace-b",
      token: "tok-b",
    });

    const aList = await listConnections(db, a.id);
    expect(aList).toHaveLength(1);
    expect(aList[0].label).toBe("workspace-a");

    const bList = await listConnections(db, b.id);
    expect(bList).toHaveLength(1);
    expect(bList[0].label).toBe("workspace-b");
  });

  it("listConnectionsByKind filters by tool", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "CCC");

    await storeConnection(db, {
      companyId: company.id,
      toolKind: "slack",
      label: "main",
      token: "x1",
    });
    await storeConnection(db, {
      companyId: company.id,
      toolKind: "linear",
      label: "main",
      token: "x2",
    });

    const slack = await listConnectionsByKind(db, company.id, "slack");
    expect(slack.map((c) => c.toolKind)).toEqual(["slack"]);

    const figma = await listConnectionsByKind(db, company.id, "figma");
    expect(figma).toEqual([]);
  });

  it("getConnection scopes by company too — cross-company access returns null", async () => {
    const db = await freshDatabase();
    const a = await freshCompany(db, "AA1");
    const b = await freshCompany(db, "BB1");
    const stored = await storeConnection(db, {
      companyId: a.id,
      toolKind: "vercel",
      label: "production",
      token: "v1",
    });

    expect(await getConnection(db, a.id, stored.id)).not.toBeNull();
    expect(await getConnection(db, b.id, stored.id)).toBeNull();
  });

  it("deleteConnection removes the row and returns true; second call returns false", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "DDD");
    const stored = await storeConnection(db, {
      companyId: company.id,
      toolKind: "figma",
      label: "design",
      token: "f1",
    });

    expect(await deleteConnection(db, company.id, stored.id)).toBe(true);
    expect(await deleteConnection(db, company.id, stored.id)).toBe(false);
    expect(await listConnections(db, company.id)).toEqual([]);
  });

  it("the (company_id, tool_kind, label) unique index rejects duplicates", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "EEE");
    await storeConnection(db, {
      companyId: company.id,
      toolKind: "github",
      label: "main",
      token: "t1",
    });
    await expect(
      storeConnection(db, {
        companyId: company.id,
        toolKind: "github",
        label: "main",
        token: "t2",
      }),
    ).rejects.toThrow();
  });
});
