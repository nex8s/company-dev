import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { Db } from "@paperclipai/db";
import {
  getPublishedTemplateBySlug,
  getStoreFacets,
  listPublishedTemplates,
} from "../discovery/index.js";
import type { StoreTemplateRow } from "../schema.js";
import { listTemplatesQuerySchema, slugParamSchema } from "./schemas.js";

export interface PluginStoreActorInfo {
  readonly actorType: "agent" | "user";
  readonly actorId: string;
  readonly agentId: string | null;
  readonly runId: string | null;
}

export interface PluginStoreRouterDeps {
  readonly db: Db;
  /**
   * Assert the caller is authenticated. Store browsing is intentionally NOT
   * companyId-scoped — the marketplace is global — so we don't take an
   * `authorizeCompanyAccess` dep. Callers should still throw a 401 / 403 when
   * the actor isn't logged in.
   */
  readonly assertAuthenticated: (req: Request) => void;
  readonly resolveActorInfo: (req: Request) => PluginStoreActorInfo;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function parseParams<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  return parsed.data;
}

function parseQuery<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  return parsed.data;
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`)
    .join("; ");
}

/**
 * Plugin-store HTTP router (B-06 — Store publishing bridge / discovery).
 *
 *   GET /api/store/templates?kind=&category=&q=&limit=&offset=
 *        → { templates: StoreTemplateRow[], pagination: { limit, offset, total } }
 *   GET /api/store/templates/facets
 *        → { categories: [{ category, count }], kinds: [{ kind, count }], total }
 *   GET /api/store/templates/:slug
 *        → { template: StoreTemplateRow }   404 if no row
 *
 * Writes (publishAgentAsTemplate / publishCompanyAsTemplate) live in
 * plugin-company per A-10. The two plugins share the `store_templates`
 * table directly — there is no plugin-to-plugin RPC.
 */
export function createPluginStoreRouter(deps: PluginStoreRouterDeps): Router {
  const router = Router();

  router.get(
    "/store/templates",
    asyncHandler(async (req, res) => {
      deps.assertAuthenticated(req);
      const query = parseQuery(listTemplatesQuerySchema, req.query);
      const result = await listPublishedTemplates(deps.db, {
        kind: query.kind,
        category: query.category,
        q: query.q,
        limit: query.limit,
        offset: query.offset,
      });
      res.json({
        templates: result.templates.map(toTemplateDto),
        pagination: result.pagination,
      });
    }),
  );

  router.get(
    "/store/templates/facets",
    asyncHandler(async (req, res) => {
      deps.assertAuthenticated(req);
      const facets = await getStoreFacets(deps.db);
      res.json(facets);
    }),
  );

  router.get(
    "/store/templates/:slug",
    asyncHandler(async (req, res) => {
      deps.assertAuthenticated(req);
      const { slug } = parseParams(slugParamSchema, req.params);
      const row = await getPublishedTemplateBySlug(deps.db, slug);
      if (!row) throw new HttpError(404, `template not found: ${slug}`);
      res.json({ template: toTemplateDto(row) });
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

function toTemplateDto(row: StoreTemplateRow) {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    category: row.category,
    summary: row.summary,
    skills: row.skills,
    employees: row.employees,
    creator: row.creator,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
