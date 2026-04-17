import type { Db } from "@paperclipai/db";
import { createPluginCompanyRouter } from "@paperclipai/plugin-company/server/index";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-company`. Forwards the
 * server's authz helpers into the plugin so plugin-company stays decoupled
 * from `server/src/routes/authz.ts`.
 *
 * Mounted in `app.ts`. Adding a route to plugin-company means editing
 * `packages/plugin-company/src/server/router.ts` only — this thin re-export
 * does not need to change.
 */
export function pluginCompanyRoutes(db: Db) {
  return createPluginCompanyRouter({
    db,
    authorizeCompanyAccess: (req, companyId) => assertCompanyAccess(req, companyId),
    resolveActorInfo: (req) => {
      const info = getActorInfo(req);
      return {
        actorType: info.actorType,
        actorId: info.actorId,
        agentId: info.agentId,
        runId: info.runId,
      };
    },
  });
}
