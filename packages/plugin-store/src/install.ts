import { eq } from "drizzle-orm";
import {
  agents,
  companies,
  companyProfiles,
  templateInstallations,
  type Db,
} from "@paperclipai/db";
import { hireAgent, seedCompanyAgents } from "@paperclipai/plugin-company";
import type { StoreTemplatesRepository } from "./repo.js";
import type { SeedTemplate } from "./types.js";

export type InstallTemplateInput = {
  slug: string;
  /** Optional override for the company name; defaults to the template's title. */
  companyName?: string;
  /**
   * Issue prefix for the new company. Must be unique across companies.
   * Defaults to the uppercased first 3 characters of the slug (dashes stripped).
   */
  issuePrefix?: string;
};

export type InstallTemplateResult = {
  companyId: string;
  companyProfileId: string;
  ceoAgentId: string;
  hiredAgentIds: string[];
  installationId: string;
};

function defaultIssuePrefix(slug: string): string {
  const stripped = slug.replace(/-/g, "").toUpperCase();
  return stripped.slice(0, 3) || "NEW";
}

/**
 * Install a Store business template into a new company. Runs in a single
 * transaction so a partial failure leaves no orphaned state.
 *
 * Order of operations:
 *   1. Resolve the seed via the templates repository.
 *   2. Insert the `companies` row.
 *   3. Insert the `company_profiles` row.
 *   4. Seed the default CEO agent (A-03 `seedCompanyAgents`).
 *   5. Hire one agent per seed employee (A-03 `hireAgent`).
 *   6. Insert a `template_installations` snapshot with the seed's skills.
 */
export async function installTemplate(
  db: Db,
  repo: StoreTemplatesRepository,
  input: InstallTemplateInput,
): Promise<InstallTemplateResult> {
  const seed = await repo.getBySlug(input.slug);
  if (!seed) {
    throw new Error(`template not found: ${input.slug}`);
  }

  return db.transaction(async (tx) => {
    const name = input.companyName ?? seed.title;
    const issuePrefix = input.issuePrefix ?? defaultIssuePrefix(seed.slug);

    const [company] = await tx
      .insert(companies)
      .values({ name, issuePrefix })
      .returning();

    const [profile] = await tx
      .insert(companyProfiles)
      .values({
        companyId: company.id,
        name,
        description: seed.summary,
      })
      .returning();

    const { ceo } = await seedCompanyAgents(tx as unknown as Db, {
      companyId: company.id,
    });

    const hiredAgentIds: string[] = [];
    for (const employee of seed.employees) {
      const hired = await hireAgent(tx as unknown as Db, {
        companyId: company.id,
        department: employee.department,
        name: employee.role,
      });
      hiredAgentIds.push(hired.id);
    }

    const [installation] = await tx
      .insert(templateInstallations)
      .values({
        companyId: company.id,
        templateSlug: seed.slug,
        templateKind: seed.kind,
        skills: seed.skills,
        employees: seed.employees,
      })
      .returning();

    return {
      companyId: company.id,
      companyProfileId: profile.id,
      ceoAgentId: ceo.id,
      hiredAgentIds,
      installationId: installation.id,
    };
  });
}

/** Return the skills snapshot recorded at install time for a company. */
export async function getInstalledSkills(db: Db, companyId: string): Promise<string[]> {
  const [row] = await db
    .select({ skills: templateInstallations.skills })
    .from(templateInstallations)
    .where(eq(templateInstallations.companyId, companyId))
    .limit(1);
  return (row?.skills as string[] | undefined) ?? [];
}

/** Fetch the install record for a company, if any. */
export async function getInstallationForCompany(db: Db, companyId: string) {
  const [row] = await db
    .select()
    .from(templateInstallations)
    .where(eq(templateInstallations.companyId, companyId))
    .limit(1);
  return row ?? null;
}

/** Count the agents (including the CEO) attached to a company. */
export async function countAgentsForCompany(db: Db, companyId: string): Promise<number> {
  const rows = await db.select({ id: agents.id }).from(agents).where(eq(agents.companyId, companyId));
  return rows.length;
}

export type { SeedTemplate };
