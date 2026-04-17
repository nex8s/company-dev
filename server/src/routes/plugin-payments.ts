import type { Db } from "@paperclipai/db";
import {
  createPluginPaymentsRouter,
  type PluginPaymentsActorInfo,
} from "@paperclipai/plugin-payments/server/index";
import { MockStripeClient, type StripeClient } from "@paperclipai/plugin-payments";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Documented mount point for `@paperclipai/plugin-payments` (B-07). Wires
 * the host's authz helpers into the plugin and selects the Stripe client
 * implementation:
 *
 *   - When `STRIPE_SECRET_KEY` is set, Phase-2 will swap this for a real
 *     `stripe` SDK wrapper; today we stub with `MockStripeClient` so the
 *     routes boot in dev/test without a live Stripe account.
 *
 * Webhook signing secret comes from `STRIPE_WEBHOOK_SECRET`; the Mock
 * accepts `whsec_mock`, so the default is safe for local dev.
 */
export function pluginPaymentsRoutes(db: Db) {
  const stripe = selectStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_mock";
  return createPluginPaymentsRouter({
    db,
    stripe,
    webhookSecret,
    authorizeCompanyAccess: (req, companyId) => assertCompanyAccess(req, companyId),
    resolveActorInfo: (req): PluginPaymentsActorInfo => {
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

function selectStripeClient(): StripeClient {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return new MockStripeClient();
  }
  // Phase-2: wrap the real `stripe` SDK here. For now refuse to boot with
  // a half-configured env so operators notice.
  throw new Error(
    "STRIPE_SECRET_KEY is set, but the real Stripe adapter is not yet wired. " +
      "Unset the env var to fall back to the Mock, or implement the real client.",
  );
}
