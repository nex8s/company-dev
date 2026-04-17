import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { Db } from "@paperclipai/db";
import { buildFileTree } from "../builder/file-tree.js";
import type { AppDeploymentRow, AppRow } from "../schema.js";
import {
  getAppFile,
  getAppForCompany,
  listAppDeployments,
  listAppFiles,
  mergeAppEnvVars,
  removeAppEnvVar,
} from "../storage/apps-queries.js";
import {
  companyAppParamSchema,
  envKeyParamSchema,
  filePathQuerySchema,
  patchEnvBodySchema,
} from "./schemas.js";

export interface PluginAppsBuilderActorInfo {
  readonly actorType: "agent" | "user";
  readonly actorId: string;
  readonly agentId: string | null;
  readonly runId: string | null;
}

export interface PluginAppsBuilderRouterDeps {
  readonly db: Db;
  readonly authorizeCompanyAccess: (req: Request, companyId: string) => void;
  readonly resolveActorInfo: (req: Request) => PluginAppsBuilderActorInfo;
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

function parseBody<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
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
 * Plugin-apps-builder HTTP routes (B-03 — Preview / Code / Deployments /
 * Settings tabs backend).
 *
 * All paths absolute under the server's `/api` mount:
 *   GET    /api/companies/:companyId/plugin-apps-builder/apps/:appId
 *   GET    /api/companies/:companyId/plugin-apps-builder/apps/:appId/preview
 *   GET    /api/companies/:companyId/plugin-apps-builder/apps/:appId/files
 *   GET    /api/companies/:companyId/plugin-apps-builder/apps/:appId/files/blob?path=...
 *   GET    /api/companies/:companyId/plugin-apps-builder/apps/:appId/deployments
 *   GET    /api/companies/:companyId/plugin-apps-builder/apps/:appId/env
 *   PATCH  /api/companies/:companyId/plugin-apps-builder/apps/:appId/env
 *   DELETE /api/companies/:companyId/plugin-apps-builder/apps/:appId/env/:key
 */
export function createPluginAppsBuilderRouter(
  deps: PluginAppsBuilderRouterDeps,
): Router {
  const router = Router();

  router.get(
    "/companies/:companyId/plugin-apps-builder/apps/:appId",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const app = await requireApp(deps.db, companyId, appId);
      res.json({ app: toAppDto(app) });
    }),
  );

  // ---------------------------------------------------------------------
  // Preview tab
  // ---------------------------------------------------------------------
  router.get(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/preview",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const app = await requireApp(deps.db, companyId, appId);
      res.json({
        preview: {
          productionDomain: app.productionDomain,
          status: app.productionDomain ? "deployed" : "not_deployed",
        },
      });
    }),
  );

  // ---------------------------------------------------------------------
  // Code tab — file tree + single-file content
  // ---------------------------------------------------------------------
  router.get(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/files",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      await requireApp(deps.db, companyId, appId);

      const flat = await listAppFiles(deps.db, appId);
      const tree = buildFileTree(
        appId,
        flat.map((f) => ({ path: f.path, sizeBytes: f.sizeBytes })),
      );
      res.json({
        tree,
        count: flat.length,
        files: flat.map((f) => ({
          path: f.path,
          sizeBytes: f.sizeBytes,
          updatedAt: f.updatedAt.toISOString(),
        })),
      });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/files/blob",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      await requireApp(deps.db, companyId, appId);

      const { path } = parseQuery(filePathQuerySchema, req.query);
      const fullPath = path.startsWith(`apps/${appId}/`) ? path : `apps/${appId}/${path}`;
      const file = await getAppFile(deps.db, appId, fullPath);
      if (!file) throw new HttpError(404, `file not found: ${path}`);
      res.json({
        file: {
          path: file.path,
          content: file.content,
          sizeBytes: file.sizeBytes,
          updatedAt: file.updatedAt.toISOString(),
        },
      });
    }),
  );

  // ---------------------------------------------------------------------
  // Deployments tab
  // ---------------------------------------------------------------------
  router.get(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/deployments",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      await requireApp(deps.db, companyId, appId);

      const rows = await listAppDeployments(deps.db, appId);
      res.json({ deployments: rows.map(toDeploymentDto) });
    }),
  );

  // ---------------------------------------------------------------------
  // Settings tab — env var CRUD
  // ---------------------------------------------------------------------
  router.get(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/env",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const app = await requireApp(deps.db, companyId, appId);
      res.json({ envVars: app.envVars });
    }),
  );

  router.patch(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/env",
    asyncHandler(async (req, res) => {
      const { companyId, appId } = parseParams(companyAppParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      await requireApp(deps.db, companyId, appId);

      const body = parseBody(patchEnvBodySchema, req.body ?? {});
      const envVars = await mergeAppEnvVars(deps.db, appId, body.envVars);
      res.json({ envVars });
    }),
  );

  router.delete(
    "/companies/:companyId/plugin-apps-builder/apps/:appId/env/:key",
    asyncHandler(async (req, res) => {
      const { companyId, appId, key } = parseParams(envKeyParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      await requireApp(deps.db, companyId, appId);
      const envVars = await removeAppEnvVar(deps.db, appId, key);
      res.json({ envVars });
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

async function requireApp(db: Db, companyId: string, appId: string): Promise<AppRow> {
  const app = await getAppForCompany(db, companyId, appId);
  if (!app) throw new HttpError(404, `app not found: ${appId}`);
  return app;
}

function toAppDto(app: AppRow) {
  return {
    id: app.id,
    companyId: app.companyId,
    name: app.name,
    channelId: app.channelId,
    connections: app.connections,
    envVars: app.envVars,
    productionDomain: app.productionDomain,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

function toDeploymentDto(row: AppDeploymentRow) {
  return {
    id: row.id,
    appId: row.appId,
    url: row.url,
    status: row.status,
    triggeredByAgentId: row.triggeredByAgentId,
    triggeredAt: row.triggeredAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
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
