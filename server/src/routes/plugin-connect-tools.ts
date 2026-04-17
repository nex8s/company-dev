import type { Db } from "@paperclipai/db";
import {
  createPluginConnectToolsRouter,
  type PluginConnectToolsActorInfo,
} from "@paperclipai/plugin-connect-tools/server/index";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-connect-tools`. Forwards
 * the server's authz helpers into the plugin so the plugin stays decoupled
 * from `server/src/routes/authz.ts`.
 *
 * Mounted in `app.ts`. Adding a route to plugin-connect-tools means editing
 * `packages/plugin-connect-tools/src/server/router.ts` only — this thin
 * re-export does not need to change.
 */
export function pluginConnectToolsRoutes(db: Db) {
  return createPluginConnectToolsRouter({
    db,
    authorizeCompanyAccess: (req, companyId) => assertCompanyAccess(req, companyId),
    resolveActorInfo: (req): PluginConnectToolsActorInfo => {
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
