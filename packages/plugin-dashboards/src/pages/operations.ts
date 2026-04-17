import { and, desc, eq, sql } from "drizzle-orm";
import { type Db, dashboardPages } from "@paperclipai/db";
import type { DashboardLayout, DashboardPage } from "../schema.js";

export interface CreateDashboardPageInput {
  readonly companyId: string;
  readonly title: string;
  readonly layout: DashboardLayout;
}

export interface UpdateDashboardPageInput {
  readonly companyId: string;
  readonly pageId: string;
  readonly title?: string;
  readonly layout?: DashboardLayout;
}

export async function createDashboardPage(
  db: Db,
  input: CreateDashboardPageInput,
): Promise<DashboardPage> {
  const [row] = await db
    .insert(dashboardPages)
    .values({
      companyId: input.companyId,
      title: input.title,
      layout: input.layout as unknown as Record<string, unknown>,
    })
    .returning();
  return row!;
}

export async function listDashboardPages(
  db: Db,
  companyId: string,
): Promise<DashboardPage[]> {
  return db
    .select()
    .from(dashboardPages)
    .where(eq(dashboardPages.companyId, companyId))
    .orderBy(desc(dashboardPages.createdAt), desc(dashboardPages.id));
}

export async function getDashboardPage(
  db: Db,
  input: { companyId: string; pageId: string },
): Promise<DashboardPage | null> {
  const [row] = await db
    .select()
    .from(dashboardPages)
    .where(
      and(eq(dashboardPages.companyId, input.companyId), eq(dashboardPages.id, input.pageId)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Update a dashboard page. Only non-undefined fields are written. Returns
 * null when the page doesn't exist for the given company (404-able by the
 * caller without a second SELECT).
 */
export async function updateDashboardPage(
  db: Db,
  input: UpdateDashboardPageInput,
): Promise<DashboardPage | null> {
  const patch: Record<string, unknown> = { updatedAt: sql`now()` };
  if (input.title !== undefined) patch.title = input.title;
  if (input.layout !== undefined) patch.layout = input.layout;

  const [row] = await db
    .update(dashboardPages)
    .set(patch)
    .where(
      and(eq(dashboardPages.companyId, input.companyId), eq(dashboardPages.id, input.pageId)),
    )
    .returning();
  return row ?? null;
}

export async function deleteDashboardPage(
  db: Db,
  input: { companyId: string; pageId: string },
): Promise<boolean> {
  const deleted = await db
    .delete(dashboardPages)
    .where(
      and(eq(dashboardPages.companyId, input.companyId), eq(dashboardPages.id, input.pageId)),
    )
    .returning({ id: dashboardPages.id });
  return deleted.length > 0;
}
