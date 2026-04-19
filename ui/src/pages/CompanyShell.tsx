import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { comingSoon } from "@/lib/toast-action";
import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  CircleHelp,
  Database,
  Globe,
  House,
  Info,
  LifeBuoy,
  LogIn,
  Plus,
  PlusCircle,
  Settings,
  SmilePlus,
  Store as StoreIcon,
  Trello,
  X,
} from "lucide-react";
import { Route, Routes, useLocation, useNavigate, useParams } from "@/lib/router";
import { CompanyChat } from "./CompanyChat";
import { CompanyOverview } from "./company-tabs/Overview";
import { CompanyStrategy } from "./company-tabs/Strategy";
import { CompanyPayments } from "./company-tabs/Payments";
import { CompanySettingsTab } from "./company-tabs/Settings";
import { CompanyTasks } from "./company-tabs/Tasks";
import { EmployeeDetail } from "./employee/EmployeeDetail";
import { Store } from "./Store";
import { AppDetail } from "./app-detail/AppDetail";
import { Upgrade } from "./payments/Upgrade";
import { TopUpModal } from "./payments/TopUpModal";
import { Drive } from "./Drive";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { companyShell as copy } from "@/copy/company-shell";
import {
  type CompanyShellChecklist,
  type CompanyShellChecklistStep,
  type CompanyShellCompany,
  type CompanyShellData,
  type CompanyShellDeptGroup,
  type CompanyShellPendingReview,
  useCompanyShellData,
} from "@/hooks/useCompanyShellData";

/**
 * Company shell — C-03. Renders the full left rail (sidebar) + top
 * breadcrumb (sub-tabs) + main content area for every company-scoped view.
 * Route: `/c/:companyId/*`.
 *
 * Data flows through `useCompanyShellData(companyId)` which today returns
 * hand-written mocks, each field tagged with the A- or B- task that will
 * swap it to a live useQuery. That seam is the one place to touch when
 * backend endpoints merge.
 *
 * Shared primitives (per AGENT_C_PROMPT §"Hard rules"):
 * - Popover / PopoverTrigger / PopoverContent from `@/components/ui/popover`
 *   (radix-ui under the hood — no DIY close-on-outside-click).
 * - Collapsible / CollapsibleTrigger / CollapsibleContent for dept groups
 *   and the Getting Started panel.
 *
 * Subsequent tasks fill main-content per tab — C-04 Chat, C-05 Overview/
 * Strategy/Payments/Settings, C-06 Tasks, C-07 Drive, C-08 Store, C-09 Team,
 * C-10 Apps. The tabs row routes between them; until those ship, the main
 * area renders a placeholder that names each outstanding task.
 */

// ---------------------------------------------------------------------------
// Tab model
// ---------------------------------------------------------------------------

const COMPANY_TABS = [
  { id: "chat", path: "", labelKey: "chat" as const },
  { id: "overview", path: "overview", labelKey: "overview" as const },
  { id: "strategy", path: "strategy", labelKey: "strategy" as const },
  { id: "payments", path: "payments", labelKey: "payments" as const },
  { id: "settings", path: "settings", labelKey: "settings" as const },
] as const;

type CompanyTabId = (typeof COMPANY_TABS)[number]["id"];

function activeTabFromPath(pathname: string, companyId: string): CompanyTabId {
  const prefix = `/c/${companyId}`;
  if (!pathname.startsWith(prefix)) return "chat";
  const tail = pathname.slice(prefix.length).replace(/^\/+/, "").split("/")[0];
  const match = COMPANY_TABS.find((t) => t.path === tail);
  return match?.id ?? "chat";
}

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------

export function CompanyShell() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const data = useCompanyShellData(companyId);
  const [topUpOpen, setTopUpOpen] = useState(false);

  if (data.isLoading) {
    return <CompanyShellSkeleton />;
  }
  if (data.error) {
    return <CompanyShellError error={data.error} />;
  }

  return (
    <div
      data-testid="company-shell"
      className="flex h-screen w-full bg-white overflow-hidden"
    >
      <Sidebar data={data} companyId={companyId} onTopUp={() => setTopUpOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Sibling top-level views render their own header chrome — the
            company-sub-tab breadcrumb only shows for /chat /overview
            /strategy /payments /settings. See ShellBreadcrumbSlot. */}
        <ShellBreadcrumbSlot companyId={companyId} />
        <Routes>
          {/* C-04 Chat default; C-05 sub-tabs; C-06 Tasks; C-08 Store;
              C-09 Team; C-10 Apps; C-11 Upgrade. C-07 Drive next. */}
          <Route index element={<CompanyChat />} />
          <Route path="overview" element={<CompanyOverview />} />
          <Route path="strategy" element={<CompanyStrategy />} />
          <Route path="payments" element={<CompanyPayments />} />
          <Route path="settings/*" element={<CompanySettingsTab />} />
          <Route path="tasks" element={<CompanyTasks />} />
          <Route path="team/:agentId/*" element={<EmployeeDetail />} />
          <Route path="store" element={<Store />} />
          <Route path="apps/:appId/*" element={<AppDetail />} />
          <Route path="upgrade" element={<Upgrade />} />
          <Route path="drive" element={<Drive />} />
          <Route path="*" element={<MainContentPlaceholder companyId={companyId} />} />
        </Routes>
      </div>
      <TopUpModal
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        companyId={companyId}
        currentBalance={data.user.credits}
      />
    </div>
  );
}

export default CompanyShell;

function CompanyShellSkeleton() {
  return (
    <div
      data-testid="company-shell-skeleton"
      className="flex h-screen w-full bg-white overflow-hidden"
      role="status"
      aria-busy="true"
    >
      <aside className="w-[260px] h-full border-r border-hairline bg-cream animate-pulse" />
      <div className="flex-1 bg-white animate-pulse" />
    </div>
  );
}

function CompanyShellError({ error }: { error: Error }) {
  return (
    <div
      data-testid="company-shell-error"
      role="alert"
      className="flex h-screen w-full items-center justify-center bg-cream text-ink p-8"
    >
      <div className="max-w-md text-center space-y-2">
        <p className="font-medium">Couldn't load your company.</p>
        <p className="text-sm text-mist">{error.message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({
  data,
  companyId,
  onTopUp,
}: {
  data: CompanyShellData;
  companyId: string;
  onTopUp: () => void;
}) {
  return (
    <aside
      data-testid="company-sidebar"
      className="w-[260px] h-full flex flex-col border-r border-hairline bg-cream z-20 flex-shrink-0"
    >
      <div className="mx-2 mt-2">
        <CompanySwitcher
          active={data.company}
          companies={data.companies}
        />
      </div>

      <div className="px-3 mt-1 space-y-1.5">
        {data.ceo.statusLabel !== "Idle" && (
          <div className="w-full bg-black text-white rounded-full py-1.5 px-3 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-600 border border-black flex items-center justify-center text-[8px]">N</span>
              <span>Naive is working</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <ChevronUp className="size-3" />
            </span>
          </div>
        )}
        <ReviewPill pending={data.pendingReviews} />
      </div>

      <nav
        aria-label="Company sidebar"
        className="mt-4 px-2 space-y-0.5 flex-1 overflow-y-auto"
      >
        <SidebarPrimaryNav companyId={companyId} />
        <AppsSection apps={data.apps} companyId={companyId} />
        <TeamSection ceo={data.ceo} departments={data.departments} companyId={companyId} />
        <GettingStartedPanel checklist={data.gettingStarted} />
      </nav>

      <SidebarFooter
        trialDaysLeft={data.company.trialDaysLeft}
        user={data.user}
        companyId={companyId}
        onTopUp={onTopUp}
      />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Company switcher popover
// ---------------------------------------------------------------------------

function CompanySwitcher({
  active,
  companies,
}: {
  active: CompanyShellCompany;
  companies: CompanyShellCompany[];
}) {
  const navigate = useNavigate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={copy.companySwitcher.triggerLabel}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-black/5 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-5 h-5 text-ink" strokeWidth={1.5} />
            <span className="text-mist">/</span>
            <div className="w-4 h-4 rounded bg-white border border-hairline flex items-center justify-center text-[10px]">
              {active.icon}
            </div>
            <span className="font-medium truncate">{active.name}</span>
          </div>
          <ChevronsUpDown className="size-3 text-mist flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-1 rounded-xl border-hairline"
      >
        {companies.map((c) => {
          const isActive = c.id === active.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !isActive && navigate(`/c/${c.id}`)}
              aria-current={isActive ? "true" : undefined}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between rounded-md ${
                isActive ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-white border border-hairline flex items-center justify-center text-[10px]">
                  {c.icon}
                </span>
                <span>{c.name}</span>
              </span>
              {isActive && <Check className="size-4" strokeWidth={2.5} />}
            </button>
          );
        })}
        <div className="h-px bg-hairline my-1 mx-2" />
        <button
          type="button"
          onClick={() => comingSoon("Add Company")}
          className="w-full text-left px-3 py-2 text-sm text-mist hover:bg-black/5 rounded-md flex items-center gap-2"
        >
          <Plus className="size-4" />
          {copy.companySwitcher.addCompany}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/c/${active.id}/store`)}
          className="w-full text-left px-3 py-2 text-sm text-mist hover:bg-black/5 rounded-md flex items-center gap-2"
        >
          <StoreIcon className="size-4" />
          {copy.companySwitcher.store}
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Review pill popover
// ---------------------------------------------------------------------------

function ReviewPill({ pending }: { pending: CompanyShellPendingReview[] }) {
  const count = pending.length;
  const summary = count === 0 ? copy.reviewPill.none : copy.reviewPill.summary(count);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={summary}
          className={`w-full rounded-full py-1.5 px-3 flex items-center justify-between text-xs transition-colors ${
            count > 0
              ? "bg-black text-white hover:bg-neutral-800"
              : "bg-black text-white hover:bg-neutral-800"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="flex -space-x-1">
              <span className="w-4 h-4 rounded-full bg-gray-200 border border-black" />
              <span className="w-4 h-4 rounded-full bg-gray-300 border border-black" />
            </span>
            {count > 0 && <span>+{Math.max(count - 1, 0)}</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? "bg-amber-400" : "bg-green-400"}`} />
            <span className="opacity-90">{summary}</span>
            <ChevronUp className="size-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(260px-24px)] p-2 bg-black text-white rounded-2xl border-0 shadow-xl"
      >
        <div className="flex items-center gap-1 px-2 pt-1 pb-2 text-[11px]">
          <button
            type="button"
            onClick={() => comingSoon("Review Tasks filter")}
            className="px-2 py-0.5 rounded-md bg-white/15"
          >
            {copy.reviewPill.tabs.tasks}{" "}
            <span className="opacity-60">({count})</span>
          </button>
          <button
            type="button"
            onClick={() => comingSoon("Review Agents filter")}
            className="px-2 py-0.5 rounded-md text-white/60 hover:text-white"
          >
            {copy.reviewPill.tabs.agents}
          </button>
        </div>
        {count === 0 ? (
          <p className="px-2 py-3 text-[11px] text-white/60">
            {copy.reviewPill.none}
          </p>
        ) : (
          <ul
            aria-label="Pending reviews"
            className="space-y-1.5 max-h-64 overflow-y-auto"
          >
            {pending.map((item) => (
              <li
                key={item.id}
                className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1.5 text-[10px]">
                  <span className="w-1 h-1 rounded-full bg-amber-400" />
                  <span className="font-mono text-white/50">
                    {item.identifier}
                  </span>
                  <span className="ml-auto text-white/60">{item.title}</span>
                </div>
                <p className="text-[11px] mb-1.5">{item.subtitle}</p>
                {item.kind === "review" && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => comingSoon("Reject review")}
                      className="flex-1 px-2 py-1 rounded-md bg-red-500/20 text-red-300 text-[10px] flex items-center justify-center gap-1"
                    >
                      <X className="size-3" />
                      {copy.reviewPill.reject}
                    </button>
                    <button
                      type="button"
                      onClick={() => comingSoon("Approve review")}
                      className="flex-1 px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center gap-1"
                    >
                      <Check className="size-3" />
                      {copy.reviewPill.approve}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => comingSoon("Open all reviews")}
          className="w-full text-center py-2 text-[11px] text-white/60 hover:text-white border-t border-white/10 mt-1"
        >
          {copy.reviewPill.openAll}
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Primary nav + Apps + Team sections
// ---------------------------------------------------------------------------

function SidebarPrimaryNav({ companyId }: { companyId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  // "Company" lights up for any /c/:companyId/* path that is NOT a sibling
  // top-level view. Each sibling button lights up only on its own path.
  const onTasks = path === `/c/${companyId}/tasks`;
  const onStore = path === `/c/${companyId}/store`;
  const onDrive = path === `/c/${companyId}/drive`;
  const onCompany = !onTasks && !onStore && !onDrive;

  return (
    <>
      <SidebarNavItem
        icon={<House className="text-lg" strokeWidth={1.5} />}
        label={copy.nav.company}
        trailing={<ChevronRight className="size-3 text-mist" />}
        active={onCompany}
        onClick={() => navigate(`/c/${companyId}`)}
      />
      <SidebarNavItem
        icon={<Trello className="text-lg" strokeWidth={1.5} />}
        label={copy.nav.tasks}
        trailing={
          <span className="bg-black/5 text-ink text-[10px] px-1.5 py-0.5 rounded-full font-medium">
            1
          </span>
        }
        active={onTasks}
        onClick={() => navigate(`/c/${companyId}/tasks`)}
      />
      <SidebarNavItem
        icon={<Database className="text-lg" strokeWidth={1.5} />}
        label={copy.nav.drive}
        active={onDrive}
        onClick={() => navigate(`/c/${companyId}/drive`)}
      />
      <SidebarNavItem
        icon={<StoreIcon className="text-lg" strokeWidth={1.5} />}
        label={copy.nav.store}
        active={onStore}
        onClick={() => navigate(`/c/${companyId}/store`)}
      />
    </>
  );
}

function SidebarNavItem({
  icon,
  label,
  trailing,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-nav-item={label}
      aria-current={active ? "page" : undefined}
      className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md transition-colors ${
        active ? "text-ink bg-black/5" : "text-mist hover:bg-black/5"
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {trailing}
    </button>
  );
}

function AppsSection({
  apps,
  companyId,
}: {
  apps: CompanyShellData["apps"];
  companyId: string;
}) {
  const navigate = useNavigate();
  if (apps.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="px-2 text-[10px] font-semibold text-mist uppercase tracking-wider mb-2">
        {copy.sections.apps}
      </div>
      {apps.map((app) => (
        <button
          key={app.id}
          type="button"
          data-app-id={app.id}
          onClick={() => navigate(`/c/${companyId}/apps/${app.id}`)}
          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-black/5 group transition-colors"
        >
          <span className="w-6 h-6 rounded bg-black/5 flex items-center justify-center text-mist border border-hairline group-hover:border-black/20">
            <Globe className="size-3.5" />
          </span>
          <span className="flex flex-col overflow-hidden leading-tight">
            <span className="text-xs text-ink truncate">{app.name}</span>
            {app.productionDomain && (
              <span className="text-[10px] text-mist truncate">
                {app.productionDomain}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

function TeamSection({
  ceo,
  departments,
  companyId,
}: {
  ceo: CompanyShellData["ceo"];
  departments: CompanyShellDeptGroup[];
  companyId: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="mt-6">
      <div className="px-2 text-[10px] font-semibold text-mist uppercase tracking-wider mb-2">
        {copy.sections.team}
      </div>

      <button
        type="button"
        data-agent-id={ceo.id}
        onClick={() => navigate(`/c/${companyId}/team/${ceo.id}`)}
        className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-black/5"
      >
        <span className="flex items-center gap-2">
          <Building2 className="size-3.5 text-ink" strokeWidth={1.5} />
          <span className="text-xs text-ink">
            {ceo.displayName} {copy.sections.ceoSuffix}
          </span>
        </span>
        <span className="text-[10px] text-mist">
          {ceo.statusLabel === "Idle" ? ceo.updatedAgo : "Your AI CEO"}
        </span>
      </button>

      {departments.map((dept) => (
        <DeptGroup key={dept.department} dept={dept} companyId={companyId} />
      ))}
    </div>
  );
}

function DeptGroup({
  dept,
  companyId,
}: {
  dept: CompanyShellDeptGroup;
  companyId: string;
}) {
  const navigate = useNavigate();
  const title = copy.departmentTitles[dept.department];
  return (
    <Collapsible data-testid={`dept-${dept.department}`}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-black/5 text-xs text-mist group"
        >
          <span className="flex items-center gap-2">
            <ChevronRight className="size-2.5 transition-transform group-data-[state=open]:rotate-90" />
            <span className="uppercase tracking-wider text-[10px] font-semibold text-mist">
              {title}
            </span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] ${
              dept.hasReviewPending
                ? "bg-red-100 text-red-600"
                : "bg-black/5"
            }`}
          >
            {dept.count}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col pl-6 pr-2 py-1 space-y-1">
        {dept.agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            data-agent-id={agent.id}
            onClick={() => navigate(`/c/${companyId}/team/${agent.id}`)}
            className="text-left flex flex-col py-1 text-xs text-ink hover:bg-black/5 rounded-md px-2"
          >
            <span className="truncate">{agent.displayName}</span>
            <span className="text-[10px] text-mist truncate">
              {agent.statusLabel}
            </span>
          </button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Getting Started panel — A-04 stub
// ---------------------------------------------------------------------------

function GettingStartedPanel({ checklist }: { checklist: CompanyShellChecklist }) {
  const { completed, total, steps } = checklist;
  const progress = total === 0 ? 0 : (completed / total) * 100;

  return (
    <Collapsible
      data-testid="getting-started-panel"
      defaultOpen
      className="mt-6 mx-2 border border-black/10 rounded-lg bg-white overflow-hidden shadow-sm"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 bg-black/5 text-xs font-semibold group"
        >
          <span>{copy.gettingStarted.heading(completed, total)}</span>
          <ChevronUp className="size-3 transition-transform group-data-[state=closed]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col p-2 space-y-1.5 text-[11px] text-mist">
        {steps.map((step) => (
          <GettingStartedRow key={step.key} step={step} />
        ))}
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 w-full bg-black/5 rounded-full mt-2 overflow-hidden"
        >
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function GettingStartedRow({ step }: { step: CompanyShellChecklistStep }) {
  const label = copy.gettingStarted.steps[step.key];
  const isDone = step.completedAt !== null;
  if (isDone) {
    return (
      <div
        role="listitem"
        aria-label={copy.gettingStarted.doneAria}
        className="flex items-start gap-2 bg-emerald-500/10 p-1 -mx-1 rounded line-through text-emerald-600 opacity-80"
      >
        <span className="w-3 h-3 rounded-sm bg-emerald-500 text-white flex items-center justify-center mt-0.5 flex-shrink-0">
          <Check className="size-2" strokeWidth={3} />
        </span>
        <span className="flex-1">{label}</span>
      </div>
    );
  }
  return (
    <div
      role="listitem"
      aria-label={copy.gettingStarted.pendingAria}
      className="flex items-start gap-2 group px-1"
    >
      <span className="w-3 h-3 rounded-sm border border-black/20 mt-0.5 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      <Info className="size-3 opacity-50 text-mist" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar footer — trial badge + user menu
// ---------------------------------------------------------------------------

function SidebarFooter({
  trialDaysLeft,
  user,
  companyId,
  onTopUp,
}: {
  trialDaysLeft: number;
  user: CompanyShellData["user"];
  companyId: string;
  onTopUp: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="p-4 border-t border-hairline bg-cream space-y-3">
      <div className="flex items-center justify-between text-xs px-2">
        <span className="flex items-center gap-1.5 text-mist">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {copy.trial.label(trialDaysLeft)}
        </span>
        <button
          type="button"
          data-testid="trial-subscribe-link"
          onClick={() => navigate(`/c/${companyId}/upgrade`)}
          className="font-medium hover:underline text-ink"
        >
          {copy.trial.subscribe}
        </button>
      </div>
      <UserMenu user={user} companyId={companyId} onTopUp={onTopUp} />
    </div>
  );
}

function UserMenu({
  user,
  companyId,
  onTopUp,
}: {
  user: CompanyShellData["user"];
  companyId: string;
  onTopUp: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="User menu"
          className="w-full flex items-center justify-between hover:bg-black/5 p-2 rounded-lg transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-medium border border-black/10">
              {user.initials}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium">{user.fullName}</span>
              <span className="text-xs text-mist">
                {copy.userMenu.credits(user.credits)}
              </span>
            </span>
          </span>
          <ChevronUp className="size-3 text-mist" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[260px] p-1.5 rounded-xl border-hairline"
      >
        <div className="px-3 py-2 border-b border-hairline mb-1">
          <p className="text-xs text-mist truncate">{user.email}</p>
          <p className="text-sm font-medium mt-0.5">
            {copy.userMenu.creditsHeading(user.credits)}
          </p>
        </div>
        <UserMenuItem
          data-testid="usermenu-upgrade"
          onClick={() => navigate(`/c/${companyId}/upgrade`)}
          className="bg-ink text-cream hover:bg-neutral-900 mb-1"
        >
          {copy.userMenu.upgradePlan}
        </UserMenuItem>
        <UserMenuItem
          data-testid="usermenu-topup"
          onClick={onTopUp}
        >
          <PlusCircle className="size-4 text-mist" />
          {copy.userMenu.topUpCredits}
        </UserMenuItem>
        <UserMenuItem onClick={() => comingSoon("Emoji & Icons")}>
          <SmilePlus className="size-4 text-mist" />
          {copy.userMenu.emojiIcons}
        </UserMenuItem>
        <UserMenuItem onClick={() => navigate(`/c/${companyId}/settings`)}>
          <Settings className="size-4 text-mist" />
          {copy.userMenu.settings}
        </UserMenuItem>
        <div className="h-px bg-hairline my-1 mx-2" />
        <UserMenuItem onClick={() => comingSoon("Support")}>
          <LifeBuoy className="size-4" />
          {copy.userMenu.support}
        </UserMenuItem>
        <UserMenuItem onClick={() => comingSoon("Sign out")}>
          <LogIn className="size-4" />
          {copy.userMenu.signOut}
          <ArrowUpRight className="size-3 ml-auto" />
        </UserMenuItem>
      </PopoverContent>
    </Popover>
  );
}

function UserMenuItem({
  className = "",
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 rounded-md flex items-center gap-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Top breadcrumb (sub-tabs) + main content placeholder
// ---------------------------------------------------------------------------

/**
 * Shell-level breadcrumb slot. The 5 Company sub-tabs only apply to
 * `/c/:companyId/(chat|overview|strategy|payments|settings)` views, so
 * the slot collapses entirely on sibling top-level views (Tasks today;
 * Drive / Store later) — that keeps the page chrome of those views
 * focused on their own headers.
 */
function ShellBreadcrumbSlot({ companyId }: { companyId: string }) {
  const location = useLocation();
  const path = location.pathname;
  // Sibling views render their own header chrome — the company-sub-tab
  // breadcrumb doesn't apply. Tasks (C-06), Employee Detail (C-09),
  // Store (C-08), App Detail (C-10), Upgrade (C-11), Drive (C-07).
  const isSiblingView =
    path === `/c/${companyId}/tasks` ||
    path === `/c/${companyId}/store` ||
    path === `/c/${companyId}/upgrade` ||
    path === `/c/${companyId}/drive` ||
    path.startsWith(`/c/${companyId}/team/`) ||
    path.startsWith(`/c/${companyId}/apps/`);
  if (isSiblingView) return null;
  return <CompanyBreadcrumb companyId={companyId} />;
}

function CompanyBreadcrumb({ companyId }: { companyId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeTabFromPath(location.pathname, companyId);

  return (
    <header
      data-testid="company-breadcrumb"
      className="h-14 border-b border-hairline flex items-center justify-between px-6 bg-cream/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0"
    >
      <nav aria-label="Company tabs" className="flex items-center gap-6 h-full">
        {COMPANY_TABS.map((tab) => {
          const isActive = tab.id === active;
          const href = tab.path
            ? `/c/${companyId}/${tab.path}`
            : `/c/${companyId}`;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(href)}
              aria-current={isActive ? "page" : undefined}
              data-tab={tab.id}
              className={`h-full px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-mist hover:text-ink"
              }`}
            >
              {copy.breadcrumb.tabs[tab.labelKey]}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function MainContentPlaceholder({ companyId }: { companyId: string }) {
  return (
    <main
      id="main-content"
      className="flex-1 overflow-y-auto p-6 bg-white"
      data-testid="company-main"
      data-company-id={companyId}
    >
      <div className="max-w-xl mx-auto mt-24 text-center space-y-2">
        <CircleHelp className="size-6 mx-auto text-mist" />
        <p className="text-sm text-mist">{copy.mainContent.placeholder}</p>
      </div>
    </main>
  );
}
