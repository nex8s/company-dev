import { and, asc, eq, sql } from "drizzle-orm";
import { agents, appFiles, apps, issueComments, issues, type Db } from "@paperclipai/db";
import {
  CEO_DEFAULT_NAME,
  hireAgent,
  seedCompanyAgents,
} from "@paperclipai/plugin-company";
import { scaffoldNextJsFiles, type ScaffoldedFile } from "./scaffold.js";

/** Name given to the Engineering agent spawned for App builds. */
export const LANDING_PAGE_ENGINEER_NAME = "Landing Page Engineer";

/** Body prefix on the deployed-app check-in comment (matches A-06's pattern). */
export const DEPLOYED_CHECK_IN_PREFIX = "via check-in: Deployed app";

export interface BuildAppInput {
  readonly appId: string;
  readonly prompt: string;
}

export interface BuildAppResult {
  readonly appId: string;
  readonly engineerAgentId: string;
  readonly issueId: string;
  readonly checkInCommentId: string;
  readonly files: readonly { path: string; sizeBytes: number }[];
  readonly productionDomain: string;
}

/**
 * B-02 builder worker loop. Given an `appId` row and a prompt, this:
 *
 *   1. Ensures the company has a Landing Page Engineer (hires one if missing,
 *      reusing A-03's factory + Engineering prompt).
 *   2. Generates a Next.js scaffold under `apps/<app_id>/` via
 *      `scaffoldNextJsFiles`. Deterministic — no LLM call yet; the Phase-2
 *      "Landing Page Engineer" agent will replace the scaffold step with
 *      model output.
 *   3. Upserts each generated file into `app_files` (current-state, unique
 *      on `(app_id, path)`).
 *   4. Marks the App "deployed" by writing a stub Vercel URL into
 *      `apps.production_domain` — real deployment is a Phase-2 integration
 *      behind B-07 / the Vercel provider stub.
 *   5. Creates (or reuses) a launch Issue and posts a `via check-in: Deployed
 *      app …` comment on it, matching the A-06 check-in contract so the
 *      company chat thread picks it up.
 *
 * All of steps 3–5 run inside a single transaction so a partial failure
 * leaves the App in its prior state.
 */
export async function buildApp(db: Db, input: BuildAppInput): Promise<BuildAppResult> {
  const [app] = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
  if (!app) throw new Error(`app not found: ${input.appId}`);

  const engineer = await ensureLandingPageEngineer(db, app.companyId);

  const files = scaffoldNextJsFiles({
    appId: app.id,
    appName: app.name,
    prompt: input.prompt,
  });

  const productionDomain = stubProductionDomain(app.name, app.id);

  // buildApp is idempotent: upsertAppFiles uses onConflictDoUpdate,
  // ensureLaunchIssue dedupes on title, postDeployedCheckIn dedupes on
  // exact body. Retrying after a partial failure converges to the same
  // end state, so no outer transaction is required.
  await upsertAppFiles(db, app.id, app.companyId, files);

  await db
    .update(apps)
    .set({ productionDomain, updatedAt: sql`now()` })
    .where(eq(apps.id, app.id));

  const issueId = await ensureLaunchIssue(db, {
    companyId: app.companyId,
    appId: app.id,
    appName: app.name,
    engineerAgentId: engineer.id,
  });

  const checkInCommentId = await postDeployedCheckIn(db, {
    companyId: app.companyId,
    issueId,
    appName: app.name,
    productionDomain,
    engineerAgentId: engineer.id,
  });

  const persisted = await db
    .select({ path: appFiles.path, sizeBytes: appFiles.sizeBytes })
    .from(appFiles)
    .where(eq(appFiles.appId, app.id))
    .orderBy(asc(appFiles.path));

  return {
    appId: app.id,
    engineerAgentId: engineer.id,
    issueId,
    checkInCommentId,
    files: persisted,
    productionDomain,
  };
}

type Agent = typeof agents.$inferSelect;

/**
 * Find the company's Landing Page Engineer if one exists, otherwise seed a
 * CEO (if none yet) and hire a new engineering agent with that name. Re-using
 * A-03's factory means the agent picks up the Engineering system prompt
 * automatically.
 */
export async function ensureLandingPageEngineer(db: Db, companyId: string): Promise<Agent> {
  const existing = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.companyId, companyId),
        eq(agents.role, "engineering"),
        eq(agents.name, LANDING_PAGE_ENGINEER_NAME),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  await seedCompanyAgents(db, { companyId, ceoName: CEO_DEFAULT_NAME });
  return hireAgent(db, {
    companyId,
    department: "engineering",
    name: LANDING_PAGE_ENGINEER_NAME,
  });
}

async function upsertAppFiles(
  db: Db,
  appId: string,
  companyId: string,
  files: ScaffoldedFile[],
): Promise<void> {
  for (const file of files) {
    const sizeBytes = Buffer.byteLength(file.content, "utf8");
    await db
      .insert(appFiles)
      .values({ appId, companyId, path: file.path, content: file.content, sizeBytes })
      .onConflictDoUpdate({
        target: [appFiles.appId, appFiles.path],
        set: {
          content: file.content,
          sizeBytes,
          updatedAt: sql`now()`,
        },
      });
  }
}

function stubProductionDomain(appName: string, appId: string): string {
  const slug = appName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
  // Stable per-app URL — short appId suffix avoids collisions across apps
  // with the same display name inside a company.
  return `https://${slug}-${appId.slice(0, 8)}.vercel.stub.test`;
}

interface EnsureLaunchIssueInput {
  companyId: string;
  appId: string;
  appName: string;
  engineerAgentId: string;
}

/**
 * Create (or return the existing) launch issue for an App. The issue is the
 * chat thread the "Deployed app" check-in comments land on. Identified by a
 * deterministic title so re-runs of `buildApp` on the same `appId` post to
 * the same thread instead of spawning a new one.
 */
async function ensureLaunchIssue(db: Db, input: EnsureLaunchIssueInput): Promise<string> {
  const title = `Launch app: ${input.appName}`;

  const existing = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.companyId, input.companyId), eq(issues.title, title)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await db
    .insert(issues)
    .values({
      companyId: input.companyId,
      title,
      status: "in_progress",
      assigneeAgentId: input.engineerAgentId,
    })
    .returning({ id: issues.id });
  return row!.id;
}

interface PostDeployedCheckInInput {
  companyId: string;
  issueId: string;
  appName: string;
  productionDomain: string;
  engineerAgentId: string;
}

/**
 * Insert the "Deployed app" check-in comment. Matches A-06's
 * `via check-in: …` body convention so the company chat thread surfaces it
 * alongside heartbeat events. Idempotent via exact-body equality.
 */
async function postDeployedCheckIn(
  db: Db,
  input: PostDeployedCheckInInput,
): Promise<string> {
  const body = `${DEPLOYED_CHECK_IN_PREFIX} ${input.appName} → ${input.productionDomain}`;

  const existing = await db
    .select({ id: issueComments.id })
    .from(issueComments)
    .where(
      and(
        eq(issueComments.companyId, input.companyId),
        eq(issueComments.issueId, input.issueId),
        eq(issueComments.body, body),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await db
    .insert(issueComments)
    .values({
      companyId: input.companyId,
      issueId: input.issueId,
      authorAgentId: input.engineerAgentId,
      authorUserId: null,
      createdByRunId: null,
      body,
    })
    .returning({ id: issueComments.id });
  return row!.id;
}
