/**
 * Company shell data — fetches from real Paperclip + plugin-company APIs.
 * Replaces the mock-seam hook that C-03 shipped.
 */

import { useEffect, useState } from "react";

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

export type CompanyShellStepKey =
  | "incorporate"
  | "domain"
  | "email_inboxes"
  | "stripe_billing"
  | "deploy_first_app"
  | "google_search_console"
  | "custom_dashboard_pages";

export interface CompanyShellChecklistStep {
  readonly key: CompanyShellStepKey;
  readonly title: string;
  readonly completedAt: Date | null;
}

export interface CompanyShellChecklist {
  readonly companyId: string;
  readonly completed: number;
  readonly total: number;
  readonly steps: readonly CompanyShellChecklistStep[];
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
  gettingStarted: CompanyShellChecklist;
  user: CompanyShellUser;
  isLoading: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Defaults (shown while loading)
// ---------------------------------------------------------------------------

const EMPTY_COMPANY: CompanyShellCompany = {
  id: "",
  name: "Loading…",
  icon: "🏢",
  trialState: "trial",
  trialDaysLeft: 5,
};

const EMPTY_CEO: CompanyShellAgent = {
  id: "",
  displayName: "Naive",
  statusLabel: "Idle",
  updatedAgo: "",
};

const EMPTY_CHECKLIST: CompanyShellChecklist = {
  companyId: "",
  completed: 0,
  total: 7,
  steps: [],
};

const EMPTY_USER: CompanyShellUser = {
  fullName: "User",
  email: "",
  initials: "U",
  credits: 0,
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const DEPT_ORDER: CompanyShellDeptGroup["department"][] = [
  "engineering", "marketing", "operations", "sales", "support",
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompanyShellData(companyId: string): CompanyShellData {
  const [data, setData] = useState<CompanyShellData>({
    company: { ...EMPTY_COMPANY, id: companyId },
    companies: [],
    ceo: EMPTY_CEO,
    departments: DEPT_ORDER.map((d) => ({ department: d, count: 0, hasReviewPending: false, agents: [] })),
    apps: [],
    pendingReviews: [],
    gettingStarted: EMPTY_CHECKLIST,
    user: EMPTY_USER,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Fetch in parallel
      const [companiesRaw, companyRaw, agentsRaw, checklistRaw, reviewsRaw, appsRaw, sessionRaw] =
        await Promise.all([
          fetchJson<any[]>("/api/companies"),
          fetchJson<any>(`/api/companies/${companyId}`),
          fetchJson<any[]>(`/api/companies/${companyId}/agents`),
          fetchJson<any>(`/api/companies/${companyId}/plugin-company/checklist`),
          fetchJson<any>(`/api/companies/${companyId}/plugin-company/reviews/pending`),
          fetchJson<any[]>(`/api/companies/${companyId}/plugin-apps-builder/apps`).catch(() => null),
          fetchJson<any>("/api/auth/get-session"),
        ]);

      if (cancelled) return;

      // Companies
      const companies: CompanyShellCompany[] = (companiesRaw ?? [])
        .filter((c: any) => c.status === "active")
        .map((c: any) => ({
          id: c.id,
          name: c.name || "Unnamed",
          icon: "🏢",
          trialState: "trial" as TrialState,
          trialDaysLeft: 5,
        }));

      // Current company
      const company: CompanyShellCompany = companyRaw
        ? { id: companyRaw.id, name: companyRaw.name, icon: "🏢", trialState: "trial", trialDaysLeft: 5 }
        : companies.find((c) => c.id === companyId) ?? { ...EMPTY_COMPANY, id: companyId };

      // Agents → CEO + departments
      const agents: any[] = agentsRaw ?? [];
      const ceoAgent = agents.find((a) => a.role === "ceo" || a.name?.toLowerCase() === "naive");
      const ceo: CompanyShellAgent = ceoAgent
        ? { id: ceoAgent.id, displayName: ceoAgent.name, statusLabel: ceoAgent.status === "active" ? "Working" : "Idle", updatedAgo: timeAgo(ceoAgent.updatedAt || ceoAgent.createdAt) }
        : EMPTY_CEO;

      const departments: CompanyShellDeptGroup[] = DEPT_ORDER.map((dept) => {
        const deptAgents = agents.filter((a) =>
          a.role === dept ||
          a.runtimeConfig?.department === dept ||
          a.metadata?.department === dept
        );
        return {
          department: dept,
          count: deptAgents.length,
          hasReviewPending: false,
          agents: deptAgents.map((a: any) => ({
            id: a.id,
            displayName: a.name,
            statusLabel: a.status === "active" ? "Working" : "Idle",
            updatedAgo: timeAgo(a.updatedAt || a.createdAt),
          })),
        };
      });

      // Apps
      const apps: CompanyShellApp[] = (appsRaw ?? []).map((a: any) => ({
        id: a.id,
        name: a.name || "App",
        productionDomain: a.productionDomain || a.domain || null,
      }));

      // Checklist
      const gettingStarted: CompanyShellChecklist = checklistRaw
        ? {
            companyId: checklistRaw.companyId || companyId,
            completed: checklistRaw.completed ?? 0,
            total: checklistRaw.total ?? 7,
            steps: (checklistRaw.steps ?? []).map((s: any) => ({
              key: s.key,
              title: s.title || s.key,
              completedAt: s.completedAt ? new Date(s.completedAt) : null,
            })),
          }
        : EMPTY_CHECKLIST;

      // Reviews
      const reviewsArray = reviewsRaw?.reviews ?? reviewsRaw ?? [];
      const pendingReviews: CompanyShellPendingReview[] = (Array.isArray(reviewsArray) ? reviewsArray : []).map(
        (r: any) => ({
          id: r.id || r.review?.id || "",
          identifier: r.identifier || r.issue?.issuePrefix || "",
          title: r.title || r.issue?.title || "Review",
          subtitle: r.subtitle || "",
          actor: r.actor || r.submittedByAgentName || "",
          kind: "review" as const,
        }),
      );

      // User
      const user: CompanyShellUser = sessionRaw?.user
        ? {
            fullName: sessionRaw.user.name || sessionRaw.user.email || "User",
            email: sessionRaw.user.email || "",
            initials: (sessionRaw.user.name || sessionRaw.user.email || "U").slice(0, 2).toUpperCase(),
            credits: 15.25, // TODO: fetch from plugin-payments credit balance
          }
        : EMPTY_USER;

      setData({
        company,
        companies,
        ceo,
        departments,
        apps,
        pendingReviews,
        gettingStarted,
        user,
        isLoading: false,
        error: null,
      });
    }

    load().catch((err) => {
      if (!cancelled) {
        setData((prev) => ({ ...prev, isLoading: false, error: err }));
      }
    });

    // Poll every 5s for updates
    const interval = setInterval(() => { load(); }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [companyId]);

  return data;
}
