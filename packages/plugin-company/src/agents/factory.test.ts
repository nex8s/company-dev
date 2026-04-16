import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agents,
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  CEO_DEFAULT_NAME,
  findCeo,
  hireAgent,
  listDirectReports,
  seedCompanyAgents,
} from "./factory.js";
import { DEFAULT_DEPARTMENT_TITLES, DEFAULT_SYSTEM_PROMPTS } from "./prompts.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping agent factory tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-agents-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, overrides?: { issuePrefix?: string }) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: overrides?.issuePrefix ?? "TST" })
    .returning();
  return company;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("agent factory (A-03)", () => {
  it(
    "seedCompanyAgents yields a single CEO with 0 direct reports",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);

      const { ceo } = await seedCompanyAgents(db, { companyId: company.id });

      expect(ceo.name).toBe(CEO_DEFAULT_NAME);
      expect(ceo.role).toBe("ceo");
      expect(ceo.title).toBe(DEFAULT_DEPARTMENT_TITLES.ceo);
      expect(ceo.reportsTo).toBeNull();
      expect(ceo.companyId).toBe(company.id);
      expect((ceo.runtimeConfig as Record<string, unknown>).systemPrompt).toBe(
        DEFAULT_SYSTEM_PROMPTS.ceo,
      );

      const allAgents = await db.select().from(agents).where(eq(agents.companyId, company.id));
      expect(allAgents).toHaveLength(1);

      const ceosInCompany = allAgents.filter((a) => a.role === "ceo");
      expect(ceosInCompany).toHaveLength(1);

      const reports = await listDirectReports(db, ceo.id);
      expect(reports).toHaveLength(0);
    },
    60_000,
  );

  it(
    "seedCompanyAgents is idempotent — re-seeding returns the original CEO",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);

      const first = await seedCompanyAgents(db, { companyId: company.id });
      const second = await seedCompanyAgents(db, { companyId: company.id });

      expect(second.ceo.id).toBe(first.ceo.id);
      const allAgents = await db.select().from(agents).where(eq(agents.companyId, company.id));
      expect(allAgents).toHaveLength(1);
    },
    60_000,
  );

  it(
    "hireAgent(dept='Marketing') tags the new agent with the correct department",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);
      const { ceo } = await seedCompanyAgents(db, { companyId: company.id });

      const marketer = await hireAgent(db, {
        companyId: company.id,
        department: "marketing",
        name: "Mira",
      });

      expect(marketer.role).toBe("marketing");
      expect(marketer.name).toBe("Mira");
      expect(marketer.title).toBe(DEFAULT_DEPARTMENT_TITLES.marketing);
      expect(marketer.companyId).toBe(company.id);
      expect(marketer.reportsTo).toBe(ceo.id);
      expect((marketer.runtimeConfig as Record<string, unknown>).systemPrompt).toBe(
        DEFAULT_SYSTEM_PROMPTS.marketing,
      );

      const reports = await listDirectReports(db, ceo.id);
      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe(marketer.id);
    },
    60_000,
  );

  it(
    "hireAgent supports all five hireable departments with distinct prompts",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);
      await seedCompanyAgents(db, { companyId: company.id });

      const hires = await Promise.all(
        (["engineering", "marketing", "operations", "sales", "support"] as const).map((dept, i) =>
          hireAgent(db, { companyId: company.id, department: dept, name: `Agent-${i}` }),
        ),
      );

      for (const hire of hires) {
        expect(hire.role).toBe(hire.role);
        expect(hire.title).toBe(DEFAULT_DEPARTMENT_TITLES[hire.role as keyof typeof DEFAULT_DEPARTMENT_TITLES]);
        expect((hire.runtimeConfig as Record<string, unknown>).systemPrompt).toBe(
          DEFAULT_SYSTEM_PROMPTS[hire.role as keyof typeof DEFAULT_SYSTEM_PROMPTS],
        );
      }

      const roles = hires.map((h) => h.role).sort();
      expect(roles).toEqual(["engineering", "marketing", "operations", "sales", "support"]);
    },
    60_000,
  );

  it(
    "hireAgent rejects the ceo department and unknown departments",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);
      await seedCompanyAgents(db, { companyId: company.id });

      await expect(
        hireAgent(db, {
          companyId: company.id,
          // @ts-expect-error — deliberately invalid department for runtime guard
          department: "ceo",
          name: "Impostor",
        }),
      ).rejects.toThrow(/not hireable/i);

      await expect(
        hireAgent(db, {
          companyId: company.id,
          // @ts-expect-error — deliberately invalid department for runtime guard
          department: "legal",
          name: "Impostor",
        }),
      ).rejects.toThrow(/not hireable/i);
    },
    60_000,
  );

  it(
    "hireAgent throws when no CEO has been seeded yet and reportsTo is not explicit",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);

      await expect(
        hireAgent(db, { companyId: company.id, department: "engineering", name: "Early Bird" }),
      ).rejects.toThrow(/no CEO seeded/i);
    },
    60_000,
  );

  it(
    "findCeo returns null for a company with no seeded CEO",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db);

      const ceo = await findCeo(db, company.id);
      expect(ceo).toBeNull();
    },
    60_000,
  );
});
