/**
 * Server-side surface for `@paperclipai/plugin-apps-builder` — the Express
 * router factory mounted by the host. Kept under `./server/*` so the
 * main package entry remains free of express runtime imports for
 * non-server consumers (CLI, workers).
 */

export {
  createPluginAppsBuilderRouter,
  type PluginAppsBuilderActorInfo,
  type PluginAppsBuilderRouterDeps,
} from "./router.js";

export {
  companyAppParamSchema,
  envKeyParamSchema,
  filePathQuerySchema,
  patchEnvBodySchema,
  type PatchEnvBody,
} from "./schemas.js";
