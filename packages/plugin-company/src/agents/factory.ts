import { and, eq } from "drizzle-orm";
import { agents, type Db } from "@paperclipai/db";
import {
  DEFAULT_DEPARTMENT_TITLES,
  DEFAULT_SYSTEM_PROMPTS,
  type HireableDepartment,
  isHireableDepartment,
} from "./prompts.js";

export type Agent = typeof agents.$inferSelect;

export const CEO_DEFAULT_NAME = "Naive";

export interface SeedCompanyAgentsInput {
  companyId: string;
  /** Override the CEO display name. Defaults to "Naive". */
  ceoName?: string;
}

export interface HireAgentInput {
  companyId: string;
  department: HireableDepartment;
  name: string;
  /**
   * Agent id the new hire should report to. Defaults to the company's CEO.
   * Pass `null` explicitly to create a top-level agent that reports to nobody.
   */
  reportsTo?: string | null;
}

/**
 * Seed the default CEO agent ("Naive") for a company. Called on company
 * creation. Idempotent: re-invoking returns the existing CEO instead of
 * creating a duplicate.
 */
export async function seedCompanyAgents(
  db: Db,
  input: SeedCompanyAgentsInput,
): Promise<{ ceo: Agent }> {
  const existing = await findCeo(db, input.companyId);
  if (existing) {
    return { ceo: existing };
  }

  const name = input.ceoName ?? CEO_DEFAULT_NAME;
  const [ceo] = await db
    .insert(agents)
    .values({
      companyId: input.companyId,
      name,
      role: "ceo",
      title: DEFAULT_DEPARTMENT_TITLES.ceo,
      runtimeConfig: { systemPrompt: DEFAULT_SYSTEM_PROMPTS.ceo },
    })
    .returning();

  return { ceo };
}

/**
 * Hire a department agent. Defaults `reportsTo` to the company's CEO, so the
 * typical call site is `hireAgent(db, { companyId, department: "marketing", name: "..." })`.
 */
export async function hireAgent(db: Db, input: HireAgentInput): Promise<Agent> {
  if (!isHireableDepartment(input.department)) {
    throw new Error(`department "${input.department}" is not hireable`);
  }

  let reportsTo: string | null;
  if (input.reportsTo === undefined) {
    const ceo = await findCeo(db, input.companyId);
    if (!ceo) {
      throw new Error(
        `cannot hire into company ${input.companyId}: no CEO seeded (call seedCompanyAgents first)`,
      );
    }
    reportsTo = ceo.id;
  } else {
    reportsTo = input.reportsTo;
  }

  const [row] = await db
    .insert(agents)
    .values({
      companyId: input.companyId,
      name: input.name,
      role: input.department,
      title: DEFAULT_DEPARTMENT_TITLES[input.department],
      reportsTo,
      runtimeConfig: { systemPrompt: DEFAULT_SYSTEM_PROMPTS[input.department] },
    })
    .returning();

  return row;
}

/** Return the company's CEO agent, if any has been seeded. */
export async function findCeo(db: Db, companyId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.role, "ceo")))
    .limit(1);
  return row ?? null;
}

/** List all agents that report directly to the given agent. */
export async function listDirectReports(db: Db, managerAgentId: string): Promise<Agent[]> {
  return db.select().from(agents).where(eq(agents.reportsTo, managerAgentId));
}
