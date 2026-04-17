import type { Db } from "@paperclipai/db";
import {
  createPluginAppsBuilderRouter,
  type PluginAppsBuilderActorInfo,
} from "@paperclipai/plugin-apps-builder/server/index";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-apps-builder` — B-03
 * Preview / Code / Deployments / Settings tabs. Forwards the host's authz
 * helpers into the plugin so the plugin stays decoupled from
 * `server/src/routes/authz.ts`.
 *
 * Adding a route means editing
 * `packages/plugin-apps-builder/src/server/router.ts` only — this thin
 * re-export does not need to change.
 */
export function pluginAppsBuilderRoutes(db: Db) {
  return createPluginAppsBuilderRouter({
    db,
    authorizeCompanyAccess: (req, companyId) => assertCompanyAccess(req, companyId),
    resolveActorInfo: (req): PluginAppsBuilderActorInfo => {
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
