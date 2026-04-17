import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  agents,
  appFiles,
  applyPendingMigrations,
  apps,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  issueComments,
  issues,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { seedCompanyAgents } from "@paperclipai/plugin-company";
import {
  buildApp,
  DEPLOYED_CHECK_IN_PREFIX,
  ensureLandingPageEngineer,
  LANDING_PAGE_ENGINEER_NAME,
} from "./build.js";
import { SCAFFOLD_FILE_PATHS } from "./scaffold.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-apps-builder build tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-apps-builder-");
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

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-apps-builder · buildApp (B-02)", () => {
  it("produces files under apps/<app_id>/, commits them to DB, and emits the check-in", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "BA1");
    const app = await freshApp(db, company.id, "Acme Landing");

    const result = await buildApp(db, {
      appId: app.id,
      prompt: "A minimalist landing page for Acme, the productivity tool for engineers.",
    });

    // Files persisted to DB, one per scaffold path, each rooted under apps/<app_id>/.
    expect(result.files.map((f) => f.path).sort()).toEqual(
      SCAFFOLD_FILE_PATHS.map((p) => `apps/${app.id}/${p}`).sort(),
    );
    for (const f of result.files) {
      expect(f.path.startsWith(`apps/${app.id}/`)).toBe(true);
      expect(f.sizeBytes).toBeGreaterThan(0);
    }

    const rows = await db.select().from(appFiles).where(eq(appFiles.appId, app.id));
    expect(rows).toHaveLength(SCAFFOLD_FILE_PATHS.length);

    // Prompt landed in the generated page hero.
    const page = rows.find((r) => r.path.endsWith("/app/page.tsx"));
    expect(page?.content).toContain("Acme Landing");
    expect(page?.content).toContain("Acme, the productivity tool for engineers.");

    // Deployed-app check-in lives on the launch issue, matches the A-06 convention.
    const [checkIn] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, result.checkInCommentId));
    expect(checkIn).toBeDefined();
    expect(checkIn!.body.startsWith(DEPLOYED_CHECK_IN_PREFIX)).toBe(true);
    expect(checkIn!.body).toContain("Acme Landing");
    expect(checkIn!.body).toContain(result.productionDomain);
    expect(checkIn!.issueId).toBe(result.issueId);

    // Production-domain stub stored on the App row.
    const [updatedApp] = await db.select().from(apps).where(eq(apps.id, app.id));
    expect(updatedApp!.productionDomain).toBe(result.productionDomain);
    expect(updatedApp!.productionDomain).toMatch(/^https:\/\/.+\.vercel\.stub\.test$/);

    // Landing Page Engineer was hired + reports to the CEO the factory seeded.
    const engineer = await db
      .select()
      .from(agents)
      .where(eq(agents.id, result.engineerAgentId))
      .limit(1);
    expect(engineer[0]!.role).toBe("engineering");
    expect(engineer[0]!.name).toBe(LANDING_PAGE_ENGINEER_NAME);
    const reportsTo = engineer[0]!.reportsTo;
    expect(reportsTo).not.toBeNull();
    const [manager] = await db.select().from(agents).where(eq(agents.id, reportsTo!));
    expect(manager!.role).toBe("ceo");
  });

  it("re-running buildApp on the same app reuses the engineer, issue, and check-in comment", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "BA2");
    const app = await freshApp(db, company.id, "Beta");

    const first = await buildApp(db, { appId: app.id, prompt: "Beta landing." });
    const second = await buildApp(db, { appId: app.id, prompt: "Beta landing." });

    expect(second.engineerAgentId).toBe(first.engineerAgentId);
    expect(second.issueId).toBe(first.issueId);
    expect(second.checkInCommentId).toBe(first.checkInCommentId);
    expect(second.productionDomain).toBe(first.productionDomain);

    // Still exactly one Landing Page Engineer in the company.
    const engineers = await db
      .select()
      .from(agents)
      .where(
        and(eq(agents.companyId, company.id), eq(agents.name, LANDING_PAGE_ENGINEER_NAME)),
      );
    expect(engineers).toHaveLength(1);

    // Exactly one launch issue.
    const launchIssues = await db
      .select()
      .from(issues)
      .where(and(eq(issues.companyId, company.id), eq(issues.title, `Launch app: Beta`)));
    expect(launchIssues).toHaveLength(1);

    // No duplicate check-in comments on that issue.
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, first.issueId));
    expect(comments).toHaveLength(1);

    // File rows upserted — same count as scaffold paths.
    const rows = await db.select().from(appFiles).where(eq(appFiles.appId, app.id));
    expect(rows).toHaveLength(SCAFFOLD_FILE_PATHS.length);
  });

  it("rejects an unknown appId with a descriptive error", async () => {
    const db = await freshDatabase();
    await expect(
      buildApp(db, {
        appId: "00000000-0000-0000-0000-000000000000",
        prompt: "x",
      }),
    ).rejects.toThrow(/app not found/);
  });

  it("ensureLandingPageEngineer: CEO is seeded if not present, then the engineer is hired and reports to the CEO", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "BA3");

    // No CEO yet — ensure seeds one then hires the engineer reporting to them.
    const engineer = await ensureLandingPageEngineer(db, company.id);
    expect(engineer.role).toBe("engineering");
    expect(engineer.reportsTo).not.toBeNull();

    const [ceo] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, company.id), eq(agents.role, "ceo")))
      .limit(1);
    expect(ceo).toBeDefined();
    expect(engineer.reportsTo).toBe(ceo!.id);

    // Calling again returns the same row — no double-hires.
    const again = await ensureLandingPageEngineer(db, company.id);
    expect(again.id).toBe(engineer.id);
  });

  it("reuses an existing CEO when the company was already seeded before the first build", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "BA4");
    await seedCompanyAgents(db, { companyId: company.id, ceoName: "Naive" });

    const engineer = await ensureLandingPageEngineer(db, company.id);
    const allCeos = await db
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, company.id), eq(agents.role, "ceo")));
    expect(allCeos).toHaveLength(1);
    expect(engineer.reportsTo).toBe(allCeos[0]!.id);
  });

  it("scaffolded file paths are all unique and rooted under apps/<app_id>/", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "BA5");
    const app = await freshApp(db, company.id, "Path Test");

    const result = await buildApp(db, { appId: app.id, prompt: "ok" });
    const paths = result.files.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) {
      expect(p).toMatch(new RegExp(`^apps/${app.id}/`));
    }
  });
});
