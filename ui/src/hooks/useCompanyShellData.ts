/**
 * Single-hook facade for every piece of data the C-03 company shell needs.
 *
 * Today this returns hand-written mocks so the shell can render + be tested
 * in isolation. Every field is marked with the task that will swap it to a
 * live query. When those tasks merge, replace each block with `useQuery`
 * against the corresponding endpoint and delete the mock.
 */

export type TrialState = "trial" | "active" | "expired" | "paused";

export interface CompanyShellCompany {
  id: string;
  name: string;
  icon: string;
  trialState: TrialState;
  trialDaysLeft: number;
}

export interface CompanyShellAgent {
  id: string;
  displayName: string;
  statusLabel: string;
  updatedAgo: string;
}

export interface CompanyShellDeptGroup {
  /** One of the HIREABLE_DEPARTMENTS from @paperclipai/plugin-company. */
  department: "engineering" | "marketing" | "operations" | "sales" | "support";
  count: number;
  hasReviewPending: boolean;
  agents: CompanyShellAgent[];
}

export interface CompanyShellApp {
  id: string;
  name: string;
  productionDomain: string | null;
}

export interface CompanyShellPendingReview {
  id: string;
  identifier: string;
  title: string;
  subtitle: string;
  actor: string;
  kind: "review" | "todo";
}

export interface CompanyShellGettingStartedStep {
  id:
    | "incorporate"
    | "domain"
    | "emailInboxes"
    | "stripe"
    | "deploy"
    | "searchConsole"
    | "dashboards";
  done: boolean;
}

export interface CompanyShellUser {
  fullName: string;
  email: string;
  initials: string;
  credits: number;
}

export interface CompanyShellData {
  company: CompanyShellCompany;
  companies: CompanyShellCompany[];
  ceo: CompanyShellAgent;
  departments: CompanyShellDeptGroup[];
  apps: CompanyShellApp[];
  pendingReviews: CompanyShellPendingReview[];
  gettingStarted: CompanyShellGettingStartedStep[];
  user: CompanyShellUser;
  isLoading: boolean;
  error: Error | null;
}

// TODO(A-02 HTTP): swap for `useQuery(plugin-company.listCompanies(userId))`.
const MOCK_COMPANIES: CompanyShellCompany[] = [
  { id: "company-x", name: "Company X", icon: "🏢", trialState: "trial", trialDaysLeft: 5 },
];

// TODO(A-03 HTTP): swap for `useQuery(plugin-company.findCeo(companyId))`.
const MOCK_CEO: CompanyShellAgent = {
  id: "agent-ceo",
  displayName: "Naive",
  statusLabel: "Idle",
  updatedAgo: "2d",
};

// TODO(A-03 HTTP): swap for `useQuery(plugin-company.listAgents(companyId))`
// keyed by department — reuses the HIREABLE_DEPARTMENTS contract.
const MOCK_DEPARTMENTS: CompanyShellDeptGroup[] = [
  {
    department: "engineering",
    count: 1,
    hasReviewPending: false,
    agents: [
      { id: "agent-lpe", displayName: "Landing Page Engineer", statusLabel: "Deploying", updatedAgo: "2d" },
    ],
  },
  {
    department: "marketing",
    count: 2,
    hasReviewPending: true,
    agents: [
      { id: "agent-gm", displayName: "Growth Marketer", statusLabel: "Drafting GTM plan", updatedAgo: "15m" },
    ],
  },
  {
    department: "operations",
    count: 1,
    hasReviewPending: false,
    agents: [
      { id: "agent-fl", displayName: "Finance & Legal Officer", statusLabel: "Idle", updatedAgo: "1d" },
    ],
  },
  {
    department: "sales",
    count: 1,
    hasReviewPending: false,
    agents: [
      { id: "agent-sl", displayName: "Sales Lead", statusLabel: "Idle", updatedAgo: "1d" },
    ],
  },
  {
    department: "support",
    count: 1,
    hasReviewPending: false,
    agents: [
      { id: "agent-cs", displayName: "Customer Support", statusLabel: "Idle", updatedAgo: "3d" },
    ],
  },
];

// TODO(B-02 HTTP): swap for `useQuery(plugin-apps-builder.listApps(companyId))`.
const MOCK_APPS: CompanyShellApp[] = [
  { id: "app-landing", name: "Landing Page", productionDomain: "landing-page.vercel.app" },
];

// TODO(A-05 HTTP): swap for `useQuery(plugin-company.listPendingReviews(companyId))`.
// A-05 gate: submit a task as pending → appears here; approve removes it.
const MOCK_PENDING_REVIEWS: CompanyShellPendingReview[] = [
  {
    id: "pr-1",
    identifier: "COMPANY-1",
    title: "Create Content Calendar",
    subtitle: "Review · Growth Marketer",
    actor: "Growth Marketer",
    kind: "review",
  },
];

// TODO(A-04 HTTP): swap for `useQuery(plugin-company.getGettingStarted(companyId))`.
// Static preview until A-04's 7-step state machine lands — exactly one step
// complete (the "deploy" step) matches the prototype's 1/7 default.
const MOCK_GETTING_STARTED: CompanyShellGettingStartedStep[] = [
  { id: "incorporate", done: false },
  { id: "domain", done: false },
  { id: "emailInboxes", done: false },
  { id: "stripe", done: false },
  { id: "deploy", done: true },
  { id: "searchConsole", done: false },
  { id: "dashboards", done: false },
];

// TODO(Paperclip auth): swap for the existing `authApi.getSession` query
// already wired in App.tsx's CloudAccessGate — once the shell mounts behind
// the gate this becomes useQuery(queryKeys.auth.session) + budget fetch.
const MOCK_USER: CompanyShellUser = {
  fullName: "Nicole Mayer",
  email: "nicolemayerwork@gmail.com",
  initials: "NI",
  credits: 15.25,
};

/**
 * Build the shell data view for a given company. All returned values are
 * stable references so React re-renders cheaply; when swapping to
 * useQuery, preserve that by passing `placeholderData` or memoising.
 */
export function useCompanyShellData(companyId: string): CompanyShellData {
  const company =
    MOCK_COMPANIES.find((c) => c.id === companyId) ?? MOCK_COMPANIES[0];
  return {
    company,
    companies: MOCK_COMPANIES,
    ceo: MOCK_CEO,
    departments: MOCK_DEPARTMENTS,
    apps: MOCK_APPS,
    pendingReviews: MOCK_PENDING_REVIEWS,
    gettingStarted: MOCK_GETTING_STARTED,
    user: MOCK_USER,
    isLoading: false,
    error: null,
  };
}
