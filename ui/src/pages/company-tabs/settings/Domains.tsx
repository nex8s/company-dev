import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Globe, Star, Trash2 } from "lucide-react";
import { ApiError } from "@/api/client";
import { pluginIdentityApi, type DomainDto } from "@/api/plugin-identity";
import { settingsSubpages as copy } from "@/copy/settings-subpages";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";
import { SubpageShell } from "./SubpageShell";

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function SettingsDomains() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const domainsQuery = useQuery({
    queryKey: queryKeys.pluginIdentity.domains(companyId),
    queryFn: () => pluginIdentityApi.listDomains(companyId),
    enabled: companyId.length > 0,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.pluginIdentity.domains(companyId),
    });

  const createMutation = useMutation<unknown, ApiError, { domain: string }>({
    mutationFn: ({ domain }) => pluginIdentityApi.createDomain(companyId, domain),
    onSuccess: () => {
      setDraft("");
      setLocalError(null);
      invalidate();
    },
  });
  const defaultMutation = useMutation<unknown, ApiError, { domainId: string }>({
    mutationFn: ({ domainId }) =>
      pluginIdentityApi.setDefaultDomain(companyId, domainId),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation<unknown, ApiError, { domainId: string }>({
    mutationFn: ({ domainId }) =>
      pluginIdentityApi.deleteDomain(companyId, domainId),
    onSuccess: invalidate,
  });

  const handleAdd = () => {
    const trimmed = draft.trim().toLowerCase();
    if (!HOSTNAME_RE.test(trimmed)) {
      setLocalError(copy.domains.invalidHostname);
      return;
    }
    setLocalError(null);
    createMutation.mutate({ domain: trimmed });
  };

  return (
    <SubpageShell testId="settings-domains" heading={copy.domains.heading}>
      <div className="bg-white border border-hairline rounded-xl p-4">
        <label className="text-xs font-medium text-mist block mb-2">
          {copy.domains.addLabel}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            data-testid="domain-input"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="example.com"
            className="flex-1 bg-cream border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <button
            type="button"
            data-testid="domain-add-cta"
            disabled={createMutation.isPending || draft.trim().length === 0}
            onClick={handleAdd}
            className="bg-ink text-white hover:bg-neutral-800 px-4 rounded-md text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? copy.domains.adding : copy.domains.addCta}
          </button>
        </div>
        {(localError || createMutation.error) && (
          <p
            data-testid="domain-error"
            className="text-xs text-red-600 mt-2"
            role="alert"
          >
            {localError ?? createMutation.error?.message ?? copy.common.error}
          </p>
        )}
      </div>

      {domainsQuery.isLoading ? (
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
      ) : domainsQuery.error ? (
        <div className="text-sm text-mist" role="alert">{copy.common.error}</div>
      ) : (domainsQuery.data?.domains.length ?? 0) === 0 ? (
        <div
          data-testid="domains-empty"
          className="border border-dashed border-black/20 rounded-xl p-8 text-center text-sm text-mist"
        >
          {copy.domains.empty}
        </div>
      ) : (
        <ul
          data-testid="domains-list"
          className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden"
        >
          {domainsQuery.data?.domains.map((d) => (
            <DomainRow
              key={d.id}
              domain={d}
              onSetDefault={() => defaultMutation.mutate({ domainId: d.id })}
              onDelete={() => deleteMutation.mutate({ domainId: d.id })}
              defaultPending={defaultMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </ul>
      )}
    </SubpageShell>
  );
}

function DomainRow({
  domain,
  onSetDefault,
  onDelete,
  defaultPending,
  deletePending,
}: {
  domain: DomainDto;
  onSetDefault: () => void;
  onDelete: () => void;
  defaultPending: boolean;
  deletePending: boolean;
}) {
  return (
    <li
      data-testid={`domain-row-${domain.id}`}
      className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Globe className="size-4 text-mist" strokeWidth={1.5} />
        <span className="font-mono truncate">{domain.domain}</span>
        {domain.isDefault && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
            <Star className="size-3 inline mr-0.5" strokeWidth={2.5} />
            {copy.domains.defaultBadge}
          </span>
        )}
        <span className="text-[10px] text-mist">
          {copy.domains.statusLabel(domain.status)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!domain.isDefault && (
          <button
            type="button"
            data-testid={`domain-default-${domain.id}`}
            disabled={defaultPending}
            onClick={onSetDefault}
            className="text-xs text-mist hover:text-ink px-2 py-1 rounded-md hover:bg-black/5 flex items-center gap-1 disabled:opacity-40"
          >
            <Check className="size-3" strokeWidth={1.5} />
            {defaultPending ? copy.domains.settingDefault : copy.domains.setDefaultCta}
          </button>
        )}
        <button
          type="button"
          data-testid={`domain-delete-${domain.id}`}
          disabled={deletePending}
          onClick={onDelete}
          className="text-xs text-mist hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md flex items-center gap-1 disabled:opacity-40"
        >
          <Trash2 className="size-3" strokeWidth={1.5} />
          {deletePending ? copy.domains.deleting : copy.domains.deleteCta}
        </button>
      </div>
    </li>
  );
}
