/**
 * Landing page copy — all user-facing strings for `ui/src/pages/Landing.tsx`.
 *
 * Hard rule (AGENT_C_PROMPT §"Hard rules"): "No literal strings embedded in
 * JSX if the string is user-facing marketing/product copy." This file is
 * the single point of edit for marketing copy and the swap target for C-14
 * (reference-brand → Company.dev final voice).
 *
 * Every TODO(C-14) below flags a string that is either derived from the
 * reference prototype or pending final product voice. C-14's gate greps for
 * these tokens so the list stays accurate.
 */

export const landing = {
  brand: {
    // TODO(C-14): confirm product name — "Company.dev" vs "Company" — with user.
    name: "Company.dev",
    // TODO(C-14): swap the neutral dot-matrix mark in Landing.tsx for the
    // final Company.dev logo once the user provides it.
    logoAlt: "Company.dev logo",
  },

  nav: {
    home: "Home",
    templates: "Templates",
    enterprise: "Enterprise",
    pricing: "Pricing",
    accelerator: "Accelerator",
    resources: "Resources",
  },

  auth: {
    logIn: "Log in",
    getStarted: "Get started",
  },

  hero: {
    // TODO(C-14): final tagline to be provided by the user. "Build your Dream
    // Company" is a placeholder derived from the ui-import prototype.
    headline: "Build your Dream Company",
    // TODO(C-14): final sub-tagline.
    subheadline: "Hire AI employees to create and run your company",
  },

  composer: {
    examplePrefix: "launch a",
    exampleEmphasis: "productized SEO agency",
    exampleSuffix: "that runs itself",
    modeBuild: "Build a new company",
    modeAutomate: "Automate existing company",
    attachLabel: "Attach a file",
    sendLabel: "Send",
  },

  devPreview: {
    label: "Internal dev preview",
    detail:
      "Copy and brand marks are placeholder. Final swap lands in C-14 before public launch.",
  },
};

export type LandingCopy = typeof landing;
