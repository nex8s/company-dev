import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { Db } from "@paperclipai/db";
import { listAdapters } from "../adapters/registry.js";
import type { ConnectionToolKind } from "../adapters/types.js";
import {
  deleteConnection,
  listConnections,
  storeConnection,
  type ConnectionRow,
} from "../storage/connections.js";
import {
  companyIdParamSchema,
  connectionIdParamSchema,
  createConnectionBodySchema,
} from "./schemas.js";

export interface PluginConnectToolsActorInfo {
  readonly actorType: "agent" | "user";
  readonly actorId: string;
  readonly agentId: string | null;
  readonly runId: string | null;
}

export interface PluginConnectToolsRouterDeps {
  readonly db: Db;
  readonly authorizeCompanyAccess: (req: Request, companyId: string) => void;
  readonly resolveActorInfo: (req: Request) => PluginConnectToolsActorInfo;
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

function toConnectionDto(row: ConnectionRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    toolKind: row.toolKind as ConnectionToolKind,
    label: row.label,
    scopes: row.scopes,
    metadata: row.metadata,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    connectedAt: row.connectedAt.toISOString(),
    /**
     * The raw token is intentionally NOT serialized to the API — only callers
     * that operate within the trust boundary (e.g. server-to-server tool
     * dispatch) should ever read it from the DB. The `tokenLast4` lets the UI
     * confirm-which-token-is-which without exposing the full secret.
     */
    tokenLast4: row.token.slice(-4),
  };
}

/**
 * Build the plugin-connect-tools HTTP router. Paths are absolute under the
 * server's `/api` mount:
 *   GET    /api/companies/:companyId/plugin-connect-tools/adapters
 *   GET    /api/companies/:companyId/plugin-connect-tools/connections
 *   POST   /api/companies/:companyId/plugin-connect-tools/connections
 *   DELETE /api/companies/:companyId/plugin-connect-tools/connections/:connectionId
 */
export function createPluginConnectToolsRouter(deps: PluginConnectToolsRouterDeps): Router {
  const router = Router();

  router.get(
    "/companies/:companyId/plugin-connect-tools/adapters",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      res.json({
        adapters: listAdapters().map((a) => ({
          kind: a.kind,
          displayName: a.displayName,
          homepageUrl: a.homepageUrl,
          defaultScopes: [...a.defaultScopes],
        })),
      });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-connect-tools/connections",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const rows = await listConnections(deps.db, companyId);
      res.json({ connections: rows.map(toConnectionDto) });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-connect-tools/connections",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(createConnectionBodySchema, req.body ?? {});

      try {
        const row = await storeConnection(deps.db, {
          companyId,
          toolKind: body.toolKind as ConnectionToolKind,
          label: body.label,
          token: body.token,
          refreshToken: body.refreshToken ?? null,
          scopes: body.scopes,
          metadata: body.metadata,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        });
        res.status(201).json({ connection: toConnectionDto(row) });
      } catch (err) {
        if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
          throw new HttpError(409, `connection already exists: ${body.toolKind}/${body.label}`);
        }
        throw err;
      }
    }),
  );

  router.delete(
    "/companies/:companyId/plugin-connect-tools/connections/:connectionId",
    asyncHandler(async (req, res) => {
      const { companyId, connectionId } = parseParams(connectionIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const ok = await deleteConnection(deps.db, companyId, connectionId);
      if (!ok) throw new HttpError(404, `connection not found: ${connectionId}`);
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
