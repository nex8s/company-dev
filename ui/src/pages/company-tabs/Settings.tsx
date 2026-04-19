import { CreditCard, Globe, Layers, LayoutGrid } from "lucide-react";
import { Route, Routes, useLocation, useNavigate, useParams } from "@/lib/router";
import { comingSoon } from "@/lib/toast-action";
import { companyTabs as copy } from "@/copy/company-tabs";
import {
  useCompanyTabsData,
  type SettingsGeneralData,
} from "@/hooks/useCompanyTabsData";
import { SettingsDomains } from "./settings/Domains";
import { SettingsConnections } from "./settings/Connections";
import { SettingsCustomDashboards } from "./settings/CustomDashboards";
import { SettingsVirtualCards } from "./settings/VirtualCardsAggregate";
import { SettingsTeam } from "./settings/Team";

/**
 * Company > Settings — C-05 tab 4. An inner tab strip (General / Billing
 * / Team / Usage / Server / Publishing) nested inside the outer breadcrumb.
 *
 * General reads A-02 CompanyProfile fields via `useCompanyTabsData`. The
 * other five tabs render a one-line placeholder naming the B-task that
 * will supply real content. Adding each tab's real view is a ~50-line
 * drop-in behind the existing `<Route>` slot.
 */

const SETTINGS_TABS = [
  { id: "general", path: "general", labelKey: "general" as const },
  { id: "billing", path: "billing", labelKey: "billing" as const, task: "B-07" },
  { id: "team", path: "team", labelKey: "team" as const, task: "B-06" },
  { id: "usage", path: "usage", labelKey: "usage" as const, task: "A-07" },
  { id: "server", path: "server", labelKey: "server" as const, task: "A-09" },
  { id: "publishing", path: "publishing", labelKey: "publishing" as const, task: "B-10" },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

function activeInnerTab(pathname: string, companyId: string): SettingsTabId {
  const prefix = `/c/${companyId}/settings`;
  if (!pathname.startsWith(prefix)) return "general";
  const tail = pathname.slice(prefix.length).replace(/^\/+/, "").split("/")[0];
  const match = SETTINGS_TABS.find((t) => t.path === tail);
  return match?.id ?? "general";
}

export function CompanySettingsTab() {
  const { companyId = "" } = useParams<{ companyId: string }>();

  return (
    <main
      id="main-content"
      data-testid="company-settings"
      className="flex-1 overflow-y-auto bg-cream/40 p-8"
    >
      <div className="max-w-3xl w-full mx-auto space-y-10 pb-20">
        <h1 className="text-2xl font-medium tracking-wide text-ink">{copy.settings.heading}</h1>
        <InnerTabStrip companyId={companyId} />
        <Routes>
          <Route index element={<SettingsGeneral />} />
          <Route path="general" element={<SettingsGeneral />} />
          <Route path="billing" element={<SettingsPlaceholder tab="billing" task="B-07" />} />
          <Route path="team" element={<SettingsTeam />} />
          <Route path="usage" element={<SettingsPlaceholder tab="usage" task="A-07" />} />
          <Route path="server" element={<SettingsServer />} />
          <Route path="publishing" element={<SettingsPlaceholder tab="publishing" task="B-10" />} />
          {/* C-12 sub-pages — not part of the inner tab strip, reached
              from the General quick-nav tiles. */}
          <Route path="domains" element={<SettingsDomains />} />
          <Route path="virtual-cards" element={<SettingsVirtualCards />} />
          <Route path="custom-dashboards" element={<SettingsCustomDashboards />} />
          <Route path="connections" element={<SettingsConnections />} />
        </Routes>
      </div>
    </main>
  );
}

export default CompanySettingsTab;

// ---------------------------------------------------------------------------
// Inner tab strip
// ---------------------------------------------------------------------------

function InnerTabStrip({ companyId }: { companyId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeInnerTab(location.pathname, companyId);

  return (
    <div
      data-testid="settings-inner-tabs"
      className="flex gap-6 border-b border-hairline"
    >
      {SETTINGS_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            data-tab={tab.id}
            aria-current={isActive ? "page" : undefined}
            onClick={() => navigate(`/c/${companyId}/settings/${tab.path}`)}
            className={`pb-2 border-b-2 font-medium text-sm transition-colors ${
              isActive
                ? "border-ink text-ink"
                : "border-transparent text-mist hover:text-ink"
            }`}
          >
            {copy.settings.tabs[tab.labelKey]}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// General — A-02 CompanyProfile fields
// ---------------------------------------------------------------------------

function SettingsGeneral() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const data = useCompanyTabsData(companyId);

  if (data.isLoading) return <GeneralSkeleton />;
  if (data.error) return <GeneralError message={copy.settings.error} />;

  return (
    <div data-testid="settings-general" className="flex flex-col space-y-8">
      <ProfileSection settings={data.settings} />
      <LifecycleSection settings={data.settings} />
      <QuickNavGrid />
      <DangerZone companyName={data.settings.name} />
    </div>
  );
}

function ProfileSection({ settings }: { settings: SettingsGeneralData }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-mist">
        {copy.settings.general.profileHeading}
      </h3>
      <div className="bg-white border border-hairline p-6 rounded-xl shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-black/5 border border-hairline flex items-center justify-center text-xl uppercase font-bold tracking-widest text-ink">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt=""
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              settings.monogram
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">
              {copy.settings.general.logoLabel}
            </h4>
            <button
              type="button"
              onClick={() => comingSoon("Logo Upload")}
              className="border border-hairline hover:bg-black/5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            >
              {copy.settings.general.logoUploadCta}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-mist" htmlFor="co-name">
            {copy.settings.general.nameLabel}
          </label>
          <input
            id="co-name"
            type="text"
            defaultValue={settings.name}
            className="w-full bg-cream border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-black/30 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-mist" htmlFor="co-desc">
            {copy.settings.general.descLabel}
          </label>
          <textarea
            id="co-desc"
            rows={3}
            defaultValue={settings.description}
            placeholder={copy.settings.general.descPlaceholder}
            className="w-full bg-cream border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-black/30 transition-colors placeholder:text-mist resize-none"
          />
        </div>
      </div>
    </section>
  );
}

function LifecycleSection({ settings }: { settings: SettingsGeneralData }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-mist">
        {copy.settings.general.lifecycleHeading}
      </h3>
      <ToggleRow
        testId="settings-toggle-approval"
        label={copy.settings.general.boardApprovalLabel}
        hint={copy.settings.general.boardApprovalHint}
        on={settings.boardApprovalRequired}
      />
      <ToggleRow
        testId="settings-toggle-incorporated"
        label={copy.settings.general.incorporatedLabel}
        hint={copy.settings.general.incorporatedHint}
        on={settings.incorporated}
      />
    </section>
  );
}

function ToggleRow({
  testId,
  label,
  hint,
  on,
}: {
  testId: string;
  label: string;
  hint: string;
  on: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-hairline p-4 rounded-xl shadow-sm flex items-center justify-between gap-4"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-mist mt-0.5">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => comingSoon(label)}
        className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors ${
          on ? "bg-emerald-500" : "bg-gray-200 border border-hairline"
        }`}
      >
        <span
          className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
            on ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function QuickNavGrid() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const n = copy.settings.general.quickNav;
  const items = [
    { slug: "domains", icon: <Globe className="size-5" strokeWidth={1.5} />, label: n.domains, desc: n.domainsDesc },
    { slug: "virtual-cards", icon: <CreditCard className="size-5" strokeWidth={1.5} />, label: n.virtualCards, desc: n.virtualCardsDesc },
    { slug: "custom-dashboards", icon: <LayoutGrid className="size-5" strokeWidth={1.5} />, label: n.customDashboards, desc: n.customDashboardsDesc },
    { slug: "connections", icon: <Layers className="size-5" strokeWidth={1.5} />, label: n.connections, desc: n.connectionsDesc },
  ] as const;
  return (
    <section className="grid grid-cols-2 gap-4">
      {items.map((it) => (
        <button
          key={it.slug}
          type="button"
          data-testid={`quick-nav-${it.slug}`}
          onClick={() => navigate(`/c/${companyId}/settings/${it.slug}`)}
          className="bg-white border border-hairline p-4 rounded-xl shadow-sm hover:border-black/20 cursor-pointer flex items-center gap-3 transition-colors group text-left"
        >
          <div className="w-10 h-10 bg-cream rounded-lg border border-hairline flex items-center justify-center text-ink">
            {it.icon}
          </div>
          <div>
            <p className="font-medium text-sm group-hover:underline">{it.label}</p>
            <p className="text-xs text-mist">{it.desc}</p>
          </div>
        </button>
      ))}
    </section>
  );
}

function DangerZone({ companyName }: { companyName: string }) {
  return (
    <section className="mt-12" data-testid="settings-danger-zone">
      <div className="bg-red-50 border border-red-200 p-5 rounded-xl">
        <h4 className="text-sm font-medium text-red-800 mb-1">
          {copy.settings.general.dangerZone.heading}
        </h4>
        <p className="text-xs text-red-600 mb-4">
          {copy.settings.general.dangerZone.body}
        </p>
        <button
          type="button"
          onClick={() => comingSoon(`Delete ${companyName}`)}
          className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-xs font-medium transition-colors shadow-sm"
        >
          {copy.settings.general.dangerZone.cta(companyName)}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings > Server (matches usecompanydev.com "Not Provisioned" initial state)
// ---------------------------------------------------------------------------

function SettingsServer() {
  return (
    <div data-testid="settings-server" className="space-y-6">
      <div className="bg-white border border-hairline rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-cream border border-hairline flex items-center justify-center">
            <svg className="w-5 h-5 text-mist" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l1.587 2.45a4.5 4.5 0 01.9 2.7" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Server Status</h3>
            <p className="text-xs text-mist mt-0.5">No server has been set up yet.</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-mist">
            <span className="w-2 h-2 rounded-full bg-mist/40" />
            Not Provisioned
          </div>
        </div>
        <div className="border-t border-hairline mt-4 pt-4 flex items-center gap-3">
          <button type="button" onClick={() => comingSoon("Start Server")} className="bg-ink text-white hover:bg-ink/90 px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            Start Server
          </button>
          <span className="text-xs text-mist flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading status…
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder for tabs that need their B-task to merge
// ---------------------------------------------------------------------------

function SettingsPlaceholder({ tab, task }: { tab: string; task: string }) {
  return (
    <div
      data-testid={`settings-${tab}-placeholder`}
      className="bg-white border border-hairline rounded-xl p-8 text-center text-sm text-mist"
    >
      {copy.settings.placeholder(
        copy.settings.tabs[tab as keyof typeof copy.settings.tabs],
        task,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / error
// ---------------------------------------------------------------------------

function GeneralSkeleton() {
  return (
    <div
      data-testid="settings-general-skeleton"
      role="status"
      aria-busy="true"
      className="space-y-6"
    >
      <div className="h-40 bg-white border border-hairline rounded-xl animate-pulse" />
      <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
    </div>
  );
}

function GeneralError({ message }: { message: string }) {
  return (
    <div
      data-testid="settings-general-error"
      role="alert"
      className="text-sm text-mist p-8 text-center"
    >
      {message}
    </div>
  );
}
