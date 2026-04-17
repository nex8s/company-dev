/**
 * App detail copy — `ui/src/pages/AppDetail.tsx` (C-10).
 */

export const appDetail = {
  page: {
    backToCompany: "Company",
    websiteLabel: "Website",
    notFoundTitle: "App not found",
    notFoundBody: (id: string) => `No app with id "${id}" lives in this company.`,
    error: "Couldn't load this app.",
  },
  status: {
    deployed: "Active",
    notDeployed: "Not deployed",
  },
  tabs: {
    preview: "Preview",
    code: "Code",
    deployments: "Deployments",
    settings: "Settings",
  },
  preview: {
    deployingTitle: "Deploying to preview…",
    notDeployedTitle: "Not deployed yet",
    notDeployedBody:
      "Once a deployment finishes the production URL will appear here.",
    iframeTitle: "App preview",
  },
  code: {
    summary: (count: number) =>
      `${count} ${count === 1 ? "file" : "files"}`,
    empty: "No files in this app yet.",
  },
  deployments: {
    heading: "Deployments",
    empty: "No deployments yet.",
    triggeredBy: (agentId: string | null) =>
      agentId ? `triggered by ${agentId.slice(0, 8)}…` : "triggered automatically",
    statusLabels: {
      queued: "Queued",
      building: "Building",
      deployed: "Deployed",
      failed: "Failed",
    },
  },
  settings: {
    heading: "Environment variables",
    keyLabel: "Key",
    valueLabel: "Value",
    addCta: "Add variable",
    saveCta: "Save",
    saving: "Saving…",
    deleteCta: "Delete",
    deleting: "Deleting…",
    invalidKey:
      "Keys must be UPPER_SNAKE_CASE — letters, digits, and underscores only.",
    duplicateKey: "That key already exists — pick another or edit the existing row.",
    empty: "No environment variables set yet.",
    note:
      "Edits PATCH the app's env bag and are persisted immediately by plugin-apps-builder (B-03).",
  },
} as const;

export type AppDetailCopy = typeof appDetail;
