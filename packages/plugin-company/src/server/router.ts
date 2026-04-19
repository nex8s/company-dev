import { Router, type Request } from "express";
import { eq, sql } from "drizzle-orm";
import { type Db, companyProfiles } from "@paperclipai/db";
import {
  companyIdParamSchema,
  decideReviewBodySchema,
  listPublishedTemplatesQuerySchema,
  patchCompanyProfileBodySchema,
  publishAgentBodySchema,
  publishAgentParamSchema,
  publishCompanyBodySchema,
  reviewIdParamSchema,
  stepIdParamSchema,
  upsertCompanyProfileBodySchema,
} from "./schemas.js";
import { completeStep, getChecklist } from "../getting-started/checklist.js";
import { approveReview, listPendingReviews, rejectReview } from "../reviews/queue.js";
import { seedCompanyAgents, hireAgent, findCeo, listDirectReports } from "../agents/factory.js";
import { HIREABLE_DEPARTMENTS } from "../agents/prompts.js";
import {
  resolveServerPanel,
  type ServerPanelResolverConfig,
  type ServerPanelResolverDeps,
} from "../server-panel/resolver.js";
import {
  listPublishedTemplates,
  publishAgentAsTemplate,
  publishCompanyAsTemplate,
} from "../store-publishing/publisher.js";
import type { z, ZodError } from "zod";

/**
 * Per-request actor metadata the router needs in order to attribute review
 * decisions. Mirrors the shape returned by the server's `getActorInfo` helper
 * but is passed in via deps so plugin-company stays decoupled from
 * `server/src/routes/authz.ts`.
 */
export interface PluginCompanyActorInfo {
  readonly actorType: "agent" | "user";
  readonly actorId: string;
  readonly agentId: string | null;
  readonly runId: string | null;
}

export interface PluginCompanyRouterDeps {
  readonly db: Db;
  /**
   * Authorize the request for the given companyId. Implementations should
   * throw an HTTP-shaped error (e.g. via `assertCompanyAccess`) when access
   * is denied; the router does not catch — it lets the host's error handler
   * translate to 401/403.
   */
  readonly authorizeCompanyAccess: (req: Request, companyId: string) => void;
  /** Resolve the calling actor (agent vs user) from the request. */
  readonly resolveActorInfo: (req: Request) => PluginCompanyActorInfo;
  /**
   * Config for the A-09 Server panel resolver. Optional — if omitted, the
   * resolver defaults to reading from `process.env` (FLY_APP_NAME,
   * FLY_API_TOKEN, FLY_MACHINE_ID). Tests inject this directly.
   */
  readonly serverPanelConfig?: () => ServerPanelResolverConfig;
  /** Optional deps override for the Server panel resolver (test injection). */
  readonly serverPanelDeps?: ServerPanelResolverDeps;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function parseParams<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }
  return parsed.data;
}

function parseBody<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }
  return parsed.data;
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`)
    .join("; ");
}

/**
 * Build the plugin-company HTTP router. All paths are absolute under the
 * server's `/api` mount: e.g. `GET /api/companies/:companyId/plugin-company/checklist`.
 *
 * Error shape: thrown `HttpError` is converted to `{ error: string }` with the
 * matching status. Anything else propagates to Express' default handler so the
 * server's middleware pipeline can log + format it consistently with the rest
 * of the API.
 */
export function createPluginCompanyRouter(deps: PluginCompanyRouterDeps): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // Getting Started checklist
  // -------------------------------------------------------------------------

  router.get(
    "/companies/:companyId/plugin-company/checklist",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const checklist = await getChecklist(deps.db, companyId);
      res.json(checklist);
    }),
  );

  router.post(
    "/companies/:companyId/plugin-company/checklist/:stepId/complete",
    asyncHandler(async (req, res) => {
      const { companyId, stepId } = parseParams(stepIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const checklist = await completeStep(deps.db, companyId, stepId);
      res.json(checklist);
    }),
  );

  // -------------------------------------------------------------------------
  // Pending review queue
  // -------------------------------------------------------------------------

  router.get(
    "/companies/:companyId/plugin-company/reviews/pending",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const reviews = await listPendingReviews(deps.db, companyId);
      res.json({ reviews });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-company/reviews/:reviewId/approve",
    asyncHandler(async (req, res) => {
      const { companyId, reviewId } = parseParams(reviewIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(decideReviewBodySchema, req.body ?? {});
      const actor = deps.resolveActorInfo(req);
      try {
        const review = await approveReview(deps.db, {
          reviewId,
          decidedByAgentId: actor.actorType === "agent" ? actor.agentId : null,
          decidedByUserId: actor.actorType === "user" ? actor.actorId : null,
          decisionNote: body.decisionNote ?? null,
        });
        res.json({ review });
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found or already decided")) {
          throw new HttpError(409, err.message);
        }
        throw err;
      }
    }),
  );

  router.post(
    "/companies/:companyId/plugin-company/reviews/:reviewId/reject",
    asyncHandler(async (req, res) => {
      const { companyId, reviewId } = parseParams(reviewIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(decideReviewBodySchema, req.body ?? {});
      const actor = deps.resolveActorInfo(req);
      try {
        const review = await rejectReview(deps.db, {
          reviewId,
          decidedByAgentId: actor.actorType === "agent" ? actor.agentId : null,
          decidedByUserId: actor.actorType === "user" ? actor.actorId : null,
          decisionNote: body.decisionNote ?? null,
        });
        res.json({ review });
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found or already decided")) {
          throw new HttpError(409, err.message);
        }
        throw err;
      }
    }),
  );

  // -------------------------------------------------------------------------
  // CompanyProfile CRUD
  // -------------------------------------------------------------------------

  router.get(
    "/companies/:companyId/plugin-company/profile",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const [row] = await deps.db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.companyId, companyId))
        .limit(1);
      if (!row) throw new HttpError(404, "company profile not found");
      res.json({ profile: row });
    }),
  );

  router.put(
    "/companies/:companyId/plugin-company/profile",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(upsertCompanyProfileBodySchema, req.body ?? {});

      const [row] = await deps.db
        .insert(companyProfiles)
        .values({
          companyId,
          name: body.name,
          description: body.description ?? null,
          positioning: body.positioning ?? null,
          targetAudience: body.targetAudience ?? null,
          strategyText: body.strategyText ?? null,
          incorporated: body.incorporated ?? false,
          logoUrl: body.logoUrl ?? null,
          ...(body.trialState ? { trialState: body.trialState } : {}),
        })
        .onConflictDoUpdate({
          target: companyProfiles.companyId,
          set: {
            name: body.name,
            description: body.description ?? null,
            positioning: body.positioning ?? null,
            targetAudience: body.targetAudience ?? null,
            strategyText: body.strategyText ?? null,
            incorporated: body.incorporated ?? false,
            logoUrl: body.logoUrl ?? null,
            ...(body.trialState ? { trialState: body.trialState } : {}),
            updatedAt: sql`now()`,
          },
        })
        .returning();
      res.status(200).json({ profile: row });
    }),
  );

  router.patch(
    "/companies/:companyId/plugin-company/profile",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(patchCompanyProfileBodySchema, req.body ?? {});

      const patch: Record<string, unknown> = { updatedAt: sql`now()` };
      if (body.name !== undefined) patch.name = body.name;
      if (body.description !== undefined) patch.description = body.description;
      if (body.positioning !== undefined) patch.positioning = body.positioning;
      if (body.targetAudience !== undefined) patch.targetAudience = body.targetAudience;
      if (body.strategyText !== undefined) patch.strategyText = body.strategyText;
      if (body.incorporated !== undefined) patch.incorporated = body.incorporated;
      if (body.logoUrl !== undefined) patch.logoUrl = body.logoUrl;
      if (body.trialState !== undefined) patch.trialState = body.trialState;

      const [row] = await deps.db
        .update(companyProfiles)
        .set(patch)
        .where(eq(companyProfiles.companyId, companyId))
        .returning();
      if (!row) throw new HttpError(404, "company profile not found");
      res.json({ profile: row });
    }),
  );

  router.delete(
    "/companies/:companyId/plugin-company/profile",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const deleted = await deps.db
        .delete(companyProfiles)
        .where(eq(companyProfiles.companyId, companyId))
        .returning({ id: companyProfiles.id });
      if (deleted.length === 0) throw new HttpError(404, "company profile not found");
      res.status(204).send();
    }),
  );

  // -------------------------------------------------------------------------
  // A-09 Server panel — Fly machine metadata (or local-dev stub).
  // -------------------------------------------------------------------------

  router.get(
    "/companies/:companyId/plugin-company/server-panel",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const config = deps.serverPanelConfig
        ? deps.serverPanelConfig()
        : {
            flyAppName: process.env.FLY_APP_NAME ?? null,
            flyApiToken: process.env.FLY_API_TOKEN ?? null,
            flyMachineId: process.env.FLY_MACHINE_ID ?? null,
          };
      const data = await resolveServerPanel(config, deps.serverPanelDeps);
      res.json({ serverPanel: data });
    }),
  );

  // -------------------------------------------------------------------------
  // A-10 Publishing → Store bridge.
  // -------------------------------------------------------------------------

  router.post(
    "/companies/:companyId/plugin-company/agents/:agentId/publish",
    asyncHandler(async (req, res) => {
      const { companyId, agentId } = parseParams(publishAgentParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(publishAgentBodySchema, req.body ?? {});
      try {
        const template = await publishAgentAsTemplate(deps.db, {
          companyId,
          agentId,
          slug: body.slug,
          category: body.category,
          creator: body.creator,
          summary: body.summary,
          title: body.title,
          model: body.model,
          schedule: body.schedule,
          responsibilities: body.responsibilities,
          skills: body.skills,
          department: body.department,
        });
        res.status(201).json({ template });
      } catch (err) {
        throw mapPublishError(err);
      }
    }),
  );

  router.post(
    "/companies/:companyId/plugin-company/publish",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(publishCompanyBodySchema, req.body ?? {});
      try {
        const template = await publishCompanyAsTemplate(deps.db, {
          companyId,
          slug: body.slug,
          category: body.category,
          creator: body.creator,
          summary: body.summary,
          title: body.title,
          skills: body.skills,
          agentOverrides: body.agentOverrides,
        });
        res.status(201).json({ template });
      } catch (err) {
        throw mapPublishError(err);
      }
    }),
  );

  router.get(
    "/companies/:companyId/plugin-company/store/templates",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const query = parseBody(listPublishedTemplatesQuerySchema, req.query ?? {});
      const templates = await listPublishedTemplates(deps.db, { kind: query.kind });
      res.json({ templates });
    }),
  );

  // -------------------------------------------------------------------------
  // Agent seeding + hiring (A-03)
  // -------------------------------------------------------------------------

  router.post(
    "/companies/:companyId/plugin-company/seed-agents",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const result = await seedCompanyAgents(deps.db, { companyId });
      res.json(result);
    }),
  );

  router.post(
    "/companies/:companyId/plugin-company/hire",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const { department, name } = req.body as { department: string; name?: string };
      if (!department || !HIREABLE_DEPARTMENTS.includes(department as any)) {
        res.status(400).json({ error: `department must be one of: ${HIREABLE_DEPARTMENTS.join(", ")}` });
        return;
      }
      const agentName = name || `${department.charAt(0).toUpperCase() + department.slice(1)} Agent`;
      try {
        const agent = await hireAgent(deps.db, { companyId, department: department as any, name: agentName });
        res.json(agent);
      } catch (hireErr: any) {
        console.error("[plugin-company] hireAgent failed:", hireErr);
        res.status(500).json({ error: hireErr.message || "Failed to hire agent" });
      }
    }),
  );

  router.get(
    "/companies/:companyId/plugin-company/team",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const ceo = await findCeo(deps.db, companyId);
      const reports = ceo ? await listDirectReports(deps.db, companyId) : [];
      res.json({ ceo, reports });
    }),
  );

  router.use((err: unknown, _req: Request, res: import("express").Response, next: import("express").NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  });

  return router;
}

type AsyncHandler = (
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) => Promise<unknown>;

/**
 * Translate errors from the publisher into HTTP-appropriate `HttpError`s:
 * - "agent ... not found" → 404
 * - "company ... has no agents to publish" → 409 (conflict on state)
 * - slug uniqueness violation (Postgres 23505) → 409
 * - anything else → rethrown unchanged for the default 500 path.
 */
function mapPublishError(err: unknown): unknown {
  if (err instanceof Error) {
    if (/agent .* not found/i.test(err.message)) return new HttpError(404, err.message);
    if (/has no agents to publish/i.test(err.message)) return new HttpError(409, err.message);
    const code = (err as { code?: string }).code;
    if (code === "23505" || /duplicate key|unique/i.test(err.message)) {
      return new HttpError(409, "store template slug already exists");
    }
  }
  return err;
}

function asyncHandler(fn: AsyncHandler) {
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
