import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  appDeployments,
  appFiles,
  apps,
  type Db,
} from "@paperclipai/db";
import type { AppDeploymentRow, AppFileRow, AppRow } from "../schema.js";

/** Fetch an App scoped to its company. Returns null for cross-company lookups. */
export async function getAppForCompany(
  db: Db,
  companyId: string,
  appId: string,
): Promise<AppRow | null> {
  const [row] = await db
    .select()
    .from(apps)
    .where(and(eq(apps.companyId, companyId), eq(apps.id, appId)))
    .limit(1);
  return row ?? null;
}

/** List the flat file-metadata rows for an App (no content — Code-tab index). */
export async function listAppFiles(
  db: Db,
  appId: string,
): Promise<Array<Pick<AppFileRow, "path" | "sizeBytes" | "updatedAt">>> {
  return db
    .select({
      path: appFiles.path,
      sizeBytes: appFiles.sizeBytes,
      updatedAt: appFiles.updatedAt,
    })
    .from(appFiles)
    .where(eq(appFiles.appId, appId))
    .orderBy(asc(appFiles.path));
}

/** Read a single file's content + metadata for the Code tab's code viewer. */
export async function getAppFile(
  db: Db,
  appId: string,
  path: string,
): Promise<AppFileRow | null> {
  const [row] = await db
    .select()
    .from(appFiles)
    .where(and(eq(appFiles.appId, appId), eq(appFiles.path, path)))
    .limit(1);
  return row ?? null;
}

/** Deployment history for the Deployments tab (newest first). */
export async function listAppDeployments(
  db: Db,
  appId: string,
): Promise<AppDeploymentRow[]> {
  return db
    .select()
    .from(appDeployments)
    .where(eq(appDeployments.appId, appId))
    .orderBy(desc(appDeployments.triggeredAt));
}

/** Merge-patch env vars for the Settings tab. Unknown keys are preserved. */
export async function mergeAppEnvVars(
  db: Db,
  appId: string,
  patch: Record<string, string>,
): Promise<Record<string, string>> {
  const [row] = await db.select({ envVars: apps.envVars }).from(apps).where(eq(apps.id, appId)).limit(1);
  if (!row) throw new Error(`app not found: ${appId}`);
  const next: Record<string, string> = { ...(row.envVars as Record<string, string>), ...patch };
  const [updated] = await db
    .update(apps)
    .set({ envVars: next, updatedAt: sql`now()` })
    .where(eq(apps.id, appId))
    .returning({ envVars: apps.envVars });
  return (updated!.envVars as Record<string, string>) ?? {};
}

/** Remove a single env var key from the Settings tab. No-op if the key is absent. */
export async function removeAppEnvVar(
  db: Db,
  appId: string,
  key: string,
): Promise<Record<string, string>> {
  const [row] = await db.select({ envVars: apps.envVars }).from(apps).where(eq(apps.id, appId)).limit(1);
  if (!row) throw new Error(`app not found: ${appId}`);
  const current = { ...(row.envVars as Record<string, string>) };
  delete current[key];
  const [updated] = await db
    .update(apps)
    .set({ envVars: current, updatedAt: sql`now()` })
    .where(eq(apps.id, appId))
    .returning({ envVars: apps.envVars });
  return (updated!.envVars as Record<string, string>) ?? {};
}
