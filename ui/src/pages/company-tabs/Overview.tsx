import { CreditCard, Globe } from "lucide-react";
import { useParams, useNavigate } from "@/lib/router";
import { companyTabs as copy } from "@/copy/company-tabs";
import { useCompanyTabsData, type OverviewData } from "@/hooks/useCompanyTabsData";

/**
 * Company > Overview — C-05 tab 1. Hero + 4 KPIs + Revenue card (Stripe
 * empty state) + AI Usage card + Team/Apps lists.
 *
 * All data comes from `useCompanyTabsData` which is a thin mock seam
 * today; swap points are flagged in the hook.
 */
export function CompanyOverview() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const data = useCompanyTabsData(companyId);

  if (data.isLoading) return <OverviewSkeleton />;
  if (data.error) return <OverviewError message={copy.overview.error} />;

  return (
    <main
      id="main-content"
      data-testid="company-overview"
      className="flex-1 overflow-y-auto p-8 bg-cream/40 space-y-6"
    >
      <Hero hero={data.overview.hero} companyId={companyId} />
      <KpiRow kpis={data.overview.kpis} />
      <FinancialRow data={data.overview} />
      <ListsRow data={data.overview} />
    </main>
  );
}

export default CompanyOverview;

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({ hero, companyId }: { hero: OverviewData["hero"]; companyId: string }) {
  const navigate = useNavigate();
  return (
    <section
      data-testid="overview-hero"
      className="bg-white border border-hairline p-6 rounded-2xl shadow-sm flex justify-between items-start"
    >
      <div className="flex gap-4 items-start max-w-2xl">
        <div className="w-16 h-16 rounded-xl bg-black/5 border border-hairline flex items-center justify-center text-xl uppercase font-bold tracking-widest text-ink">
          {hero.monogram}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl tracking-wide text-ink">{hero.name}</h1>
            {hero.isActive && (
              <span className="bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {copy.overview.hero.activeBadge}
              </span>
            )}
            {hero.isOnline && (
              <span className="flex items-center gap-1.5 text-xs text-mist">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {copy.overview.hero.onlineLabel}
              </span>
            )}
          </div>
          {hero.description && (
            <p className="text-sm text-mist leading-relaxed">{hero.description}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(`/c/${companyId}/settings/general`)}
          className="border border-hairline bg-white hover:bg-black/5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        >
          {copy.overview.hero.configureCta}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/c/${companyId}/`)}
          className="bg-black text-white hover:bg-neutral-800 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        >
          {copy.overview.hero.chatCta}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// KPI row
// ---------------------------------------------------------------------------

function KpiRow({ kpis }: { kpis: OverviewData["kpis"] }) {
  return (
    <section
      data-testid="overview-kpis"
      className="grid grid-cols-4 gap-4"
    >
      <KpiCard
        label={copy.overview.kpis.team}
        primary={String(kpis.teamTotal)}
        suffix={copy.overview.kpis.teamSuffix(kpis.teamWorking)}
      />
      <KpiCard
        label={copy.overview.kpis.tasks}
        primary={String(kpis.tasksDone)}
        suffix={copy.overview.kpis.tasksSuffix(kpis.tasksOpen, kpis.tasksBlocked)}
      />
      <KpiCard
        label={copy.overview.kpis.credits}
        primary={`$${kpis.creditsRemaining.toFixed(2)}`}
        suffix={copy.overview.kpis.creditsSuffix(kpis.creditsSpent)}
      />
      <KpiCard
        label={copy.overview.kpis.approvals}
        primary={String(kpis.approvalsPending)}
        suffix={copy.overview.kpis.approvalsSuffix(kpis.approvalsStale)}
      />
    </section>
  );
}

function KpiCard({
  label,
  primary,
  suffix,
}: {
  label: string;
  primary: string;
  suffix: string;
}) {
  return (
    <div
      data-testid={`kpi-${label.toLowerCase()}`}
      className="bg-white border border-hairline rounded-xl p-4 flex flex-col gap-1 shadow-sm"
    >
      <span className="text-[10px] font-semibold text-mist uppercase tracking-wider">
        {label}
      </span>
      <span className="text-2xl font-medium tracking-tight">
        {primary}{" "}
        <span className="text-base text-mist font-normal">{suffix}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial row — revenue card + AI usage card
// ---------------------------------------------------------------------------

function FinancialRow({ data }: { data: OverviewData }) {
  return (
    <section className="grid grid-cols-2 gap-4 h-64">
      <RevenueCard connected={data.revenueConnected} />
      <AiUsageCard usage={data.aiUsage} />
    </section>
  );
}

function RevenueCard({ connected }: { connected: boolean }) {
  if (connected) {
    // Real revenue visualization ships with B-07 — keep a stable slot here
    // so the A/B render parity test can differentiate by flag.
    return (
      <div
        data-testid="overview-revenue-connected"
        className="bg-white border border-hairline rounded-xl p-5 shadow-sm"
      >
        <span className="text-sm text-mist">Revenue</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid="overview-revenue-empty"
      className="bg-white border border-hairline rounded-xl flex flex-col items-center justify-center text-center p-6 shadow-sm hover:border-black/20 transition-colors cursor-pointer group"
    >
      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
        <CreditCard className="size-6" strokeWidth={1.5} />
      </div>
      <h3 className="font-medium text-ink mb-1">
        {copy.overview.revenue.emptyTitle}
      </h3>
      <span className="text-sm text-mist group-hover:underline underline-offset-2">
        {copy.overview.revenue.emptyCta}
      </span>
    </button>
  );
}

function AiUsageCard({ usage }: { usage: OverviewData["aiUsage"] }) {
  return (
    <div
      data-testid="overview-ai-usage"
      className="bg-white border border-hairline rounded-xl p-5 shadow-sm flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-[10px] font-semibold text-mist uppercase tracking-wider block mb-1">
            {copy.overview.aiUsage.spendingLabel}
          </span>
          <span className="text-2xl font-medium">
            ${usage.totalSpent.toFixed(2)}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="border border-hairline rounded px-2 py-1 text-xs text-mist bg-white">
            {usage.window}
          </span>
          <span className="border border-hairline rounded px-2 py-1 text-xs text-mist bg-white">
            {usage.bucket}
          </span>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-3">
        {!usage.hasData && (
          <div className="text-xs text-mist text-center w-full pb-4">
            {copy.overview.aiUsage.emptyLine}
          </div>
        )}
        <div>
          <div className="flex justify-between text-xs mb-1 text-mist">
            <span>{copy.overview.aiUsage.breakdownLabel}</span>
          </div>
          <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden flex">
            <div className="h-full bg-ink" style={{ width: "100%" }} />
          </div>
          {usage.breakdown.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 mt-2 text-xs text-mist"
            >
              <span className="w-2 h-2 rounded-full bg-ink" />
              {item.label} ${item.credits.toFixed(2)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lists row — Team + Apps
// ---------------------------------------------------------------------------

function ListsRow({ data }: { data: OverviewData }) {
  return (
    <section className="grid grid-cols-2 gap-8 mt-4">
      <TeamList team={data.team} />
      <AppsList apps={data.apps} />
    </section>
  );
}

function TeamList({ team }: { team: OverviewData["team"] }) {
  return (
    <div data-testid="overview-team-list">
      <div className="flex items-center justify-between mb-4 border-b border-hairline pb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {copy.overview.lists.teamHeading}{" "}
          <span className="bg-black/5 px-1.5 py-0.5 rounded text-[10px] font-normal">
            {team.length}
          </span>
        </h3>
        <a href="#" className="text-xs text-mist hover:text-ink">
          {copy.overview.lists.viewAll}
        </a>
      </div>
      <div className="space-y-4">
        {team.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between bg-white border border-hairline p-2.5 rounded-lg shadow-sm"
          >
            <span className="text-sm font-medium">{member.name}</span>
            <span className="border border-hairline px-2 py-1 rounded text-xs text-mist bg-cream">
              {copy.overview.lists.teamMemberBadge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppsList({ apps }: { apps: OverviewData["apps"] }) {
  return (
    <div data-testid="overview-apps-list">
      <div className="flex items-center justify-between mb-4 border-b border-hairline pb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {copy.overview.lists.appsHeading}{" "}
          <span className="bg-black/5 px-1.5 py-0.5 rounded text-[10px] font-normal">
            {apps.length}
          </span>
        </h3>
        <a href="#" className="text-xs text-mist hover:text-ink">
          {copy.overview.lists.viewAll}
        </a>
      </div>
      {apps.map((app) => (
        <div
          key={app.id}
          className="flex items-center justify-between bg-white border border-hairline p-3 rounded-lg shadow-sm group hover:border-black/20 transition-colors mb-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center text-ink border border-hairline flex-shrink-0">
              <Globe className="size-5" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{app.name}</span>
              {app.productionDomain && (
                <span className="text-xs text-mist truncate">
                  {app.productionDomain}
                </span>
              )}
            </div>
          </div>
          {app.isActive && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {copy.overview.lists.activeBadge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / error
// ---------------------------------------------------------------------------

function OverviewSkeleton() {
  return (
    <main
      data-testid="overview-skeleton"
      role="status"
      aria-busy="true"
      className="flex-1 overflow-y-auto p-8 bg-cream/40 space-y-6"
    >
      <div className="h-28 bg-white border border-hairline rounded-2xl animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-white border border-hairline rounded-xl animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 h-64">
        <div className="bg-white border border-hairline rounded-xl animate-pulse" />
        <div className="bg-white border border-hairline rounded-xl animate-pulse" />
      </div>
    </main>
  );
}

function OverviewError({ message }: { message: string }) {
  return (
    <main
      data-testid="overview-error"
      role="alert"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8"
    >
      <p className="text-sm text-mist">{message}</p>
    </main>
  );
}
