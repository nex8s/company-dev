/**
 * Server-side surface for `@paperclipai/plugin-connect-tools` — the Express
 * router factory mounted by the host (Paperclip `server/`) at boot. Splitting
 * this under `./server/*` keeps the main entry of the package free of express
 * runtime imports for non-server consumers (CLI, future workers).
 */

export {
  createPluginConnectToolsRouter,
  type PluginConnectToolsActorInfo,
  type PluginConnectToolsRouterDeps,
} from "./router.js";

export {
  companyIdParamSchema,
  connectionIdParamSchema,
  createConnectionBodySchema,
  type CreateConnectionBody,
} from "./schemas.js";
