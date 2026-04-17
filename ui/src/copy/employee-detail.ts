/**
 * Company > Team > Employee detail copy — user-facing strings for
 * `ui/src/pages/employee/EmployeeDetail.tsx` and its 9 tab components.
 *
 * Tab label keys are shared: the tab strip reads from `tabs[id]`, and
 * the page chrome reads the heading / breadcrumb back copy from `page`.
 */

export const employeeDetail = {
  page: {
    backToTeam: "Team",
    configureCta: "Configure",
    chatCta: "Chat",
    notFoundTitle: "Agent not found",
    notFoundBody: (id: string) =>
      `No agent with id "${id}" lives in this company.`,
  },

  tabs: {
    profile: "Profile",
    chat: "Chat",
    browser: "Browser",
    phone: "Phone",
    workspace: "Workspace",
    virtualCards: "Virtual Cards",
    inbox: "Inbox",
    compute: "Compute",
    settings: "Settings",
  },

  profile: {
    identityHeading: "Identity Overview",
    emailLabel: "Email",
    phoneLabel: "Phone",
    legalEntityLabel: "Legal Entity",
    notAvailable: "N/A",
    computeHeading: "Compute (Current Period)",
    recursiveHeading: "RECURSIVE INTELLIGENCE",
    recursiveEmptyCeo: "No loops or cycles have been created yet.",
    recursiveTitleDept: "Recursive Intelligence Network",
    recursiveTagline: "Learns from every cycle. Gets sharper every run.",
    nodes: {
      reason: { title: "Reason", hint: "Aggregate all context" },
      act: { title: "Act", hint: "Execute & deliver" },
      observe: { title: "Observe", hint: "Analyse KPIs & signals" },
      learn: { title: "Learn", hint: "Refine & remember" },
    },
    innerTabs: {
      tasks: "Tasks",
      activity: "Activity",
      learnings: "Learnings",
      tools: "Tools",
    },
    currentlyWorkingOnTitle: "Currently Working On",
    noActiveTasks: "No active tasks.",
    activeBadge: (n: number) => `${n} active`,
  },

  chat: {
    heading: "Chat with {agent}",
    placeholder:
      "Ask a follow-up or start a new plan… · Type @ to mention a teammate",
    stubNote:
      "The per-agent channel will use the same composer as the company chat (C-04). Stub until the per-agent chat thread endpoint lands.",
  },

  browser: {
    heading: "Browser",
    inactiveTitle: "No active browser session",
    inactiveBody:
      "Start a run with browser tooling and a live-view URL will appear here. BrowserProvider is in place (B-12); the HTTP route is scheduled for a later task.",
    startCta: "Start browser session",
    liveLabel: "Live view",
    artifactsHeading: "Session artifacts",
  },

  phone: {
    heading: "Phone",
    emptyTitle: "No phone number claimed",
    emptyBody:
      "Claim a number to let this agent send SMS and voice. PhoneProvider ships as part of plugin-identity's email/phone rollout (B-11).",
    claimCta: "Claim a number",
    stubBadge: "stub · B-11",
  },

  workspace: {
    heading: "Workspace",
    filesTab: "Files",
    skillsTab: "Skills",
    emptyFiles: "No files in this workspace yet.",
    emptySkills: "No skills attached to this agent yet.",
  },

  virtualCards: {
    heading: "Virtual Cards",
    empty: "This agent has no virtual cards yet.",
    issueCta: "Issue virtual card",
    issuing: "Issuing…",
    freezeCta: "Freeze",
    freezing: "Freezing…",
    frozenBadge: "Frozen",
    activeBadge: "Active",
    closedBadge: "Closed",
    loading: "Loading cards…",
    error: "Couldn't load virtual cards.",
    last4Label: (last4: string) => `ending ${last4}`,
    limitLabel: (usd: number | null) =>
      usd === null ? "No spending limit" : `$${usd.toFixed(2)} / mo limit`,
    spentLabel: (usd: number) => `$${usd.toFixed(2)} spent`,
  },

  inbox: {
    heading: "Inbox",
    subheading: (name: string) => `Emails received by ${name}`,
    inboxLabel: "Inbox",
    emptyTitle: "No emails yet",
    emptyBody: "Emails sent to this address will appear here",
    openHint: "Select an email",
    openHintBody: "Choose an email from the left to read it",
    stubBadge: "stub · EmailProvider HTTP (TBD)",
  },

  compute: {
    heading: "Compute",
    subheading: "Usage, budget, and compute resources",
    currentPeriodLabel: "Current Period",
    statusLabel: "Status",
    budgetLabel: "Monthly Budget",
    budgetPlaceholder: "No limit",
    pauseCta: "Pause",
    tableResource: "Resource",
    tableUsage: "Usage",
    tableCredits: "Credits",
    creditsUnit: "credits",
    stubNote:
      "Live credit feed wires to A-07 once the per-agent budget endpoint lands.",
  },

  settings: {
    heading: "Settings",
    displayNameLabel: "Display name",
    departmentLabel: "Department",
    iconLabel: "Icon",
    statusLabel: "Status",
    budgetLabel: "Monthly budget (credits)",
    runtimeConfigLabel: "Runtime config",
    saveCta: "Save",
    dangerHeading: "Remove agent",
    dangerBody:
      "Removing an agent permanently deletes its runtime config, credits, and memory. Review logs before confirming.",
    dangerCta: (name: string) => `Remove ${name}`,
    stubNote:
      "Persisting edits lives in A-03 follow-up; today the form is read-through.",
  },
} as const;

export type EmployeeDetailCopy = typeof employeeDetail;
