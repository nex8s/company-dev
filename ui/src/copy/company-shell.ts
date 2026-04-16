/**
 * Company shell copy — sidebar, breadcrumb, review pill, getting-started
 * panel, user menu. Every user-facing string lives here so C-14's brand
 * swap is a one-file grep target.
 */

export const companyShell = {
  companySwitcher: {
    addCompany: "Add company",
    store: "Store",
    triggerLabel: "Switch company",
  },

  reviewPill: {
    summary: (count: number) =>
      count === 1 ? "1 review waiting" : `${count} reviews waiting`,
    none: "No reviews pending",
    tabs: {
      tasks: "Tasks",
      agents: "Agents",
    },
    approve: "Approve",
    reject: "Reject",
    openAll: "Open tasks →",
  },

  nav: {
    company: "Company",
    tasks: "Tasks",
    drive: "Drive",
    store: "Store",
  },

  sections: {
    apps: "Apps",
    team: "Team",
    ceoSuffix: "(CEO)",
  },

  departmentTitles: {
    // Mirrors `@paperclipai/plugin-company`'s DEFAULT_DEPARTMENT_TITLES.
    // Intentionally duplicated here to keep the ui package free of a
    // backend-plugin workspace dep for now — if this list grows or
    // drifts, consolidate into a shared package.
    engineering: "Engineering",
    marketing: "Marketing",
    operations: "Operations",
    sales: "Sales",
    support: "Support",
  },

  gettingStarted: {
    heading: (done: number, total: number) => `${done}/${total} Getting Started`,
    steps: {
      incorporate: "Incorporate Company",
      domain: "Connect or buy a web domain",
      emailInboxes: "Setup email inboxes for agents",
      stripe: "Setup Stripe billing",
      deploy: "Deploy first website or product",
      searchConsole: "Setup Google Search Console",
      dashboards: "Add custom dashboard pages",
    },
    pendingAria: "Pending step",
    doneAria: "Completed step",
  },

  trial: {
    // TODO(C-14): final trial-banner voice from user.
    label: (daysLeft: number) => `Trial · ${daysLeft}d left`,
    subscribe: "Subscribe →",
  },

  userMenu: {
    credits: (n: number) => `${n.toFixed(2)} credits`,
    creditsHeading: (n: number) => `Credits ${n.toFixed(2)}`,
    upgradePlan: "Upgrade Plan",
    topUpCredits: "Top Up Credits",
    emojiIcons: "Use Emoji Icons",
    settings: "Settings",
    support: "Support",
    signOut: "Sign out",
  },

  breadcrumb: {
    tabs: {
      chat: "Chat",
      overview: "Overview",
      strategy: "Strategy",
      payments: "Payments",
      settings: "Settings",
    },
  },

  mainContent: {
    placeholder:
      "Select a tab above to view company details. Each view ships in its own task (C-04 Chat, C-05 Overview/Strategy/Payments/Settings, C-06 Tasks, C-07 Drive, C-08 Store, C-09 Team, C-10 Apps).",
  },
};

export type CompanyShellCopy = typeof companyShell;
