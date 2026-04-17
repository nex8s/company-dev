/**
 * C-12 — copy for the 5 Settings sub-pages (Domains, Connections,
 * Custom Dashboards, Virtual Cards, Team).
 */

export const settingsSubpages = {
  common: {
    back: "Back to Settings",
    error: "Couldn't load.",
  },
  domains: {
    heading: "Manage Domains",
    addLabel: "Add domain",
    addCta: "Connect",
    adding: "Connecting…",
    invalidHostname:
      "Enter a hostname like example.com (letters, digits, hyphens, and dots).",
    empty: "No domains connected yet.",
    defaultBadge: "Default",
    setDefaultCta: "Set default",
    settingDefault: "Setting…",
    deleteCta: "Remove",
    deleting: "Removing…",
    statusLabel: (status: string) => status,
    dnsHeading: "DNS records",
  },
  connections: {
    heading: "Connections",
    emptyTitle: "No connections yet",
    emptyBody: "Connect a tool to let agents authenticate against it.",
    listAdaptersHeading: "Available tools",
    connectCta: "Connect",
    cancelCta: "Cancel",
    formLabel: "Label",
    formToken: "Access token",
    formSubmit: "Save connection",
    submitting: "Saving…",
    disconnectCta: "Disconnect",
    disconnecting: "Disconnecting…",
    connectedAt: (iso: string) => new Date(iso).toLocaleDateString(),
    tokenEnding: (last4: string) => `token •••${last4}`,
  },
  dashboards: {
    heading: "Custom Dashboards",
    emptyTitle: "No custom dashboards yet",
    emptyBody:
      "Agents can build and publish dashboards for you — create one here to get started.",
    newCta: "New dashboard",
    newTitleLabel: "Title",
    newSubmit: "Create",
    submitting: "Creating…",
    deleteCta: "Delete",
    deleting: "Deleting…",
    openLabel: "Open",
    widgetCount: (n: number) => (n === 1 ? "1 widget" : `${n} widgets`),
  },
  virtualCards: {
    heading: "Virtual Cards",
    subheading:
      "Virtual cards are scoped to individual agents — open an agent's Virtual Cards tab to issue or freeze their cards.",
    empty: "No agents have issued a card yet.",
    openAgentLabel: "Open agent",
    cardsLabel: (n: number) => (n === 1 ? "1 card" : `${n} cards`),
  },
  team: {
    heading: "Team",
    inviteHeading: "Invite by email",
    inviteEmailLabel: "Email",
    inviteSubmit: "Send invite",
    inviting: "Inviting…",
    invalidEmail: "Enter a valid email address.",
    pendingHeading: "Pending requests",
    pendingEmpty: "No pending join requests.",
    membersHeading: "Members",
    membersEmpty: "No team members yet.",
    humanBadge: "Human",
    agentBadge: "Agent",
    joinedAt: (iso: string) => new Date(iso).toLocaleDateString(),
    approveCta: "Approve",
    rejectCta: "Reject",
  },
} as const;

export type SettingsSubpagesCopy = typeof settingsSubpages;
