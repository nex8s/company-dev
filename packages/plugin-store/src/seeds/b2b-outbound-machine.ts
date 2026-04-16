import type { SeedTemplate } from "../types.js";

export const b2bOutboundMachine: SeedTemplate = {
  slug: "b2b-outbound-machine",
  kind: "business",
  title: "B2B Outbound Machine",
  category: "Sales & Revenue",
  summary:
    "A five-agent outbound team that sources accounts, enriches intent, writes personalised sequences, tracks replies, and routes hot leads to sales reps — no spray-and-pray.",
  creator: "Company.dev",
  skills: [
    "icp-sourcing",
    "intent-enrichment",
    "email-personalisation",
    "sequence-automation",
    "lead-qualification",
  ],
  employees: [
    {
      role: "ICP Sourcer",
      department: "sales",
      model: "claude-sonnet-4-6",
      schedule: "daily",
      responsibilities: [
        "LinkedIn Sales Nav search",
        "Company filters",
        "Build prospect lists",
      ],
    },
    {
      role: "Enrichment Agent",
      department: "sales",
      model: "claude-sonnet-4-6",
      schedule: "per-prospect",
      responsibilities: [
        "Intent signals",
        "Company news",
        "Trigger events",
      ],
    },
    {
      role: "Copywriter Agent",
      department: "sales",
      model: "claude-opus-4-6",
      schedule: "per-prospect",
      responsibilities: [
        "Step 1–3 emails",
        "Personalised hooks",
        "CTA variants",
      ],
    },
    {
      role: "Send & Track Agent",
      department: "sales",
      model: "claude-haiku-4-5",
      schedule: "daily",
      responsibilities: [
        "Schedule sends",
        "Track opens/replies",
        "Pause on negative",
      ],
    },
    {
      role: "Lead Qualifier",
      department: "sales",
      model: "claude-sonnet-4-6",
      schedule: "on-reply",
      responsibilities: [
        "Score reply intent",
        "Book Calendly",
        "Brief sales rep",
      ],
    },
  ],
};
