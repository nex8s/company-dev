import type { SeedTemplate } from "../types.js";

export const devAgency: SeedTemplate = {
  slug: "dev-agency",
  kind: "business",
  title: "Dev Agency",
  category: "Agency & Services",
  summary:
    "Run a boutique development agency with an AI-native team: a CEO who closes deals, a PM who tracks scope, three specialist engineers, a QA, a DevOps, and a client-comms lead — ship two client projects a month.",
  creator: "Company.dev",
  skills: [
    "code-generation",
    "project-management",
    "file-management",
    "web-search",
    "testing",
    "devops",
  ],
  employees: [
    {
      role: "CEO",
      model: "claude-opus-4-6",
      schedule: "daily",
      responsibilities: [
        "Deal closing",
        "Pricing strategy",
        "Team capacity planning",
      ],
    },
    {
      role: "Project Manager",
      model: "claude-opus-4-6",
      schedule: "daily",
      responsibilities: [
        "Sprint planning",
        "Deadline tracking",
        "Scope management",
      ],
    },
    {
      role: "Backend Engineer",
      model: "claude-sonnet-4-6",
      schedule: "every 4h",
      responsibilities: [
        "Backend development",
        "API design",
        "Database schema",
      ],
    },
    {
      role: "Frontend Engineer",
      model: "claude-sonnet-4-6",
      schedule: "every 4h",
      responsibilities: [
        "Frontend development",
        "UI implementation",
        "Performance",
      ],
    },
    {
      role: "Integrations Engineer",
      model: "claude-sonnet-4-6",
      schedule: "every 4h",
      responsibilities: [
        "Integrations",
        "Third-party APIs",
        "Data pipelines",
      ],
    },
    {
      role: "QA Engineer",
      model: "claude-haiku-4-5",
      schedule: "every 6h",
      responsibilities: [
        "Test writing",
        "Bug reporting",
        "Regression testing",
      ],
    },
    {
      role: "DevOps",
      model: "claude-haiku-4-5",
      schedule: "every 8h",
      responsibilities: [
        "CI/CD",
        "Infrastructure",
        "Monitoring & alerts",
      ],
    },
    {
      role: "Client Comms",
      model: "claude-haiku-4-5",
      schedule: "every 4h",
      responsibilities: [
        "Status updates",
        "Feedback collection",
        "Change requests",
      ],
    },
  ],
};
