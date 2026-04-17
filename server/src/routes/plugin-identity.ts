import type { Db } from "@paperclipai/db";
import {
  createPluginIdentityRouter,
  type PluginIdentityActorInfo,
} from "@paperclipai/plugin-identity/server/index";
import {
  MockBankProvider,
  MockEmailProvider,
  type BankProvider,
  type EmailProvider,
} from "@paperclipai/plugin-identity";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-identity`. Forwards the
 * server's authz helpers into the plugin and selects the BankProvider /
 * EmailProvider impls. Switch via `COMPANY_BANK_PROVIDER` /
 * `COMPANY_EMAIL_PROVIDER` env once real providers (Mercury / Column /
 * Stripe Issuing — Resend / Postmark) land.
 *
 * Mounted in `app.ts`. Adding a route to plugin-identity means editing
 * `packages/plugin-identity/src/server/router.ts` only — this thin re-export
 * does not need to change.
 */
export function pluginIdentityRoutes(db: Db) {
  return createPluginIdentityRouter({
    db,
    bankProvider: selectBankProvider(),
    emailProvider: selectEmailProvider(),
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
      throw new Error(
        `COMPANY_BANK_PROVIDER="${choice}" is not yet implemented; only "mock" is available`,
      );
  }
}

function selectEmailProvider(): EmailProvider {
  const choice = (process.env.COMPANY_EMAIL_PROVIDER ?? "mock").toLowerCase();
  switch (choice) {
    case "mock":
      return new MockEmailProvider();
    default:
      throw new Error(
        `COMPANY_EMAIL_PROVIDER="${choice}" is not yet implemented; only "mock" is available`,
      );
  }
}
