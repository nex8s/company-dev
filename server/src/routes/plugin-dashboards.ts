import type { Db } from "@paperclipai/db";
import { createPluginDashboardsRouter } from "@paperclipai/plugin-dashboards/server/index";
import { assertCompanyAccess } from "./authz.js";

/**
 * Mount point for `@paperclipai/plugin-dashboards`. Mirrors the plugin-company
 * pattern — forwards the server's authz helper into the plugin so routes
 * stay decoupled from `server/src/routes/authz.ts`.
 */
export function pluginDashboardsRoutes(db: Db) {
  return createPluginDashboardsRouter({
    db,
    authorizeCompanyAccess: (req, companyId) => assertCompanyAccess(req, companyId),
  });
}
