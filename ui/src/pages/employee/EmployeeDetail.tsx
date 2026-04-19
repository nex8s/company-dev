import type { ReactNode } from "react";
import { ArrowLeft, Globe, Mail, MessageCircle, Pause, Phone as PhoneIcon, Settings as GearIcon } from "lucide-react";
import { Route, Routes, useLocation, useNavigate, useParams } from "@/lib/router";
import { comingSoon } from "@/lib/toast-action";
import { employeeDetail as copy } from "@/copy/employee-detail";
import {
  useEmployeeDetailData,
  type ComputeData,
  type EmployeeAgent,
  type EmployeeDetailData,
  type InboxData,
} from "@/hooks/useEmployeeDetailData";
import { VirtualCardsTab } from "./VirtualCardsTab";

/**
 * C-09 Employee Detail — single generic component parameterized by agent
 * id, mounted at `/c/:companyId/team/:agentId/*`.
 *
 * 9 tabs: Profile / Chat / Browser / Phone / Workspace / Virtual Cards /
 * Inbox / Compute / Settings. CEO variant hides Browser / Phone /
 * Virtual Cards (per PLAN.md § C-09). The Recursive Intelligence diagram
 * on Profile has two variants — CEO shows an empty "no loops yet" card,
 * department agents show the 4-node Reason → Act → Observe → Learn loop.
 *
 * Data lives in `useEmployeeDetailData`. See that hook's header for the
 * live-vs-stub seam map.
 */

// ---------------------------------------------------------------------------
// Tab model
// ---------------------------------------------------------------------------

const ALL_TABS = [
  { id: "profile", path: "", labelKey: "profile" as const, ceoOnly: false, hideForCeo: false },
  { id: "chat", path: "chat", labelKey: "chat" as const, ceoOnly: false, hideForCeo: false },
  { id: "browser", path: "browser", labelKey: "browser" as const, ceoOnly: false, hideForCeo: true },
  { id: "phone", path: "phone", labelKey: "phone" as const, ceoOnly: false, hideForCeo: true },
  { id: "workspace", path: "workspace", labelKey: "workspace" as const, ceoOnly: false, hideForCeo: false },
  { id: "virtualCards", path: "virtual-cards", labelKey: "virtualCards" as const, ceoOnly: false, hideForCeo: true },
  { id: "inbox", path: "inbox", labelKey: "inbox" as const, ceoOnly: false, hideForCeo: false },
  { id: "compute", path: "compute", labelKey: "compute" as const, ceoOnly: false, hideForCeo: false },
  { id: "settings", path: "settings", labelKey: "settings" as const, ceoOnly: false, hideForCeo: false },
] as const;

type EmployeeTabId = (typeof ALL_TABS)[number]["id"];

function visibleTabsFor(agent: EmployeeAgent) {
  return ALL_TABS.filter((t) => !(agent.isCeo && t.hideForCeo));
}

function activeTabFromPath(
  pathname: string,
  companyId: string,
  agentId: string,
): EmployeeTabId {
  const prefix = `/c/${companyId}/team/${agentId}`;
  if (!pathname.startsWith(prefix)) return "profile";
  const tail = pathname.slice(prefix.length).replace(/^\/+/, "").split("/")[0];
  const match = ALL_TABS.find((t) => t.path === tail);
  return match?.id ?? "profile";
}

// ---------------------------------------------------------------------------
// Top-level
// ---------------------------------------------------------------------------

export function EmployeeDetail() {
  const { companyId = "", agentId = "" } = useParams<{
    companyId: string;
    agentId: string;
  }>();
  const data = useEmployeeDetailData(companyId, agentId);

  if (data.isLoading) return <DetailSkeleton />;
  if (data.error) {
    return <DetailError message={data.error.message} />;
  }
  if (data.agent === null) {
    return <AgentNotFound agentId={agentId} />;
  }

  return (
    <div
      data-testid="employee-detail"
      data-agent-id={data.agent.id}
      data-is-ceo={data.agent.isCeo ? "true" : "false"}
      className="flex-1 flex flex-col h-full bg-cream/40 overflow-hidden"
    >
      <DetailHeader companyId={companyId} agent={data.agent} />
      <TabStrip companyId={companyId} agentId={agentId} agent={data.agent} />
      <Routes>
        <Route index element={<ProfileTab agent={data.agent} compute={data.compute} />} />
        <Route path="chat" element={<ChatTab agent={data.agent} />} />
        <Route path="browser" element={<BrowserTab data={data} />} />
        <Route path="phone" element={<PhoneTab data={data} />} />
        <Route path="workspace" element={<WorkspaceTab data={data} />} />
        <Route
          path="virtual-cards"
          element={<VirtualCardsTab virtualCards={data.virtualCards} />}
        />
        <Route path="inbox" element={<InboxTab agent={data.agent} inbox={data.inbox} />} />
        <Route path="compute" element={<ComputeTab compute={data.compute} />} />
        <Route path="settings" element={<SettingsTab agent={data.agent} />} />
        <Route path="*" element={<ProfileTab agent={data.agent} compute={data.compute} />} />
      </Routes>
    </div>
  );
}

export default EmployeeDetail;

// ---------------------------------------------------------------------------
// Header + tab strip
// ---------------------------------------------------------------------------

function DetailHeader({
  companyId,
  agent,
}: {
  companyId: string;
  agent: EmployeeAgent;
}) {
  const navigate = useNavigate();
  return (
    <header
      data-testid="employee-header"
      className="h-14 border-b border-hairline flex items-center justify-between px-6 bg-white shrink-0"
    >
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => navigate(`/c/${companyId}`)}
          className="text-mist hover:text-ink transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          {copy.page.backToTeam}
        </button>
        <span className="text-mist">/</span>
        <span className="font-medium">
          {agent.displayName}
          {agent.isCeo && " [CEO]"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            agent.statusLabel.toLowerCase() === "idle"
              ? "bg-amber-400 animate-pulse"
              : "bg-emerald-500"
          }`}
        />
        <span className="text-sm text-mist font-medium">{agent.statusLabel}</span>
      </div>
    </header>
  );
}

function TabStrip({
  companyId,
  agentId,
  agent,
}: {
  companyId: string;
  agentId: string;
  agent: EmployeeAgent;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeTabFromPath(location.pathname, companyId, agentId);
  const tabs = visibleTabsFor(agent);

  return (
    <nav
      aria-label="Employee tabs"
      data-testid="employee-tab-strip"
      className="border-b border-hairline bg-white px-6 overflow-x-auto whitespace-nowrap flex"
    >
      <div className="flex gap-6 min-w-max">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const href = tab.path
            ? `/c/${companyId}/team/${agentId}/${tab.path}`
            : `/c/${companyId}/team/${agentId}`;
          return (
            <button
              key={tab.id}
              type="button"
              data-tab={tab.id}
              aria-current={isActive ? "page" : undefined}
              onClick={() => navigate(href)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-mist hover:text-ink"
              }`}
            >
              {copy.tabs[tab.labelKey]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Profile tab (Port-backed; splits visual on CEO vs dept)
// ---------------------------------------------------------------------------

function ProfileTab({
  agent,
  compute,
}: {
  agent: EmployeeAgent;
  compute: ComputeData;
}) {
  return (
    <section
      id="main-content"
      data-testid="employee-tab-profile"
      className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full pb-20"
    >
      <HeroCard agent={agent} />
      {agent.isCeo && (
        <div className="grid grid-cols-2 gap-6 mt-6">
          <IdentityCard agent={agent} />
          <CurrentComputeCard compute={compute} />
        </div>
      )}
      <RecursiveIntelligence isCeo={agent.isCeo} />
    </section>
  );
}

function HeroCard({ agent }: { agent: EmployeeAgent }) {
  const navigate = useNavigate();
  const { companyId = "", agentId = "" } = useParams<{ companyId: string; agentId: string }>();
  return (
    <div
      data-testid="profile-hero"
      className="bg-white border border-hairline p-6 rounded-2xl shadow-sm flex justify-between items-start"
    >
      <div className="flex gap-4 items-start max-w-2xl">
        <div className="w-16 h-16 rounded-xl bg-black/5 border border-hairline flex items-center justify-center text-ink text-xl">
          {agent.displayName.charAt(0)}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl tracking-wide">
            {agent.displayName}
            {agent.isCeo && " [CEO]"}
          </h1>
          <p className="text-sm text-mist leading-relaxed max-w-lg">
            {agent.description}
          </p>
        </div>
      </div>
      {agent.isCeo && (
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => comingSoon("Configure")}
            className="border border-hairline bg-white hover:bg-black/5 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
          >
            <GearIcon className="size-4" strokeWidth={1.5} />
            {copy.page.configureCta}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/c/${companyId}/team/${agentId}/chat`)}
            className="bg-black text-white hover:bg-neutral-800 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
          >
            <MessageCircle className="size-4" strokeWidth={1.5} />
            {copy.page.chatCta}
          </button>
        </div>
      )}
    </div>
  );
}

function IdentityCard({ agent }: { agent: EmployeeAgent }) {
  return (
    <div
      data-testid="profile-identity"
      className="bg-white border border-hairline p-5 rounded-xl shadow-sm space-y-4"
    >
      <h3 className="text-[10px] font-semibold text-mist uppercase tracking-wider">
        {copy.profile.identityHeading}
      </h3>
      <div className="space-y-3 p-3 bg-cream rounded border border-hairline/50">
        <IdentityRow label={copy.profile.emailLabel} value={agent.email} />
        <IdentityRow
          label={copy.profile.phoneLabel}
          value={agent.phone}
          italicIfMissing
        />
        <IdentityRow
          label={copy.profile.legalEntityLabel}
          value={agent.legalEntity}
          italicIfMissing
          highlight
        />
      </div>
    </div>
  );
}

function IdentityRow({
  label,
  value,
  italicIfMissing,
  highlight,
}: {
  label: string;
  value: string | null;
  italicIfMissing?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-mist">{label}</span>
      {value ? (
        highlight ? (
          <span className="font-medium bg-white px-2 rounded border border-hairline">
            {value}
          </span>
        ) : (
          <span className="font-medium truncate max-w-[200px]">{value}</span>
        )
      ) : (
        <span
          className={`text-mist ${italicIfMissing ? "italic" : ""}`}
        >
          {copy.profile.notAvailable}
        </span>
      )}
    </div>
  );
}

function CurrentComputeCard({ compute }: { compute: ComputeData }) {
  return (
    <div
      data-testid="profile-current-compute"
      className="bg-white border border-hairline p-5 rounded-xl shadow-sm flex flex-col"
    >
      <h3 className="text-[10px] font-semibold text-mist uppercase tracking-wider mb-2">
        {copy.profile.computeHeading}
      </h3>
      <div className="mt-auto flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <span className="text-3xl tracking-wider">
            {compute.currentPeriodCredits.toFixed(2)} CR
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
              {compute.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecursiveIntelligence({ isCeo }: { isCeo: boolean }) {
  if (isCeo) {
    return (
      <section data-testid="recursive-intelligence-empty" className="mt-8">
        <h3 className="text-sm font-semibold mb-4 border-b border-hairline pb-2 uppercase tracking-wider">
          {copy.profile.recursiveHeading}
        </h3>
        <div className="w-full h-32 border border-dashed border-black/20 bg-white/50 rounded-xl flex items-center justify-center text-mist text-sm">
          {copy.profile.recursiveEmptyCeo}
        </div>
      </section>
    );
  }
  const nodes = [
    { key: "reason", pos: "left" as const },
    { key: "act", pos: "top" as const },
    { key: "observe", pos: "right" as const },
    { key: "learn", pos: "bottom" as const },
  ];
  return (
    <section data-testid="recursive-intelligence-diagram" className="mt-8">
      <div className="flex items-center justify-between mb-4 border-b border-hairline pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider">
          {copy.profile.recursiveTitleDept}
        </h3>
      </div>
      <div className="bg-white border border-hairline rounded-2xl p-10 flex items-center justify-center shadow-sm">
        <div className="relative w-[600px] h-[300px]">
          {nodes.map((n) => (
            <RecursiveNode key={n.key} nodeKey={n.key as keyof typeof copy.profile.nodes} position={n.pos} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RecursiveNode({
  nodeKey,
  position,
}: {
  nodeKey: keyof typeof copy.profile.nodes;
  position: "left" | "top" | "right" | "bottom";
}) {
  const n = copy.profile.nodes[nodeKey];
  const posClass =
    position === "left"
      ? "left-0 top-1/2 -translate-y-1/2"
      : position === "top"
      ? "top-0 left-1/2 -translate-x-1/2"
      : position === "right"
      ? "right-0 top-1/2 -translate-y-1/2"
      : "bottom-0 left-1/2 -translate-x-1/2";
  return (
    <div
      data-node={nodeKey}
      className={`absolute flex flex-col items-center gap-2 ${posClass}`}
    >
      <div className="w-16 h-16 rounded-full bg-white border-2 border-ink shadow-md flex items-center justify-center text-xl">
        {nodeKey === "reason" ? "1" : nodeKey === "act" ? "2" : nodeKey === "observe" ? "3" : "4"}
      </div>
      <span className="font-bold text-sm">{n.title}</span>
      <span className="text-[10px] text-mist w-24 text-center leading-tight">
        {n.hint}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat tab (lightweight stub — per-agent channel is a follow-on)
// ---------------------------------------------------------------------------

function ChatTab({ agent }: { agent: EmployeeAgent }) {
  return (
    <TabShell testId="employee-tab-chat">
      <h2 className="text-lg font-medium mb-2">
        {copy.chat.heading.replace("{agent}", agent.displayName)}
      </h2>
      <p className="text-sm text-mist mb-6">{copy.chat.stubNote}</p>
      <div className="bg-white border border-hairline rounded-2xl p-4">
        <p className="text-sm text-mist">{copy.chat.placeholder}</p>
      </div>
    </TabShell>
  );
}

// ---------------------------------------------------------------------------
// Browser tab (stubbed until BrowserProvider HTTP route lands)
// ---------------------------------------------------------------------------

function BrowserTab({ data }: { data: EmployeeDetailData }) {
  const browser = data.browser;
  return (
    <TabShell testId="employee-tab-browser">
      <h2 className="text-lg font-medium mb-4">{copy.browser.heading}</h2>
      {browser.sessionStatus !== "active" ? (
        <div className="bg-white border border-hairline rounded-2xl p-8 flex flex-col items-center text-center gap-3">
          <Globe className="size-8 text-mist" strokeWidth={1.5} />
          <p className="font-medium text-sm">{copy.browser.inactiveTitle}</p>
          <p className="text-xs text-mist max-w-md leading-relaxed">
            {copy.browser.inactiveBody}
          </p>
          <button
            type="button"
            onClick={() => comingSoon("Start Browser Session")}
            className="mt-2 bg-black text-white hover:bg-neutral-800 px-4 py-2 rounded-full text-xs font-medium"
          >
            {copy.browser.startCta}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-hairline rounded-2xl h-96 flex items-center justify-center text-mist text-sm">
            {copy.browser.liveLabel}: {browser.liveViewUrl}
          </div>
        </div>
      )}
    </TabShell>
  );
}

// ---------------------------------------------------------------------------
// Phone tab (stub)
// ---------------------------------------------------------------------------

function PhoneTab({ data }: { data: EmployeeDetailData }) {
  const number = data.phone.number;
  return (
    <TabShell testId="employee-tab-phone">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">{copy.phone.heading}</h2>
        <span className="text-[10px] text-mist border border-hairline rounded px-1.5 py-0.5">
          {copy.phone.stubBadge}
        </span>
      </div>
      {number ? (
        <div className="bg-white border border-hairline rounded-2xl p-6 flex items-center gap-3">
          <PhoneIcon className="size-5 text-ink" strokeWidth={1.5} />
          <span className="font-mono">{number}</span>
        </div>
      ) : (
        <div className="bg-white border border-hairline rounded-2xl p-8 flex flex-col items-center text-center gap-3">
          <PhoneIcon className="size-8 text-mist" strokeWidth={1.5} />
          <p className="font-medium text-sm">{copy.phone.emptyTitle}</p>
          <p className="text-xs text-mist max-w-md">{copy.phone.emptyBody}</p>
          <button
            type="button"
            onClick={() => comingSoon("Claim Phone Number")}
            className="mt-2 bg-black text-white hover:bg-neutral-800 px-4 py-2 rounded-full text-xs font-medium"
          >
            {copy.phone.claimCta}
          </button>
        </div>
      )}
    </TabShell>
  );
}

// ---------------------------------------------------------------------------
// Workspace tab (Files / Skills toggle placeholders)
// ---------------------------------------------------------------------------

function WorkspaceTab({ data }: { data: EmployeeDetailData }) {
  return (
    <TabShell testId="employee-tab-workspace">
      <h2 className="text-lg font-medium mb-4">{copy.workspace.heading}</h2>
      <div className="bg-white border border-hairline rounded-2xl p-6 space-y-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-mist mb-2">
            {copy.workspace.filesTab}
          </p>
          {data.workspace.files.length === 0 ? (
            <p className="text-sm text-mist">{copy.workspace.emptyFiles}</p>
          ) : (
            <ul className="text-sm">
              {data.workspace.files.map((f) => (
                <li key={f.name}>{f.name} — {f.sizeLabel}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-mist mb-2">
            {copy.workspace.skillsTab}
          </p>
          {data.workspace.skills.length === 0 ? (
            <p className="text-sm text-mist">{copy.workspace.emptySkills}</p>
          ) : (
            <ul className="text-sm">
              {data.workspace.skills.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </TabShell>
  );
}

// ---------------------------------------------------------------------------
// Inbox tab (EmailProvider stub)
// ---------------------------------------------------------------------------

function InboxTab({ agent, inbox }: { agent: EmployeeAgent; inbox: InboxData }) {
  return (
    <section
      id="main-content"
      data-testid="employee-tab-inbox"
      className="flex-1 flex flex-col overflow-hidden"
    >
      <div className="px-8 py-6 border-b border-hairline flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">{copy.inbox.heading}</h2>
          <p className="text-xs text-mist mt-0.5">
            {copy.inbox.subheading(agent.displayName)}
          </p>
        </div>
        <span className="text-[10px] text-mist border border-hairline rounded px-1.5 py-0.5">
          {copy.inbox.stubBadge}
        </span>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-hairline flex flex-col">
          <div className="p-4 border-b border-hairline">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mist">
              {copy.inbox.inboxLabel}
            </p>
            <p className="text-xs text-mist mt-1 font-mono truncate">{inbox.address}</p>
          </div>
          {inbox.messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2">
              <div className="w-10 h-10 rounded-lg bg-cream border border-hairline flex items-center justify-center">
                <Mail className="size-5 text-mist" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium">{copy.inbox.emptyTitle}</p>
              <p className="text-xs text-mist">{copy.inbox.emptyBody}</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {inbox.messages.map((m) => (
                <li key={m.messageId} className="px-4 py-2 border-b border-hairline">
                  <p className="text-sm font-medium truncate">{m.subject}</p>
                  <p className="text-xs text-mist truncate">{m.fromAddress}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2">
          <p className="text-sm font-medium">{copy.inbox.openHint}</p>
          <p className="text-xs text-mist">{copy.inbox.openHintBody}</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Compute tab (stub mirroring A-07 shape)
// ---------------------------------------------------------------------------

function ComputeTab({ compute }: { compute: ComputeData }) {
  return (
    <TabShell testId="employee-tab-compute">
      <h2 className="text-lg font-medium">{copy.compute.heading}</h2>
      <p className="text-xs text-mist mt-0.5 mb-6">{copy.compute.subheading}</p>

      <p className="text-[10px] font-semibold uppercase tracking-wider text-mist mb-1">
        {copy.compute.currentPeriodLabel}
      </p>
      <p className="text-3xl tracking-wider mb-6">
        {compute.currentPeriodCredits.toFixed(2)}{" "}
        <span className="text-sm text-mist font-normal">{copy.compute.creditsUnit}</span>
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-hairline rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist mb-2">
            {copy.compute.statusLabel}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium uppercase">
              {compute.status}
            </span>
            <button
              type="button"
              onClick={() => comingSoon("Pause Compute")}
              className="border border-hairline hover:bg-black/5 px-3 py-1 rounded-full text-xs flex items-center gap-1.5"
            >
              <Pause className="size-3" strokeWidth={1.5} />
              {copy.compute.pauseCta}
            </button>
          </div>
        </div>
        <div className="bg-white border border-hairline rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist mb-2">
            {copy.compute.budgetLabel}
          </p>
          <div className="flex items-center gap-2">
            <input
              defaultValue={compute.monthlyBudget ?? ""}
              placeholder={copy.compute.budgetPlaceholder}
              className="flex-1 bg-cream border border-hairline rounded-md px-2 py-1 text-sm outline-none"
            />
            <span className="text-xs text-mist">{copy.compute.creditsUnit}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-hairline rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-6 text-[10px] font-semibold uppercase tracking-wider text-mist px-5 py-3 border-b border-hairline bg-cream/40">
          <span>{copy.compute.tableResource}</span>
          <span>{copy.compute.tableUsage}</span>
          <span>{copy.compute.tableCredits}</span>
        </div>
        {compute.resources.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[1fr_auto_auto] gap-6 items-center px-5 py-3 border-b border-hairline text-sm last:border-b-0"
          >
            <div>
              <p className="font-medium">{r.label}</p>
              {r.subtitle && (
                <p className="text-[11px] text-mist">{r.subtitle}</p>
              )}
            </div>
            <span className="text-xs text-mist whitespace-nowrap">
              {r.usageLabel}
            </span>
            <span className="font-medium w-16 text-right">
              {r.credits.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-mist mt-3">{copy.compute.stubNote}</p>
    </TabShell>
  );
}

// ---------------------------------------------------------------------------
// Settings tab (read-only form today)
// ---------------------------------------------------------------------------

function SettingsTab({ agent }: { agent: EmployeeAgent }) {
  return (
    <TabShell testId="employee-tab-settings">
      <h2 className="text-lg font-medium mb-6">{copy.settings.heading}</h2>
      <div className="bg-white border border-hairline rounded-2xl p-6 space-y-4">
        <SettingsField label={copy.settings.displayNameLabel} defaultValue={agent.displayName} />
        <SettingsField label={copy.settings.departmentLabel} defaultValue={agent.department} disabled />
        <SettingsField label={copy.settings.statusLabel} defaultValue={agent.statusLabel} disabled />
        <div className="flex justify-end">
          <button
            type="button"
            disabled
            className="bg-black text-white px-4 py-2 rounded-full text-xs font-medium opacity-40 cursor-not-allowed"
          >
            {copy.settings.saveCta}
          </button>
        </div>
        <p className="text-[11px] text-mist">{copy.settings.stubNote}</p>
      </div>
      <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
        <h4 className="text-sm font-medium text-red-800 mb-1">
          {copy.settings.dangerHeading}
        </h4>
        <p className="text-xs text-red-600 mb-4">{copy.settings.dangerBody}</p>
        <button
          type="button"
          onClick={() => comingSoon(`Delete ${agent.displayName}`)}
          className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-xs font-medium shadow-sm"
        >
          {copy.settings.dangerCta(agent.displayName)}
        </button>
      </div>
    </TabShell>
  );
}

function SettingsField({
  label,
  defaultValue,
  disabled,
}: {
  label: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-mist">{label}</label>
      <input
        type="text"
        defaultValue={defaultValue}
        disabled={disabled}
        className="w-full bg-cream border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-black/30 disabled:opacity-60"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared tab shell + error / not-found / skeleton
// ---------------------------------------------------------------------------

function TabShell({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <section
      id="main-content"
      data-testid={testId}
      className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full pb-20"
    >
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div
      data-testid="employee-detail-skeleton"
      role="status"
      aria-busy="true"
      className="flex-1 flex flex-col h-full bg-cream/40 overflow-hidden"
    >
      <div className="h-14 border-b border-hairline bg-white animate-pulse" />
      <div className="h-10 border-b border-hairline bg-white animate-pulse" />
      <div className="flex-1 p-8 space-y-4">
        <div className="h-28 bg-white border border-hairline rounded-2xl animate-pulse" />
        <div className="h-24 bg-white border border-hairline rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  return (
    <div
      data-testid="employee-detail-error"
      role="alert"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8 text-sm text-mist"
    >
      {message}
    </div>
  );
}

function AgentNotFound({ agentId }: { agentId: string }) {
  return (
    <div
      data-testid="employee-detail-not-found"
      role="alert"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8"
    >
      <div className="max-w-md text-center space-y-2">
        <p className="font-medium">{copy.page.notFoundTitle}</p>
        <p className="text-sm text-mist">{copy.page.notFoundBody(agentId)}</p>
      </div>
    </div>
  );
}
