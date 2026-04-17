import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { Db } from "@paperclipai/db";
import {
  companyIdParamSchema,
  companyPageParamSchema,
  createDashboardPageBodySchema,
  updateDashboardPageBodySchema,
} from "./schemas.js";
import {
  createDashboardPage,
  deleteDashboardPage,
  getDashboardPage,
  listDashboardPages,
  updateDashboardPage,
} from "../pages/operations.js";
import type { DashboardLayout, DashboardWidget } from "../schema.js";
import { resolveWidgets } from "../widgets/resolvers.js";

export interface PluginDashboardsRouterDeps {
  readonly db: Db;
  readonly authorizeCompanyAccess: (req: Request, companyId: string) => void;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  return parsed.data;
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`)
    .join("; ");
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

export function createPluginDashboardsRouter(deps: PluginDashboardsRouterDeps): Router {
  const router = Router();

  router.get(
    "/companies/:companyId/plugin-dashboards/pages",
    asyncHandler(async (req, res) => {
      const { companyId } = parse(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const pages = await listDashboardPages(deps.db, companyId);
      res.json({ pages });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-dashboards/pages",
    asyncHandler(async (req, res) => {
      const { companyId } = parse(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parse(createDashboardPageBodySchema, req.body ?? {});
      const page = await createDashboardPage(deps.db, {
        companyId,
        title: body.title,
        layout: body.layout as DashboardLayout,
      });
      res.status(201).json({ page });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-dashboards/pages/:pageId",
    asyncHandler(async (req, res) => {
      const { companyId, pageId } = parse(companyPageParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const page = await getDashboardPage(deps.db, { companyId, pageId });
      if (!page) throw new HttpError(404, "dashboard page not found");
      res.json({ page });
    }),
  );

  router.patch(
    "/companies/:companyId/plugin-dashboards/pages/:pageId",
    asyncHandler(async (req, res) => {
      const { companyId, pageId } = parse(companyPageParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parse(updateDashboardPageBodySchema, req.body ?? {});
      const page = await updateDashboardPage(deps.db, {
        companyId,
        pageId,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.layout !== undefined ? { layout: body.layout as DashboardLayout } : {}),
      });
      if (!page) throw new HttpError(404, "dashboard page not found");
      res.json({ page });
    }),
  );

  router.delete(
    "/companies/:companyId/plugin-dashboards/pages/:pageId",
    asyncHandler(async (req, res) => {
      const { companyId, pageId } = parse(companyPageParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const deleted = await deleteDashboardPage(deps.db, { companyId, pageId });
      if (!deleted) throw new HttpError(404, "dashboard page not found");
      res.status(204).send();
    }),
  );

  router.get(
    "/companies/:companyId/plugin-dashboards/pages/:pageId/render",
    asyncHandler(async (req, res) => {
      const { companyId, pageId } = parse(companyPageParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const page = await getDashboardPage(deps.db, { companyId, pageId });
      if (!page) throw new HttpError(404, "dashboard page not found");
      const layout = page.layout as unknown as DashboardLayout;
      const widgets = Array.isArray(layout?.widgets) ? (layout.widgets as DashboardWidget[]) : [];
      const envelopes = await resolveWidgets({ db: deps.db, companyId }, widgets);
      res.json({
        page: { id: page.id, title: page.title },
        widgets: envelopes,
      });
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
