import type { SeedTemplate } from "../types.js";

export const devopsMonitoringOps: SeedTemplate = {
  slug: "devops-monitoring-ops",
  kind: "business",
  title: "DevOps Monitoring Ops",
  category: "Engineering & Product",
  summary:
    "A 24/7 ops room in a box: monitor metrics, triage alerts, auto-remediate when safe, update stakeholders, and write post-mortems — cut MTTR and route only P1s to humans.",
  creator: "Company.dev",
  skills: [
    "anomaly-detection",
    "alert-triage",
    "runbook-execution",
    "incident-reporting",
    "slack-notifications",
  ],
  employees: [
    {
      role: "Monitor Agent",
      department: "engineering",
      model: "claude-haiku-4-5",
      schedule: "every-1-min",
      responsibilities: [
        "Poll metrics",
        "Threshold checks",
        "Anomaly detection",
      ],
    },
    {
      role: "Triage Agent",
      department: "engineering",
      model: "claude-sonnet-4-6",
      schedule: "on-alert",
      responsibilities: [
        "Classify severity",
        "Find root cause",
        "Assign to runbook",
      ],
    },
    {
      role: "Auto-Remediation Agent",
      department: "engineering",
      model: "claude-sonnet-4-6",
      schedule: "on-alert",
      responsibilities: [
        "Execute runbooks",
        "Restart services",
        "Scale resources",
      ],
    },
    {
      role: "Comms Agent",
      department: "support",
      model: "claude-haiku-4-5",
      schedule: "on-incident",
      responsibilities: [
        "Slack updates",
        "Status page posts",
        "Stakeholder emails",
      ],
    },
    {
      role: "Post-Mortem Writer",
      department: "engineering",
      model: "claude-sonnet-4-6",
      schedule: "post-incident",
      responsibilities: [
        "Timeline reconstruction",
        "Root cause analysis",
        "Action items",
      ],
    },
  ],
};
