/**
 * Server-side surface for `@paperclipai/plugin-store` (B-06). Splitting under
 * `./server/*` keeps the main package entry free of express runtime imports
 * for non-server consumers (CLI, install flow used by other plugins).
 */

export {
  createPluginStoreRouter,
  type PluginStoreActorInfo,
  type PluginStoreRouterDeps,
} from "./router.js";

export {
  slugParamSchema,
  listTemplatesQuerySchema,
  type ListTemplatesQuery,
} from "./schemas.js";
