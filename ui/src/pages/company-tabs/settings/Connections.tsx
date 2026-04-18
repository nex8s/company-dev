import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plug, Trash2 } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  pluginConnectToolsApi,
  type AdapterDto,
  type ConnectionDto,
} from "@/api/plugin-connect-tools";
import { settingsSubpages as copy } from "@/copy/settings-subpages";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";
import { SubpageShell } from "./SubpageShell";

export function SettingsConnections() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const [openAdapter, setOpenAdapter] = useState<AdapterDto | null>(null);

  const adaptersQuery = useQuery({
    queryKey: queryKeys.pluginConnectTools.adapters(companyId),
    queryFn: () => pluginConnectToolsApi.listAdapters(companyId),
    enabled: companyId.length > 0,
  });

  const connectionsQuery = useQuery({
    queryKey: queryKeys.pluginConnectTools.connections(companyId),
    queryFn: () => pluginConnectToolsApi.listConnections(companyId),
    enabled: companyId.length > 0,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.pluginConnectTools.connections(companyId),
    });

  const deleteMutation = useMutation<unknown, ApiError, { connectionId: string }>({
    mutationFn: ({ connectionId }) =>
      pluginConnectToolsApi.deleteConnection(companyId, connectionId),
    onSuccess: invalidate,
  });

  return (
    <SubpageShell testId="settings-connections" heading={copy.connections.heading}>
      {connectionsQuery.isLoading ? (
        <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
      ) : (connectionsQuery.data?.connections.length ?? 0) === 0 ? (
        <div
          data-testid="connections-empty"
          className="border border-dashed border-black/20 rounded-xl p-8 text-center"
        >
          <Plug className="size-8 text-mist mx-auto mb-2" strokeWidth={1.5} />
          <p className="font-medium text-sm">{copy.connections.emptyTitle}</p>
          <p className="text-xs text-mist mt-1">{copy.connections.emptyBody}</p>
        </div>
      ) : (
        <ul
          data-testid="connections-list"
          className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden"
        >
          {connectionsQuery.data?.connections.map((c) => (
            <ConnectionRow
              key={c.id}
              connection={c}
              onDelete={() => deleteMutation.mutate({ connectionId: c.id })}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </ul>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mist mb-3">
          {copy.connections.listAdaptersHeading}
        </h3>
        {adaptersQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 bg-white border border-hairline rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <ul
            data-testid="adapters-list"
            className="grid grid-cols-2 gap-3"
          >
            {adaptersQuery.data?.adapters.map((a) => (
              <li
                key={a.kind}
                data-testid={`adapter-${a.kind}`}
                className="bg-white border border-hairline rounded-xl p-4 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.displayName}</p>
                  <p className="text-xs text-mist truncate">{a.kind}</p>
                </div>
                <button
                  type="button"
                  data-testid={`adapter-connect-${a.kind}`}
                  onClick={() => setOpenAdapter(a)}
                  className="text-xs bg-ink text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full flex items-center gap-1"
                >
                  <Link2 className="size-3" strokeWidth={2} />
                  {copy.connections.connectCta}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openAdapter && (
        <ConnectForm
          adapter={openAdapter}
          onClose={() => setOpenAdapter(null)}
          onConnected={() => {
            setOpenAdapter(null);
            invalidate();
          }}
          companyId={companyId}
        />
      )}
    </SubpageShell>
  );
}

function ConnectionRow({
  connection,
  onDelete,
  deletePending,
}: {
  connection: ConnectionDto;
  onDelete: () => void;
  deletePending: boolean;
}) {
  return (
    <li
      data-testid={`connection-row-${connection.id}`}
      className="px-4 py-3 flex items-center justify-between text-sm"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{connection.label}</p>
        <p className="text-xs text-mist">
          {connection.toolKind} · {copy.connections.tokenEnding(connection.tokenLast4)}{" "}
          · {copy.connections.connectedAt(connection.connectedAt)}
        </p>
      </div>
      <button
        type="button"
        data-testid={`connection-delete-${connection.id}`}
        disabled={deletePending}
        onClick={onDelete}
        className="text-xs text-mist hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md flex items-center gap-1 disabled:opacity-40"
      >
        <Trash2 className="size-3" strokeWidth={1.5} />
        {deletePending ? copy.connections.disconnecting : copy.connections.disconnectCta}
      </button>
    </li>
  );
}

function ConnectForm({
  adapter,
  onClose,
  onConnected,
  companyId,
}: {
  adapter: AdapterDto;
  onClose: () => void;
  onConnected: () => void;
  companyId: string;
}) {
  const [label, setLabel] = useState(adapter.displayName);
  const [token, setToken] = useState("");

  const createMutation = useMutation<unknown, ApiError, void>({
    mutationFn: () =>
      pluginConnectToolsApi.createConnection(companyId, {
        toolKind: adapter.kind,
        label,
        token,
        scopes: adapter.defaultScopes,
      }),
    onSuccess: onConnected,
  });

  return (
    <div
      data-testid="connect-form"
      className="bg-white border border-hairline rounded-xl p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{adapter.displayName}</h4>
        <button
          type="button"
          data-testid="connect-cancel"
          onClick={onClose}
          className="text-xs text-mist hover:text-ink"
        >
          {copy.connections.cancelCta}
        </button>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-mist">
          {copy.connections.formLabel}
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-cream border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-black/30"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-mist">
          {copy.connections.formToken}
        </label>
        <input
          type="password"
          value={token}
          data-testid="connect-token"
          onChange={(e) => setToken(e.target.value)}
          className="w-full bg-cream border border-hairline rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-black/30"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="connect-submit"
          disabled={
            createMutation.isPending || label.length === 0 || token.length === 0
          }
          onClick={() => createMutation.mutate()}
          className="bg-ink text-white hover:bg-neutral-800 px-4 py-2 rounded-full text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {createMutation.isPending
            ? copy.connections.submitting
            : copy.connections.formSubmit}
        </button>
      </div>
    </div>
  );
}
