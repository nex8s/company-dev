import { and, desc, eq } from "drizzle-orm";
import { type Db, agents, companies, companyProfiles } from "@paperclipai/db";
import { storeTemplates, type StoreTemplateRow } from "@paperclipai/plugin-store";
import { DEFAULT_DEPARTMENT_TITLES, type HireableDepartment, isHireableDepartment } from "../agents/prompts.js";

/**
 * @paperclipai/plugin-company — Publishing → Store bridge (A-10).
 *
 * Writes new rows into the `store_templates` table owned by plugin-store.
 * A-10 intentionally owns the WRITE path end-to-end; B-06 will layer HTTP
 * listing + filters on top. Both tasks share the same table + payload
 * shape, so there's no coordination-at-merge required.
 */

/** Subset of TemplateEmployee used in store_templates.employees jsonb. */
export interface PublishedEmployee {
  readonly role: string;
  readonly department: HireableDepartment;
  readonly model: string;
  readonly schedule: string;
  readonly responsibilities: readonly string[];
}

export interface PublishAgentInput {
  readonly companyId: string;
  readonly agentId: string;
  /** URL-safe unique slug for the template (e.g. "acme-lead-engineer"). */
  readonly slug: string;
  /** Store category (e.g. "Engineering", "Sales"). */
  readonly category: string;
  /** Creator handle/name shown in the Store listing. */
  readonly creator: string;
  /** Optional overrides if the agent row doesn't carry the info directly. */
  readonly summary?: string;
  readonly title?: string;
  readonly model?: string;
  readonly schedule?: string;
  readonly responsibilities?: readonly string[];
  readonly skills?: readonly string[];
  /**
   * Explicit department override. If omitted, the agent's `role` is matched
   * against the HireableDepartment enum; falls back to "operations".
   */
  readonly department?: HireableDepartment;
}

export interface PublishCompanyInput {
  readonly companyId: string;
  readonly slug: string;
  readonly category: string;
  readonly creator: string;
  readonly summary?: string;
  readonly title?: string;
  /** Shared skills across the whole template. Defaults to []. */
  readonly skills?: readonly string[];
  /**
   * Per-agent overrides when the company's `agents` rows need enrichment
   * (e.g. responsibilities aren't stored on the agent itself). Keyed by
   * agentId. A missing agentId uses defaults.
   */
  readonly agentOverrides?: Readonly<
    Record<
      string,
      Partial<Pick<PublishedEmployee, "role" | "department" | "model" | "schedule" | "responsibilities">>
    >
  >;
}

/**
 * Publish a single agent as an `employee`-kind Store template. Reads the
 * agent + company rows, shapes the template, and inserts into
 * `store_templates`. Returns the inserted row.
 *
 * Throws when the agent doesn't exist in the given company or when the slug
 * is already taken (unique index).
 */
export async function publishAgentAsTemplate(
  db: Db,
  input: PublishAgentInput,
): Promise<StoreTemplateRow> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.companyId, input.companyId)))
    .limit(1);
  if (!agent) {
    throw new Error(`publishAgentAsTemplate: agent ${input.agentId} not found in company ${input.companyId}`);
  }

  const department = input.department ?? inferDepartment(agent.role);
  const employee: PublishedEmployee = {
    role: agent.role,
    department,
    model: input.model ?? readAdapterModel(agent.adapterConfig) ?? "claude-sonnet",
    schedule: input.schedule ?? "on-demand",
    responsibilities: input.responsibilities ?? [],
  };

  const title = input.title ?? agent.title ?? agent.name;
  const summary = input.summary ?? `${title} — ${DEFAULT_DEPARTMENT_TITLES[department]}`;

  const [row] = await db
    .insert(storeTemplates)
    .values({
      slug: input.slug,
      kind: "employee",
      title,
      category: input.category,
      summary,
      skills: input.skills ? Array.from(input.skills) : [],
      employees: [employee],
      creator: input.creator,
    })
    .returning();
  return row!;
}

/**
 * Bundle the entire company as a `business`-kind Store template — one
 * employee per row in `agents`. Reads the company profile (if present) for
 * title/summary defaults.
 */
export async function publishCompanyAsTemplate(
  db: Db,
  input: PublishCompanyInput,
): Promise<StoreTemplateRow> {
  const [company] = await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) {
    throw new Error(`publishCompanyAsTemplate: company ${input.companyId} not found`);
  }
  const [profile] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.companyId, input.companyId))
    .limit(1);

  const companyAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.companyId, input.companyId))
    .orderBy(desc(agents.createdAt), desc(agents.id));

  if (companyAgents.length === 0) {
    throw new Error(`publishCompanyAsTemplate: company ${input.companyId} has no agents to publish`);
  }

  const employees = companyAgents.map<PublishedEmployee>((agent) => {
    const override = input.agentOverrides?.[agent.id] ?? {};
    const department = override.department ?? inferDepartment(agent.role);
    return {
      role: override.role ?? agent.role,
      department,
      model: override.model ?? readAdapterModel(agent.adapterConfig) ?? "claude-sonnet",
      schedule: override.schedule ?? "on-demand",
      responsibilities: override.responsibilities ?? [],
    };
  });

  const title = input.title ?? profile?.name ?? company.name;
  const summary = input.summary ?? profile?.description ?? `${title} — packaged company template`;

  const [row] = await db
    .insert(storeTemplates)
    .values({
      slug: input.slug,
      kind: "business",
      title,
      category: input.category,
      summary,
      skills: input.skills ? Array.from(input.skills) : [],
      employees,
      creator: input.creator,
    })
    .returning();
  return row!;
}

/**
 * Minimal read path used by the A-10 gate to verify publish round-trips.
 * B-06 will ship the full listing surface (filters, pagination, category
 * facets) — this is intentionally scoped to what the gate needs.
 */
export async function listPublishedTemplates(
  db: Db,
  opts: { kind?: "employee" | "business" } = {},
): Promise<StoreTemplateRow[]> {
  const predicates = opts.kind ? [eq(storeTemplates.kind, opts.kind)] : [];
  const q = db.select().from(storeTemplates);
  if (predicates.length === 0) {
    return q.orderBy(desc(storeTemplates.createdAt), desc(storeTemplates.id));
  }
  return q
    .where(predicates.length === 1 ? predicates[0]! : and(...predicates))
    .orderBy(desc(storeTemplates.createdAt), desc(storeTemplates.id));
}

/** Look up a single template by slug (test helper + cross-agent contract). */
export async function getPublishedTemplateBySlug(
  db: Db,
  slug: string,
): Promise<StoreTemplateRow | null> {
  const [row] = await db.select().from(storeTemplates).where(eq(storeTemplates.slug, slug)).limit(1);
  return row ?? null;
}

function inferDepartment(role: string): HireableDepartment {
  const normalized = role.toLowerCase().trim();
  if (isHireableDepartment(normalized)) return normalized;
  // Fallbacks for common role names that don't match the enum directly.
  if (/engineer|developer|swe|dev\b/.test(normalized)) return "engineering";
  if (/market|content|growth/.test(normalized)) return "marketing";
  if (/sales|account|bd|prospect/.test(normalized)) return "sales";
  if (/support|success|cx/.test(normalized)) return "support";
  return "operations";
}

function readAdapterModel(config: Record<string, unknown> | null | undefined): string | null {
  if (!config) return null;
  const model = config.model;
  return typeof model === "string" && model.length > 0 ? model : null;
}
