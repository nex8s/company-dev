/**
 * Company > Overview / Strategy / Payments / Settings copy — user-facing
 * strings for the four sub-tabs of the company shell (C-05).
 *
 * Every string lives here so the C-14 brand swap is a one-file grep target.
 */

export const companyTabs = {
  overview: {
    hero: {
      activeBadge: "Active",
      onlineLabel: "Online",
      configureCta: "Configure",
      chatCta: "Chat",
    },
    kpis: {
      team: "Team",
      teamSuffix: (working: number) => `/ ${working} working`,
      tasks: "Tasks",
      tasksSuffix: (open: number, blocked: number) =>
        `/ ${open} open · ${blocked} blocked`,
      credits: "Credits",
      creditsSuffix: (spent: number) => `/ $${spent.toFixed(2)} spent`,
      approvals: "Approvals",
      approvalsSuffix: (stale: number) => `/ ${stale} stale`,
    },
    revenue: {
      emptyTitle: "Connect Stripe to see revenue data",
      emptyCta: "Go to Connections",
    },
    aiUsage: {
      spendingLabel: "Spending",
      windowDefault: "Last 60 min",
      bucketDefault: "Minute",
      emptyLine: "No spending data in this window",
      breakdownLabel: "Breakdown",
      chatTokensLabel: "Chat Tokens",
    },
    lists: {
      teamHeading: "TEAM",
      appsHeading: "APPS",
      viewAll: "View all",
      activeBadge: "Active",
      teamMemberBadge: "Team Member",
    },
    error: "Couldn't load overview data.",
  },

  strategy: {
    heading: "Strategy & Context",
    positioningLabel: "Positioning",
    audienceLabel: "Target Audience",
    coreStrategyLabel: "Core Growth Strategy",
    emptyField: "Not set yet — tell the CEO in chat to populate this.",
    activePlansHeading: "ACTIVE PLANS",
    activePlansViewAll: "View all",
    activePlansEmpty: "No active plans yet.",
    planInProgressBadge: "in progress",
    activeAgentsLabel: (n: number) => (n === 1 ? "1 active agent" : `${n} active agents`),
    goalsHeading: "GOALS",
    goalsEmpty:
      "Define your company goals through chat. The CEO will break them down into actionable milestones for your team.",
    goalsCta: "Set goals in chat",
    error: "Couldn't load strategy.",
  },

  payments: {
    emptyTitle: "Connect Stripe to view payments",
    emptyBody:
      "Link your Stripe account to see charges, refunds, and payment activity in one place. Payments flow directly into your connected account.",
    emptyCta: "Go to Connections",
  },

  settings: {
    heading: "Settings",
    tabs: {
      general: "General",
      billing: "Billing",
      team: "Team",
      usage: "Usage",
      server: "Server",
      publishing: "Publishing",
    },
    general: {
      profileHeading: "Company Profile",
      logoLabel: "Company Logo",
      logoUploadCta: "Upload image",
      nameLabel: "Company Name",
      descLabel: "Description",
      descPlaceholder: "Optional company description",
      lifecycleHeading: "Agents Lifecycle",
      boardApprovalLabel: "Require board approval for new hires",
      boardApprovalHint:
        "Agents must ask you before spending credits to spawn new team members.",
      incorporatedLabel: "Is your company incorporated?",
      incorporatedHint:
        "Allow agents to handle legal and tax paperwork.",
      quickNav: {
        domains: "Domains",
        domainsDesc: "Custom email domains",
        virtualCards: "Virtual Cards",
        virtualCardsDesc: "Agent spending cards",
        customDashboards: "Custom Dashboards",
        customDashboardsDesc: "Chat-built pages",
        connections: "Connections",
        connectionsDesc: "Integrations & APIs",
      },
      dangerZone: {
        heading: "Delete Company",
        body: "Permanently destroy this company, all agent memory, files, and tasks. This cannot be undone.",
        cta: (name: string) => `Delete ${name}`,
      },
    },
    placeholder: (tab: string, task: string) =>
      `${tab} lands when ${task} merges.`,
    error: "Couldn't load settings.",
  },
} as const;

export type CompanyTabsCopy = typeof companyTabs;
