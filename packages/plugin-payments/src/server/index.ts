/**
 * Server-side surface for `@paperclipai/plugin-payments` — the Express
 * router factory mounted by the host. Split under ./server/* so the
 * main entry stays free of express runtime imports for non-server
 * consumers (ledger + budget math modules).
 */

export {
  createPluginPaymentsRouter,
  type PluginPaymentsActorInfo,
  type PluginPaymentsRouterDeps,
} from "./router.js";

export {
  companyIdParamSchema,
  createSubscriptionCheckoutBodySchema,
  createTopUpCheckoutBodySchema,
  createPortalBodySchema,
  type CreateSubscriptionCheckoutBody,
  type CreateTopUpCheckoutBody,
  type CreatePortalBody,
} from "./schemas.js";
