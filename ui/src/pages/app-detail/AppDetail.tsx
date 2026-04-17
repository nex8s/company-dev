import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, FileText, Folder, Plus, Trash2 } from "lucide-react";
import { Route, Routes, useLocation, useNavigate, useParams } from "@/lib/router";
import { ApiError } from "@/api/client";
import {
  pluginAppsBuilderApi,
  type AppDto,
  type AppPreviewDto,
  type DeploymentDto,
  type FileTreeLeafDto,
  type FileTreeNodeDto,
} from "@/api/plugin-apps-builder";
import { appDetail as copy } from "@/copy/app-detail";
import { queryKeys } from "@/lib/queryKeys";

/**
 * C-10 App Detail — generic component parameterized by appId, mounted at
 * `/c/:companyId/apps/:appId/*`. Four tabs (Preview / Code / Deployments
 * / Settings) all wired live to plugin-apps-builder's HTTP routes (B-02 +
 * B-03). The Settings tab issues PATCH and DELETE through React Query
 * mutations and invalidates the env list on success.
 *
 * Sibling top-level view, like Tasks (C-06), Team (C-09), Store (C-08) —
 * the company breadcrumb hides on /apps/.
 */

const TABS = [
  { id: "preview", path: "", labelKey: "preview" as const },
  { id: "code", path: "code", labelKey: "code" as const },
  { id: "deployments", path: "deployments", labelKey: "deployments" as const },
  { id: "settings", path: "settings", labelKey: "settings" as const },
] as const;

type AppTabId = (typeof TABS)[number]["id"];

function activeTab(pathname: string, companyId: string, appId: string): AppTabId {
  const prefix = `/c/${companyId}/apps/${appId}`;
  if (!pathname.startsWith(prefix)) return "preview";
  const tail = pathname.slice(prefix.length).replace(/^\/+/, "").split("/")[0];
  const match = TABS.find((t) => t.path === tail);
  return match?.id ?? "preview";
}

export function AppDetail() {
  const { companyId = "", appId = "" } = useParams<{
    companyId: string;
    appId: string;
  }>();
  const appQuery = useQuery({
    queryKey: queryKeys.pluginAppsBuilder.app(companyId, appId),
    queryFn: () => pluginAppsBuilderApi.getApp(companyId, appId),
    enabled: companyId.length > 0 && appId.length > 0,
  });

  if (appQuery.isLoading) return <Skeleton />;

  if (appQuery.error) {
    const err = appQuery.error as ApiError;
    if (err.status === 404) return <NotFound appId={appId} />;
    return <ErrorState message={copy.page.error} />;
  }
  const app = appQuery.data?.app;
  if (!app) return <NotFound appId={appId} />;

  return (
    <div
      data-testid="app-detail"
      data-app-id={app.id}
      className="flex-1 flex flex-col h-full bg-cream/40 overflow-hidden"
    >
      <Header companyId={companyId} app={app} />
      <TabStrip companyId={companyId} appId={appId} />
      <Routes>
        <Route index element={<PreviewTab companyId={companyId} appId={appId} />} />
        <Route path="code" element={<CodeTab companyId={companyId} appId={appId} />} />
        <Route
          path="deployments"
          element={<DeploymentsTab companyId={companyId} appId={appId} />}
        />
        <Route
          path="settings"
          element={<SettingsTab companyId={companyId} appId={appId} />}
        />
        <Route path="*" element={<PreviewTab companyId={companyId} appId={appId} />} />
      </Routes>
    </div>
  );
}

export default AppDetail;

// ---------------------------------------------------------------------------
// Header + tab strip
// ---------------------------------------------------------------------------

function Header({ companyId, app }: { companyId: string; app: AppDto }) {
  const navigate = useNavigate();
  const isDeployed = app.productionDomain !== null;
  return (
    <header
      data-testid="app-header"
      className="h-14 border-b border-hairline flex items-center justify-between px-6 bg-white shrink-0"
    >
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => navigate(`/c/${companyId}`)}
          className="text-mist hover:text-ink transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          {copy.page.backToCompany}
        </button>
        <span className="text-mist">/</span>
        <span className="font-medium">{app.name}</span>
        <span className="text-[10px] text-mist">{copy.page.websiteLabel}</span>
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
          isDeployed
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-black/5 text-mist border-hairline"
        }`}
      >
        {isDeployed ? copy.status.deployed : copy.status.notDeployed}
      </span>
    </header>
  );
}

function TabStrip({ companyId, appId }: { companyId: string; appId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeTab(location.pathname, companyId, appId);
  return (
    <nav
      aria-label="App tabs"
      data-testid="app-tab-strip"
      className="border-b border-hairline bg-white px-6 flex gap-6"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const href = tab.path
          ? `/c/${companyId}/apps/${appId}/${tab.path}`
          : `/c/${companyId}/apps/${appId}`;
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
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Preview tab
// ---------------------------------------------------------------------------

function PreviewTab({ companyId, appId }: { companyId: string; appId: string }) {
  const previewQuery = useQuery({
    queryKey: queryKeys.pluginAppsBuilder.preview(companyId, appId),
    queryFn: () => pluginAppsBuilderApi.getPreview(companyId, appId),
  });

  return (
    <section
      data-testid="app-tab-preview"
      className="flex-1 overflow-hidden p-8 flex items-center justify-center"
    >
      <PreviewBody data={previewQuery.data?.preview} loading={previewQuery.isLoading} />
    </section>
  );
}

function PreviewBody({
  data,
  loading,
}: {
  data: AppPreviewDto | undefined;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="bg-white border border-hairline rounded-xl shadow-sm w-full max-w-2xl h-[520px] flex items-center justify-center text-sm text-mist animate-pulse">
        {copy.preview.deployingTitle}
      </div>
    );
  }
  if (data.status === "deployed" && data.productionDomain) {
    return (
      <div className="bg-white border border-hairline rounded-xl shadow-sm w-full max-w-3xl h-[560px] flex flex-col overflow-hidden">
        <div className="h-8 border-b border-hairline flex items-center px-3 text-[10px] text-mist font-mono">
          https://{data.productionDomain}
        </div>
        <iframe
          title={copy.preview.iframeTitle}
          src={`https://${data.productionDomain}`}
          className="flex-1 w-full"
        />
      </div>
    );
  }
  return (
    <div
      data-testid="preview-not-deployed"
      className="bg-white border border-hairline rounded-xl shadow-sm w-full max-w-md p-8 text-center space-y-2"
    >
      <p className="font-medium">{copy.preview.notDeployedTitle}</p>
      <p className="text-sm text-mist">{copy.preview.notDeployedBody}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Code tab
// ---------------------------------------------------------------------------

function CodeTab({ companyId, appId }: { companyId: string; appId: string }) {
  const filesQuery = useQuery({
    queryKey: queryKeys.pluginAppsBuilder.files(companyId, appId),
    queryFn: () => pluginAppsBuilderApi.listFiles(companyId, appId),
  });

  return (
    <section
      data-testid="app-tab-code"
      className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto"
    >
      {filesQuery.isLoading ? (
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
      ) : filesQuery.data?.count === 0 ? (
        <div
          data-testid="code-empty"
          className="border border-dashed border-black/20 rounded-xl p-12 text-center text-sm text-mist"
        >
          {copy.code.empty}
        </div>
      ) : filesQuery.data ? (
        <>
          <p className="text-[11px] text-mist mb-3">
            {copy.code.summary(filesQuery.data.count)}
          </p>
          <div className="bg-white border border-hairline rounded-xl overflow-hidden divide-y divide-hairline text-xs">
            <FileTree node={filesQuery.data.tree} depth={0} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function FileTree({
  node,
  depth,
}: {
  node: FileTreeNodeDto;
  depth: number;
}) {
  return (
    <>
      {node.children.map((child) =>
        child.kind === "directory" ? (
          <DirectoryRow key={child.path} node={child} depth={depth} />
        ) : (
          <FileRow key={child.path} leaf={child} depth={depth} />
        ),
      )}
    </>
  );
}

function DirectoryRow({ node, depth }: { node: FileTreeNodeDto; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  return (
    <div data-file-path={node.path}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-black/5 text-left"
        style={{ paddingLeft: `${16 + depth * 12}px` }}
      >
        <ChevronRight
          className={`size-3 text-mist transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Folder className="size-3.5 text-mist" strokeWidth={1.5} />
        <span>{node.name || "/"}</span>
      </button>
      {open && (
        <div>
          <FileTree node={node} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

function FileRow({ leaf, depth }: { leaf: FileTreeLeafDto; depth: number }) {
  return (
    <div
      data-file-path={leaf.path}
      className="px-4 py-2 flex items-center justify-between hover:bg-black/5"
      style={{ paddingLeft: `${16 + depth * 12}px` }}
    >
      <span className="flex items-center gap-2">
        <FileText className="size-3.5 text-mist" strokeWidth={1.5} />
        {leaf.name}
      </span>
      <span className="text-[10px] text-mist">{formatBytes(leaf.sizeBytes)}</span>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Deployments tab
// ---------------------------------------------------------------------------

function DeploymentsTab({ companyId, appId }: { companyId: string; appId: string }) {
  const deploymentsQuery = useQuery({
    queryKey: queryKeys.pluginAppsBuilder.deployments(companyId, appId),
    queryFn: () => pluginAppsBuilderApi.listDeployments(companyId, appId),
  });

  return (
    <section
      data-testid="app-tab-deployments"
      className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto"
    >
      <h2 className="text-lg font-medium mb-4">{copy.deployments.heading}</h2>
      {deploymentsQuery.isLoading ? (
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
      ) : (deploymentsQuery.data?.deployments.length ?? 0) === 0 ? (
        <div
          data-testid="deployments-empty"
          className="border border-dashed border-black/20 rounded-xl p-12 text-center text-sm text-mist"
        >
          {copy.deployments.empty}
        </div>
      ) : (
        <ul className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden">
          {deploymentsQuery.data?.deployments.map((d) => (
            <DeploymentRow key={d.id} deployment={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DeploymentRow({ deployment }: { deployment: DeploymentDto }) {
  const tone =
    deployment.status === "deployed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : deployment.status === "failed"
      ? "bg-red-50 text-red-700 border-red-200"
      : deployment.status === "building"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-black/5 text-mist border-hairline";
  return (
    <li
      data-testid={`deployment-${deployment.id}`}
      className="px-4 py-3 flex items-center justify-between text-sm"
    >
      <div className="flex flex-col">
        <span className="font-mono text-xs">{deployment.url ?? "—"}</span>
        <span className="text-[10px] text-mist">
          {new Date(deployment.triggeredAt).toLocaleString()} ·{" "}
          {copy.deployments.triggeredBy(deployment.triggeredByAgentId)}
        </span>
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${tone}`}
      >
        {copy.deployments.statusLabels[deployment.status]}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Settings tab — env var editor (PATCH + DELETE wired live)
// ---------------------------------------------------------------------------

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

function SettingsTab({ companyId, appId }: { companyId: string; appId: string }) {
  const queryClient = useQueryClient();
  const envQuery = useQuery({
    queryKey: queryKeys.pluginAppsBuilder.env(companyId, appId),
    queryFn: () => pluginAppsBuilderApi.getEnv(companyId, appId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.pluginAppsBuilder.env(companyId, appId),
    });

  const patchMutation = useMutation<unknown, ApiError, { key: string; value: string }>({
    mutationFn: ({ key, value }) =>
      pluginAppsBuilderApi.patchEnv(companyId, appId, { [key]: value }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation<unknown, ApiError, { key: string }>({
    mutationFn: ({ key }) => pluginAppsBuilderApi.deleteEnv(companyId, appId, key),
    onSuccess: invalidate,
  });

  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const envVars = envQuery.data?.envVars ?? {};

  function handleAdd() {
    if (!ENV_KEY_RE.test(draftKey)) {
      setError(copy.settings.invalidKey);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(envVars, draftKey)) {
      setError(copy.settings.duplicateKey);
      return;
    }
    setError(null);
    patchMutation.mutate(
      { key: draftKey, value: draftValue },
      {
        onSuccess: () => {
          setDraftKey("");
          setDraftValue("");
        },
      },
    );
  }

  return (
    <section
      data-testid="app-tab-settings"
      className="flex-1 overflow-y-auto p-8 max-w-3xl w-full mx-auto"
    >
      <h2 className="text-lg font-medium mb-4">{copy.settings.heading}</h2>

      <div
        data-testid="env-add-row"
        className="bg-white border border-hairline rounded-xl p-4 mb-6"
      >
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
          <input
            type="text"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder={copy.settings.keyLabel}
            data-testid="env-key-input"
            className="bg-cream border border-hairline rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-black/30"
          />
          <input
            type="text"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            placeholder={copy.settings.valueLabel}
            data-testid="env-value-input"
            className="bg-cream border border-hairline rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-black/30"
          />
          <button
            type="button"
            data-testid="env-add-cta"
            disabled={
              patchMutation.isPending ||
              draftKey.length === 0 ||
              draftValue.length === 0
            }
            onClick={handleAdd}
            className="bg-black text-white hover:bg-neutral-800 px-4 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="size-3" strokeWidth={2.5} />
            {patchMutation.isPending ? copy.settings.saving : copy.settings.addCta}
          </button>
        </div>
        {error && (
          <p data-testid="env-error" className="text-xs text-red-600 mt-2">
            {error}
          </p>
        )}
      </div>

      {envQuery.isLoading ? (
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
      ) : Object.keys(envVars).length === 0 ? (
        <div
          data-testid="env-empty"
          className="border border-dashed border-black/20 rounded-xl p-12 text-center text-sm text-mist"
        >
          {copy.settings.empty}
        </div>
      ) : (
        <ul
          data-testid="env-list"
          className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden"
        >
          {Object.entries(envVars).map(([key, value]) => (
            <li
              key={key}
              data-testid={`env-row-${key}`}
              className="px-4 py-3 grid grid-cols-[1fr_2fr_auto] gap-3 items-center text-sm"
            >
              <span className="font-mono">{key}</span>
              <span className="font-mono text-mist truncate">{value}</span>
              <button
                type="button"
                data-testid={`env-delete-${key}`}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ key })}
                className="text-mist hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <Trash2 className="size-3" strokeWidth={1.5} />
                {deleteMutation.isPending ? copy.settings.deleting : copy.settings.deleteCta}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-mist mt-3">{copy.settings.note}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / not-found / error
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div
      data-testid="app-detail-skeleton"
      role="status"
      aria-busy="true"
      className="flex-1 flex flex-col h-full bg-cream/40 overflow-hidden"
    >
      <div className="h-14 border-b border-hairline bg-white animate-pulse" />
      <div className="h-12 border-b border-hairline bg-white animate-pulse" />
      <div className="flex-1 p-8">
        <div className="h-64 bg-white border border-hairline rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

function NotFound({ appId }: { appId: string }) {
  return (
    <div
      data-testid="app-detail-not-found"
      role="alert"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8"
    >
      <div className="max-w-md text-center space-y-2">
        <p className="font-medium">{copy.page.notFoundTitle}</p>
        <p className="text-sm text-mist">{copy.page.notFoundBody(appId)}</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      data-testid="app-detail-error"
      role="alert"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8 text-sm text-mist"
    >
      {message}
    </div>
  );
}
