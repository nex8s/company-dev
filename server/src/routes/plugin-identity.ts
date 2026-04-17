import {
  createPluginIdentityRouter,
  type PluginIdentityActorInfo,
} from "@paperclipai/plugin-identity/server/index";
import { MockBankProvider, type BankProvider } from "@paperclipai/plugin-identity";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-identity`. Forwards the
 * server's authz helpers into the plugin and selects the BankProvider impl
 * (Mock in dev/test; switch via `COMPANY_BANK_PROVIDER` env once a real
 * provider — Mercury / Column / Stripe Issuing — lands).
 *
 * Mounted in `app.ts`. Adding a route to plugin-identity means editing
 * `packages/plugin-identity/src/server/router.ts` only — this thin re-export
 * does not need to change.
 */
export function pluginIdentityRoutes() {
  const bankProvider = selectBankProvider();
  return createPluginIdentityRouter({
    bankProvider,
    authorizeCompanyAccess: (req, companyId) => assertCompanyAccess(req, companyId),
    resolveActorInfo: (req): PluginIdentityActorInfo => {
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

function selectBankProvider(): BankProvider {
  const choice = (process.env.COMPANY_BANK_PROVIDER ?? "mock").toLowerCase();
  switch (choice) {
    case "mock":
      return new MockBankProvider();
    default:
      // Real providers (mercury / column / stripe-issuing) will register here.
      throw new Error(
        `COMPANY_BANK_PROVIDER="${choice}" is not yet implemented; only "mock" is available`,
      );
  }
}
