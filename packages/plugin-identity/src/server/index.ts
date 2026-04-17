/**
 * Server-side surface for `@paperclipai/plugin-identity` — Express router
 * factory mounted by the host (Paperclip `server/`) at boot. Splitting this
 * under `./server/*` keeps the main entry of the package free of express
 * runtime imports, so plugin-identity stays usable from contexts that don't
 * ship a web server (the CLI, future workers).
 */

export {
  createPluginIdentityRouter,
  type PluginIdentityActorInfo,
  type PluginIdentityRouterDeps,
} from "./router.js";

export {
  companyAgentParamSchema,
  cardIdParamSchema,
  issueCardBodySchema,
  type IssueCardBody,
} from "./schemas.js";
