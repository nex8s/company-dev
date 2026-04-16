import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  applyPendingMigrations,
  companies,
  companyProfiles,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping company_profiles round-trip tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("company_profiles (A-02)", () => {
  it(
    "round-trips an insert+select on a freshly-migrated database",
    async () => {
      const db = await freshDatabase();

      const [company] = await db
        .insert(companies)
        .values({ name: "Acme Robotics", issuePrefix: "ACME" })
        .returning();

      const [inserted] = await db
        .insert(companyProfiles)
        .values({
          companyId: company.id,
          name: "Acme Robotics",
          description: "Autonomous warehouse robots",
          positioning: "Industrial automation for mid-market fulfillment centers",
          targetAudience: "Operations leaders at $50M–$500M ecommerce brands",
          strategyText: "Land with pilot, expand via usage-based pricing",
          incorporated: false,
          logoUrl: "https://cdn.example.com/acme/logo.svg",
        })
        .returning();

      expect(inserted.id).toBeTruthy();
      expect(inserted.companyId).toBe(company.id);
      expect(inserted.name).toBe("Acme Robotics");
      expect(inserted.incorporated).toBe(false);
      expect(inserted.trialState).toBe("trial");
      expect(inserted.createdAt).toBeInstanceOf(Date);
      expect(inserted.updatedAt).toBeInstanceOf(Date);

      const rows = await db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.companyId, company.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: "Acme Robotics",
        description: "Autonomous warehouse robots",
        positioning: "Industrial automation for mid-market fulfillment centers",
        targetAudience: "Operations leaders at $50M–$500M ecommerce brands",
        strategyText: "Land with pilot, expand via usage-based pricing",
        incorporated: false,
        logoUrl: "https://cdn.example.com/acme/logo.svg",
        trialState: "trial",
      });
    },
    60_000,
  );

  it(
    "enforces one profile per company (unique company_id)",
    async () => {
      const db = await freshDatabase();

      const [company] = await db
        .insert(companies)
        .values({ name: "Globex", issuePrefix: "GBX" })
        .returning();

      await db
        .insert(companyProfiles)
        .values({ companyId: company.id, name: "Globex" });

      await expect(
        db.insert(companyProfiles).values({ companyId: company.id, name: "Globex (duplicate)" }),
      ).rejects.toThrow(/company_profiles_company_uq|duplicate key/i);
    },
    60_000,
  );

  it(
    "cascades delete from companies to company_profiles",
    async () => {
      const db = await freshDatabase();

      const [company] = await db
        .insert(companies)
        .values({ name: "Initech", issuePrefix: "INT" })
        .returning();

      await db.insert(companyProfiles).values({ companyId: company.id, name: "Initech" });

      await db.delete(companies).where(eq(companies.id, company.id));

      const rows = await db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.companyId, company.id));
      expect(rows).toHaveLength(0);
    },
    60_000,
  );
});
