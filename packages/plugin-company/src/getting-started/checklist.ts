import { eq, sql } from "drizzle-orm";
import {
  type Db,
  gettingStarted,
  type GettingStartedStepsJson,
} from "@paperclipai/db";
import {
  GETTING_STARTED_STEPS,
  GETTING_STARTED_TITLES,
  GETTING_STARTED_TOTAL,
  type GettingStartedStep,
  isGettingStartedStep,
} from "./steps.js";

export interface ChecklistStep {
  readonly key: GettingStartedStep;
  readonly title: string;
  readonly completedAt: Date | null;
}

export interface Checklist {
  readonly companyId: string;
  readonly completed: number;
  readonly total: number;
  readonly steps: readonly ChecklistStep[];
}

function parseCompletedAt(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function materialize(companyId: string, raw: GettingStartedStepsJson | null): Checklist {
  const steps = GETTING_STARTED_STEPS.map<ChecklistStep>((key) => {
    const entry = raw?.[key];
    return {
      key,
      title: GETTING_STARTED_TITLES[key],
      completedAt: entry ? parseCompletedAt(entry.completedAt) : null,
    };
  });
  const completed = steps.reduce((acc, step) => acc + (step.completedAt ? 1 : 0), 0);
  return { companyId, completed, total: GETTING_STARTED_TOTAL, steps };
}

/**
 * Return the checklist for a company. Lazily creates the row on first read
 * so callers never need a separate "initialize" step.
 */
export async function getChecklist(db: Db, companyId: string): Promise<Checklist> {
  const [existing] = await db
    .select()
    .from(gettingStarted)
    .where(eq(gettingStarted.companyId, companyId))
    .limit(1);

  if (existing) {
    return materialize(companyId, existing.steps);
  }

  const [created] = await db
    .insert(gettingStarted)
    .values({ companyId, steps: {} })
    .onConflictDoNothing({ target: gettingStarted.companyId })
    .returning();

  if (created) {
    return materialize(companyId, created.steps);
  }

  const [refetch] = await db
    .select()
    .from(gettingStarted)
    .where(eq(gettingStarted.companyId, companyId))
    .limit(1);
  return materialize(companyId, refetch?.steps ?? {});
}

function assertStep(step: string): GettingStartedStep {
  if (!isGettingStartedStep(step)) {
    throw new Error(
      `unknown Getting Started step "${step}"; expected one of ${GETTING_STARTED_STEPS.join(", ")}`,
    );
  }
  return step;
}

async function upsertSteps(
  db: Db,
  companyId: string,
  mutator: (current: GettingStartedStepsJson) => GettingStartedStepsJson,
): Promise<Checklist> {
  await getChecklist(db, companyId);

  const [row] = await db
    .select()
    .from(gettingStarted)
    .where(eq(gettingStarted.companyId, companyId))
    .limit(1);
  const current = row?.steps ?? {};
  const next = mutator(current);

  const [updated] = await db
    .update(gettingStarted)
    .set({ steps: next, updatedAt: sql`now()` })
    .where(eq(gettingStarted.companyId, companyId))
    .returning();

  return materialize(companyId, updated?.steps ?? next);
}

/**
 * Mark a step completed. Completion time is recorded on first complete;
 * subsequent calls are no-ops (returns the existing state without bumping
 * completedAt).
 */
export async function completeStep(
  db: Db,
  companyId: string,
  step: GettingStartedStep | string,
): Promise<Checklist> {
  const key = assertStep(step);
  return upsertSteps(db, companyId, (current) => {
    if (current[key]?.completedAt) return current;
    return { ...current, [key]: { completedAt: new Date().toISOString() } };
  });
}

/** Mark a step not-completed again (primarily for support / testing). */
export async function resetStep(
  db: Db,
  companyId: string,
  step: GettingStartedStep | string,
): Promise<Checklist> {
  const key = assertStep(step);
  return upsertSteps(db, companyId, (current) => {
    if (!current[key]) return current;
    const { [key]: _removed, ...rest } = current;
    return rest;
  });
}
