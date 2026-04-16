/**
 * Getting Started checklist (A-04) — 7 steps in the order shown in the
 * prototype's sidebar Getting Started panel.
 */

export const GETTING_STARTED_STEPS = [
  "incorporate",
  "domain",
  "email_inboxes",
  "stripe_billing",
  "deploy_first_app",
  "google_search_console",
  "custom_dashboard_pages",
] as const;

export type GettingStartedStep = (typeof GETTING_STARTED_STEPS)[number];

export const GETTING_STARTED_TOTAL = GETTING_STARTED_STEPS.length;

export const GETTING_STARTED_TITLES: Record<GettingStartedStep, string> = {
  incorporate: "Incorporate",
  domain: "Domain",
  email_inboxes: "Email inboxes",
  stripe_billing: "Stripe billing",
  deploy_first_app: "Deploy first app",
  google_search_console: "Google Search Console",
  custom_dashboard_pages: "Custom dashboard pages",
};

export function isGettingStartedStep(value: string): value is GettingStartedStep {
  return (GETTING_STARTED_STEPS as readonly string[]).includes(value);
}
