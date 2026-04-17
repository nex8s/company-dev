import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agents,
  applyPendingMigrations,
  companies,
  companyProfiles,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { storeTemplates } from "@paperclipai/plugin-store";
import {
  getPublishedTemplateBySlug,
  listPublishedTemplates,
  publishAgentAsTemplate,
  publishCompanyAsTemplate,
} from "./publisher.js";
import { hireAgent, seedCompanyAgents } from "../agents/factory.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping store publishing tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-publish-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string, name = "Acme Robotics") {
  const [c] = await db.insert(companies).values({ name, issuePrefix: prefix }).returning();
  return c!;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("publishAgentAsTemplate (A-10)", () => {
  it("publishes a single agent as an `employee`-kind Store template", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "A01");
    await seedCompanyAgents(db, { companyId: company.id });
    const marketer = await hireAgent(db, {
      companyId: company.id,
      department: "marketing",
      name: "Mira",
    });

    const template = await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: marketer.id,
      slug: "acme-content-marketer",
      category: "Marketing",
      creator: "acme-team",
      responsibilities: ["Weekly blog", "Newsletter ops"],
      skills: ["content-strategy"],
    });
    expect(template.kind).toBe("employee");
    expect(template.slug).toBe("acme-content-marketer");
    expect(template.title).toBeTruthy();
    const employees = template.employees as Array<{ department: string; role: string }>;
    expect(employees).toHaveLength(1);
    expect(employees[0]!.department).toBe("marketing");
    expect((template.skills as string[]).length).toBe(1);

    // Gate: publish single agent → appears in Store listing.
    const listed = await listPublishedTemplates(db);
    expect(listed.find((t) => t.slug === "acme-content-marketer")).toBeTruthy();
  });

  it("infers department from agent role when the role string matches a HireableDepartment", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "A02");
    const [agent] = await db
      .insert(agents)
      .values({ companyId: company.id, name: "Eva", role: "engineering" })
      .returning();

    const template = await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: agent!.id,
      slug: "acme-eva",
      category: "Engineering",
      creator: "acme-team",
    });
    const employees = template.employees as Array<{ department: string }>;
    expect(employees[0]!.department).toBe("engineering");
  });

  it("falls back to 'operations' for unmapped role strings", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "A03");
    const [agent] = await db
      .insert(agents)
      .values({ companyId: company.id, name: "X", role: "strategist" })
      .returning();

    const template = await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: agent!.id,
      slug: "acme-x",
      category: "Business",
      creator: "acme-team",
    });
    const employees = template.employees as Array<{ department: string }>;
    expect(employees[0]!.department).toBe("operations");
  });

  it("honours an explicit department override", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "A04");
    const [agent] = await db
      .insert(agents)
      .values({ companyId: company.id, name: "X", role: "unknown-role" })
      .returning();

    const template = await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: agent!.id,
      slug: "acme-x2",
      category: "Sales",
      creator: "acme-team",
      department: "sales",
    });
    const employees = template.employees as Array<{ department: string }>;
    expect(employees[0]!.department).toBe("sales");
  });

  it("throws when the agent is not in the given company", async () => {
    const db = await freshDatabase();
    const a = await freshCompany(db, "CA1", "Co A");
    const b = await freshCompany(db, "CA2", "Co B");
    const [agentInA] = await db
      .insert(agents)
      .values({ companyId: a.id, name: "A", role: "engineering" })
      .returning();

    await expect(
      publishAgentAsTemplate(db, {
        companyId: b.id,
        agentId: agentInA!.id,
        slug: "wrong-co",
        category: "x",
        creator: "y",
      }),
    ).rejects.toThrow(/not found in company/);
  });

  it("reads the agent's adapterConfig.model when the caller does not override", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "MOD");
    const [agent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
        name: "M",
        role: "engineering",
        adapterConfig: { model: "claude-opus-4-7" },
      })
      .returning();

    const template = await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: agent!.id,
      slug: "acme-m",
      category: "Engineering",
      creator: "acme-team",
    });
    const employees = template.employees as Array<{ model: string }>;
    expect(employees[0]!.model).toBe("claude-opus-4-7");
  });

  it("rejects duplicate slugs via the store_templates unique index", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "DUP");
    const [agent] = await db
      .insert(agents)
      .values({ companyId: company.id, name: "A", role: "engineering" })
      .returning();

    await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: agent!.id,
      slug: "acme-first",
      category: "Engineering",
      creator: "acme-team",
    });
    await expect(
      publishAgentAsTemplate(db, {
        companyId: company.id,
        agentId: agent!.id,
        slug: "acme-first",
        category: "Engineering",
        creator: "acme-team",
      }),
    ).rejects.toThrow();
  });
});

describeEmbeddedPostgres("publishCompanyAsTemplate (A-10)", () => {
  it("bundles every agent in the company as a `business`-kind Store template", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "CO1");
    await seedCompanyAgents(db, { companyId: company.id });
    await hireAgent(db, { companyId: company.id, department: "marketing", name: "Mira" });
    await hireAgent(db, { companyId: company.id, department: "engineering", name: "Eli" });

    const template = await publishCompanyAsTemplate(db, {
      companyId: company.id,
      slug: "acme-full",
      category: "Business",
      creator: "acme-team",
    });
    expect(template.kind).toBe("business");
    const employees = template.employees as Array<{ department: string }>;
    expect(employees.length).toBeGreaterThanOrEqual(3); // CEO + Mira + Eli

    // Gate: bundle entire company → multi-agent template appears.
    const listed = await listPublishedTemplates(db, { kind: "business" });
    expect(listed.find((t) => t.slug === "acme-full")).toBeTruthy();
  });

  it("prefers the CompanyProfile name/description over the Paperclip company row when available", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "PRO", "acme-internal-only");
    await db.insert(companyProfiles).values({ companyId: company.id, name: "Atlas Dynamics", description: "Robotics R&D" });
    await seedCompanyAgents(db, { companyId: company.id });

    const template = await publishCompanyAsTemplate(db, {
      companyId: company.id,
      slug: "atlas-dynamics",
      category: "Robotics",
      creator: "acme-team",
    });
    expect(template.title).toBe("Atlas Dynamics");
    expect(template.summary).toBe("Robotics R&D");
  });

  it("applies per-agent overrides when provided, leaving others at their defaults", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "OVR");
    const { ceo } = await seedCompanyAgents(db, { companyId: company.id });
    const mira = await hireAgent(db, { companyId: company.id, department: "marketing", name: "Mira" });

    const template = await publishCompanyAsTemplate(db, {
      companyId: company.id,
      slug: "acme-overrides",
      category: "Business",
      creator: "acme-team",
      agentOverrides: {
        [mira.id]: { role: "senior-marketer", responsibilities: ["Campaigns", "SEO"] },
      },
    });
    const employees = template.employees as Array<{
      role: string;
      responsibilities: string[];
      schedule: string;
    }>;
    const marketer = employees.find((e) => e.role === "senior-marketer");
    expect(marketer).toBeTruthy();
    expect(marketer!.responsibilities).toEqual(["Campaigns", "SEO"]);
    const ceoEmployee = employees.find((e) => e.role !== "senior-marketer");
    expect(ceoEmployee).toBeTruthy();
    // Unoverridden CEO still uses the default schedule.
    expect(ceoEmployee!.schedule).toBe("on-demand");
    // sanity: ceo was seeded, so its row is findable
    const [ceoRow] = await db.select().from(agents).where(eq(agents.id, ceo.id));
    expect(ceoRow?.id).toBe(ceo.id);
  });

  it("throws when the company has no agents to publish", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "EMP");
    await expect(
      publishCompanyAsTemplate(db, {
        companyId: company.id,
        slug: "empty",
        category: "x",
        creator: "y",
      }),
    ).rejects.toThrow(/has no agents to publish/);
  });

  it("throws when the companyId doesn't exist", async () => {
    const db = await freshDatabase();
    await expect(
      publishCompanyAsTemplate(db, {
        companyId: "00000000-0000-0000-0000-000000000000",
        slug: "missing",
        category: "x",
        creator: "y",
      }),
    ).rejects.toThrow(/company .* not found/);
  });
});

describeEmbeddedPostgres("listPublishedTemplates + getPublishedTemplateBySlug (A-10)", () => {
  it("returns newest-first and filters by kind", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "LST");
    await seedCompanyAgents(db, { companyId: company.id });
    const [agent] = await db
      .insert(agents)
      .values({ companyId: company.id, name: "Solo", role: "engineering" })
      .returning();

    await publishAgentAsTemplate(db, {
      companyId: company.id,
      agentId: agent!.id,
      slug: "solo-1",
      category: "Engineering",
      creator: "acme-team",
    });
    await publishCompanyAsTemplate(db, {
      companyId: company.id,
      slug: "full-1",
      category: "Business",
      creator: "acme-team",
    });

    const employeeOnly = await listPublishedTemplates(db, { kind: "employee" });
    expect(employeeOnly).toHaveLength(1);
    expect(employeeOnly[0]!.slug).toBe("solo-1");
    const businessOnly = await listPublishedTemplates(db, { kind: "business" });
    expect(businessOnly).toHaveLength(1);
    expect(businessOnly[0]!.slug).toBe("full-1");
    const all = await listPublishedTemplates(db);
    expect(all).toHaveLength(2);

    const byslug = await getPublishedTemplateBySlug(db, "solo-1");
    expect(byslug?.id).toBe(employeeOnly[0]!.id);
    expect(await getPublishedTemplateBySlug(db, "does-not-exist")).toBeNull();
  });

  it("confirms the store_templates row is written with the expected jsonb payload shape", async () => {
    const db = await freshDatabase();
    const company = await freshCompany(db, "JSN");
    await seedCompanyAgents(db, { companyId: company.id });
    const template = await publishCompanyAsTemplate(db, {
      companyId: company.id,
      slug: "shape-check",
      category: "Business",
      creator: "acme-team",
      skills: ["a", "b"],
    });
    const [row] = await db
      .select()
      .from(storeTemplates)
      .where(eq(storeTemplates.id, template.id));
    expect(row?.slug).toBe("shape-check");
    expect(Array.isArray(row?.skills)).toBe(true);
    expect(row?.skills).toEqual(["a", "b"]);
    expect(Array.isArray(row?.employees)).toBe(true);
    expect(row?.downloadCount).toBe(0);
  });
});
