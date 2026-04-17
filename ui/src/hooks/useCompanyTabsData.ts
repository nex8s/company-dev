/**
 * Single-hook facade for the Company > Overview / Strategy / Payments /
 * Settings tabs (C-05). Mirrors the seam pattern established in C-03's
 * useCompanyShellData and C-04's useCompanyChat: mock data today, typed
 * for the wire shape the corresponding A- / B- task will supply.
 *
 * Swap points (marked inline):
 *  - overview.revenue / overview.usage  → B-07 Stripe connection (revenue),
 *    A-07 credits + runs (AI spend)
 *  - strategy                           → A-02 CompanyProfile select by id
 *  - settings.general                   → A-02 CompanyProfile fields (same)
 *  - plans / goals                      → future plugin-company endpoints
 */

export interface CompanyHero {
  id: string;
  /** Two-letter monogram rendered in the hero tile. */
  monogram: string;
  name: string;
  description: string | null;
  isOnline: boolean;
  isActive: boolean;
}

export interface CompanyKpis {
  teamTotal: number;
  teamWorking: number;
  tasksDone: number;
  tasksOpen: number;
  tasksBlocked: number;
  creditsRemaining: number;
  creditsSpent: number;
  approvalsPending: number;
  approvalsStale: number;
}

export interface AiUsageBreakdownItem {
  label: string;
  credits: number;
}

export interface AiUsage {
  totalSpent: number;
  window: string;
  bucket: string;
  breakdown: readonly AiUsageBreakdownItem[];
  hasData: boolean;
}

export interface OverviewListTeamMember {
  id: string;
  name: string;
  department: string;
}

export interface OverviewListApp {
  id: string;
  name: string;
  productionDomain: string | null;
  isActive: boolean;
}

export interface OverviewData {
  hero: CompanyHero;
  kpis: CompanyKpis;
  revenueConnected: boolean;
  aiUsage: AiUsage;
  team: readonly OverviewListTeamMember[];
  apps: readonly OverviewListApp[];
}

export interface ActivePlan {
  id: string;
  name: string;
  description: string;
  status: "in_progress" | "paused" | "done";
  completed: number;
  total: number;
  activeAgents: number;
}

export interface StrategyData {
  /** All four fields map 1:1 to A-02's CompanyProfile columns. */
  positioning: string | null;
  targetAudience: string | null;
  coreStrategy: string | null;
  activePlans: readonly ActivePlan[];
  goalsCount: number;
}

export interface SettingsGeneralData {
  /** Logo as a URL or `null` → renders monogram placeholder. */
  logoUrl: string | null;
  monogram: string;
  name: string;
  description: string;
  boardApprovalRequired: boolean;
  incorporated: boolean;
}

export interface CompanyTabsData {
  overview: OverviewData;
  strategy: StrategyData;
  settings: SettingsGeneralData;
  isLoading: boolean;
  error: Error | null;
}

// TODO(A-03/A-05/A-07 HTTP): replace these with real queries.
const MOCK_OVERVIEW: OverviewData = {
  hero: {
    id: "company-x",
    monogram: "CO",
    name: "company x",
    description:
      "An AI-powered newsletter business focused on content creation, audience growth, and monetization through subscriptions and sponsorships.",
    isOnline: true,
    isActive: true,
  },
  kpis: {
    teamTotal: 6,
    teamWorking: 0,
    tasksDone: 0,
    tasksOpen: 4,
    tasksBlocked: 0,
    creditsRemaining: 15.25,
    creditsSpent: 4.75,
    approvalsPending: 0,
    approvalsStale: 0,
  },
  revenueConnected: false,
  aiUsage: {
    totalSpent: 4.75,
    window: "Last 60 min",
    bucket: "Minute",
    breakdown: [{ label: "Chat Tokens", credits: 4.75 }],
    hasData: false,
  },
  team: [
    { id: "agent-lpe", name: "Landing Page Engineer", department: "Engineering" },
  ],
  apps: [
    {
      id: "app-landing",
      name: "Landing Page",
      productionDomain: "landing-page.vercel.app",
      isActive: true,
    },
  ],
};

// TODO(A-02 HTTP): replace with `useQuery(plugin-company.getCompanyProfile(id))`.
// Fields here map 1:1 to company_profiles columns (see
// packages/db/src/schema/company_profiles.ts): positioning, target_audience,
// strategy_text — nullable in the DB, nullable here.
const MOCK_STRATEGY: StrategyData = {
  positioning:
    "A smart AI-assisted newsletter operating at the intersection of media and automated content generation, delivering daily synthesized insights faster than traditional pubs.",
  targetAudience:
    "Professionals and enthusiasts interested in high-quality, AI-curated newsletter content who value signal over noise.",
  coreStrategy:
    "Content-first growth: launch with a polished newsletter, grow the subscriber base via organic and outbound channels, monetize through paid tiers and sponsorships.",
  activePlans: [
    {
      id: "plan-1",
      name: "AI-Powered Newsletter Business Launch",
      description:
        "Standing up the full newsletter business, establishing the platform, configuring the team, and generating initial collateral.",
      status: "in_progress",
      completed: 0,
      total: 5,
      activeAgents: 1,
    },
  ],
  goalsCount: 0,
};

// TODO(A-02 HTTP): replace with CompanyProfile fields. `name`, `description`,
// `incorporated`, `logoUrl` all live in company_profiles already.
// `boardApprovalRequired` is a future column — today it's a UI-only toggle
// with default true (mirrors the prototype's "on" state).
const MOCK_SETTINGS: SettingsGeneralData = {
  logoUrl: null,
  monogram: "CO",
  name: "company x",
  description:
    "An AI-powered newsletter business focused on content creation, audience growth, and monetization through subscriptions and sponsorships.",
  boardApprovalRequired: true,
  incorporated: false,
};

/**
 * Hook-seam facade for all company sub-tab data. Exposes one loading state
 * and one error across the panel set so the tab implementations stay thin
 * and the A-02 / A-07 / B-07 swaps land in one place.
 */
export function useCompanyTabsData(_companyId: string): CompanyTabsData {
  return {
    overview: MOCK_OVERVIEW,
    strategy: MOCK_STRATEGY,
    settings: MOCK_SETTINGS,
    isLoading: false,
    error: null,
  };
}
