/**
 * @paperclipai/plugin-payments — Company.dev payments + credit ledger plugin.
 *
 * Bootstrapped at A-07 with the credit ledger surface:
 *   - recordTopUp / recordUsage / recordRollover / recordAdjustment
 *   - getCompanyBalanceCents / getAgentUsageCentsInWindow
 *   - setAgentMonthlyCap / enforceAgentMonthlyCap / resumePausedAgentsForNewMonth
 *
 * Subsequent tasks (B-07 Stripe, B-08 billing UI) wire HTTP routes + the
 * Stripe webhook handler on top of this module.
 */

export * from "./schema.js";
export * from "./ledger/operations.js";
export * from "./budgets/cap-enforcement.js";
export * from "./billing/index.js";
export * from "./stripe/index.js";

export interface PaymentsPluginRegistration {
  readonly name: "plugin-payments";
  readonly version: string;
}

/**
 * Plugin registration marker mirroring plugin-company. The host's plugin
 * loader can read this for diagnostics; full hook registration lives in the
 * server-side bootstrap when the package gains routes (B-07 / B-08).
 */
export function registerPlugin(): PaymentsPluginRegistration {
  return {
    name: "plugin-payments",
    version: "0.1.0",
  };
}
