import { Router, type Request } from "express";
import { eq, sql } from "drizzle-orm";
import { type Db, companyProfiles } from "@paperclipai/db";
import {
  companyIdParamSchema,
  decideReviewBodySchema,
  patchCompanyProfileBodySchema,
  reviewIdParamSchema,
  stepIdParamSchema,
  upsertCompanyProfileBodySchema,
} from "./schemas.js";
import { completeStep, getChecklist } from "../getting-started/checklist.js";
import { approveReview, listPendingReviews, rejectReview } from "../reviews/queue.js";
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

function asyncHandler(fn: AsyncHandler) {
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
