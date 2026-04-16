import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  agents,
  applyPendingMigrations,
  companies,
  companyProfiles,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
  templateInstallations,
} from "@paperclipai/db";
import { InMemoryStoreTemplatesRepository } from "./repo.js";
import { seedTemplates } from "./seeds/index.js";
import {
  countAgentsForCompany,
  getInstallationForCompany,
  getInstalledSkills,
  installTemplate,
} from "./install.js";
import { smma } from "./seeds/smma.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-store install tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-store-install-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshRepo() {
  const repo = new InMemoryStoreTemplatesRepository();
  await repo.loadSeeds(seedTemplates);
  return repo;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-store · installTemplate (B-05)", () => {
  it(
    "installing SMMA creates a company with CEO + one agent per seed employee, skills attached",
    async () => {
      const db = await freshDatabase();
      const repo = await freshRepo();

      const result = await installTemplate(db, repo, { slug: "smma" });

      expect(result.companyId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.ceoAgentId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.hiredAgentIds).toHaveLength(smma.employees.length);

      const [company] = await db.select().from(companies).where(eq(companies.id, result.companyId));
      expect(company.name).toBe(smma.title);

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.companyId, result.companyId));
      expect(profile.name).toBe(smma.title);
      expect(profile.description).toBe(smma.summary);

      const total = await countAgentsForCompany(db, result.companyId);
      expect(total).toBe(smma.employees.length + 1);

      const [installation] = await db
        .select()
        .from(templateInstallations)
        .where(eq(templateInstallations.companyId, result.companyId));
      expect(installation.templateSlug).toBe("smma");
      expect(installation.templateKind).toBe("business");
      expect(installation.skills).toEqual(smma.skills);
      expect(Array.isArray(installation.employees)).toBe(true);
      expect((installation.employees as unknown[]).length).toBe(smma.employees.length);

      const skills = await getInstalledSkills(db, result.companyId);
      expect(skills).toEqual(smma.skills);
    },
    60_000,
  );

  it(
    "installed company starts idle — no pending-review runs, every hired agent is active with the correct department",
    async () => {
      const db = await freshDatabase();
      const repo = await freshRepo();
      const result = await installTemplate(db, repo, { slug: "smma" });

      const hired = await db
        .select()
        .from(agents)
        .where(and(eq(agents.companyId, result.companyId), eq(agents.reportsTo, result.ceoAgentId)));

      expect(hired).toHaveLength(smma.employees.length);
      const hiredDepartments = hired.map((a) => a.role).sort();
      const expectedDepartments = smma.employees.map((e) => e.department).sort();
      expect(hiredDepartments).toEqual(expectedDepartments);

      // "Starts idle" — no runtime state rows provisioned by install itself.
      // Agents default status is set by the `agents` table default, not by install.
      for (const hiredAgent of hired) {
        expect(hiredAgent.companyId).toBe(result.companyId);
        expect(hiredAgent.reportsTo).toBe(result.ceoAgentId);
      }
    },
    60_000,
  );

  it(
    "installing dev-agency seeds a CEO (even though the seed does not list one) and hires every listed employee",
    async () => {
      const db = await freshDatabase();
      const repo = await freshRepo();

      const result = await installTemplate(db, repo, { slug: "dev-agency" });
      const devAgency = await repo.getBySlug("dev-agency");
      expect(devAgency).not.toBeNull();

      const total = await countAgentsForCompany(db, result.companyId);
      expect(total).toBe(devAgency!.employees.length + 1);
    },
    60_000,
  );

  it(
    "rolls back cleanly when the seed does not exist",
    async () => {
      const db = await freshDatabase();
      const repo = await freshRepo();

      await expect(installTemplate(db, repo, { slug: "not-a-real-slug" })).rejects.toThrow(/template not found/);

      const allCompanies = await db.select().from(companies);
      expect(allCompanies).toHaveLength(0);

      const allInstallations = await db.select().from(templateInstallations);
      expect(allInstallations).toHaveLength(0);
    },
    60_000,
  );

  it(
    "records the template_kind correctly on the installation row",
    async () => {
      const db = await freshDatabase();
      const repo = await freshRepo();

      const result = await installTemplate(db, repo, { slug: "faceless-youtube" });
      const installation = await getInstallationForCompany(db, result.companyId);
      expect(installation).not.toBeNull();
      expect(installation!.templateKind).toBe("business");
    },
    60_000,
  );
});
