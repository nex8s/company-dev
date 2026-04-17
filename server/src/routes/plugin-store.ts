import type { Db } from "@paperclipai/db";
import {
  createPluginStoreRouter,
  type PluginStoreActorInfo,
} from "@paperclipai/plugin-store/server/index";
import { assertAuthenticated, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-store` (B-06 — Store
 * publishing bridge / discovery routes).
 *
 * Reads are intentionally not company-scoped: the store is a global
 * marketplace, so callers only need to be authenticated. Write paths
 * (publishAgentAsTemplate / publishCompanyAsTemplate) live under
 * plugin-company per A-10 and use the per-company authz pattern there.
 *
 * Adding a route means editing `packages/plugin-store/src/server/router.ts`
 * only — this thin re-export does not need to change.
 */
export function pluginStoreRoutes(db: Db) {
  return createPluginStoreRouter({
    db,
    assertAuthenticated: (req) => assertAuthenticated(req),
    resolveActorInfo: (req): PluginStoreActorInfo => {
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
