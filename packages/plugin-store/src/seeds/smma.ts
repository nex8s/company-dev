import type { SeedTemplate } from "../types.js";

export const smma: SeedTemplate = {
  slug: "smma",
  kind: "business",
  title: "SMMA (Social Media Marketing)",
  category: "Agency & Services",
  summary:
    "A turnkey social media marketing agency: prospect local businesses, run discovery calls, produce monthly content packs, and report results — all with a small team of specialist agents.",
  creator: "Company.dev",
  skills: [
    "lead-sourcing",
    "cold-outreach",
    "discovery-calls",
    "content-planning",
    "creative-production",
    "community-management",
    "client-reporting",
  ],
  employees: [
    {
      role: "Prospector",
      department: "sales",
      model: "claude-sonnet-4-6",
      schedule: "daily",
      responsibilities: [
        "Source local businesses matching the ICP",
        "Scrape public socials for engagement gaps",
        "Draft first-touch outreach tailored to each lead",
      ],
    },
    {
      role: "Account Strategist",
      department: "sales",
      model: "claude-opus-4-6",
      schedule: "per-client",
      responsibilities: [
        "Run discovery calls and capture brand voice",
        "Draft quarterly content strategy and KPIs",
        "Own client retention conversations",
      ],
    },
    {
      role: "Content Producer",
      department: "marketing",
      model: "claude-sonnet-4-6",
      schedule: "weekly",
      responsibilities: [
        "Turn strategy into a 30-post content calendar",
        "Produce captions, alt text, and hashtags",
        "Hand off to Creative for visual assets",
      ],
    },
    {
      role: "Community Manager",
      department: "support",
      model: "claude-haiku-4-5",
      schedule: "every-2h",
      responsibilities: [
        "Reply to comments and DMs in brand voice",
        "Escalate sentiment risks to the strategist",
        "Surface UGC worth reposting",
      ],
    },
    {
      role: "Reporter",
      department: "operations",
      model: "claude-haiku-4-5",
      schedule: "weekly",
      responsibilities: [
        "Pull platform analytics for each client",
        "Ship a one-page progress report",
        "Flag underperforming campaigns for the strategist",
      ],
    },
  ],
};
