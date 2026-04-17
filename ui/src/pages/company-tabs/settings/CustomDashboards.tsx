import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  pluginDashboardsApi,
  type DashboardPageDto,
} from "@/api/plugin-dashboards";
import { settingsSubpages as copy } from "@/copy/settings-subpages";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";
import { SubpageShell } from "./SubpageShell";

export function SettingsCustomDashboards() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const pagesQuery = useQuery({
    queryKey: queryKeys.pluginDashboards.pages(companyId),
    queryFn: () => pluginDashboardsApi.listPages(companyId),
    enabled: companyId.length > 0,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.pluginDashboards.pages(companyId),
    });

  const createMutation = useMutation<unknown, ApiError, { title: string }>({
    mutationFn: ({ title }) =>
      pluginDashboardsApi.createPage(companyId, {
        title,
        layout: { widgets: [] },
      }),
    onSuccess: () => {
      setTitle("");
      setCreating(false);
      invalidate();
    },
  });

  const deleteMutation = useMutation<unknown, ApiError, { pageId: string }>({
    mutationFn: ({ pageId }) =>
      pluginDashboardsApi.deletePage(companyId, pageId),
    onSuccess: invalidate,
  });

  return (
    <SubpageShell testId="settings-dashboards" heading={copy.dashboards.heading}>
      <div className="flex justify-end">
        {!creating ? (
          <button
            type="button"
            data-testid="dashboard-new-cta"
            onClick={() => setCreating(true)}
            className="bg-ink text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
          >
            <Plus className="size-3" strokeWidth={2.5} />
            {copy.dashboards.newCta}
          </button>
        ) : (
          <div
            data-testid="dashboard-new-form"
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={title}
              data-testid="dashboard-new-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.dashboards.newTitleLabel}
              className="bg-cream border border-hairline rounded-md px-3 py-1.5 text-sm outline-none focus:border-black/30"
            />
            <button
              type="button"
              data-testid="dashboard-new-submit"
              disabled={createMutation.isPending || title.trim().length === 0}
              onClick={() => createMutation.mutate({ title: title.trim() })}
              className="bg-ink text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-40"
            >
              {createMutation.isPending
                ? copy.dashboards.submitting
                : copy.dashboards.newSubmit}
            </button>
          </div>
        )}
      </div>

      {pagesQuery.isLoading ? (
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
      ) : (pagesQuery.data?.pages.length ?? 0) === 0 ? (
        <div
          data-testid="dashboards-empty"
          className="border border-dashed border-black/20 rounded-xl p-8 text-center"
        >
          <LayoutGrid className="size-8 text-mist mx-auto mb-2" strokeWidth={1.5} />
          <p className="font-medium text-sm">{copy.dashboards.emptyTitle}</p>
          <p className="text-xs text-mist mt-1">{copy.dashboards.emptyBody}</p>
        </div>
      ) : (
        <ul
          data-testid="dashboards-list"
          className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden"
        >
          {pagesQuery.data?.pages.map((p) => (
            <DashboardRow
              key={p.id}
              page={p}
              onDelete={() => deleteMutation.mutate({ pageId: p.id })}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </ul>
      )}
    </SubpageShell>
  );
}

function DashboardRow({
  page,
  onDelete,
  deletePending,
}: {
  page: DashboardPageDto;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const widgetCount = page.layout.widgets.length;
  return (
    <li
      data-testid={`dashboard-row-${page.id}`}
      className="px-4 py-3 flex items-center justify-between text-sm"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{page.title}</p>
        <p className="text-xs text-mist">{copy.dashboards.widgetCount(widgetCount)}</p>
      </div>
      <button
        type="button"
        data-testid={`dashboard-delete-${page.id}`}
        disabled={deletePending}
        onClick={onDelete}
        className="text-xs text-mist hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md flex items-center gap-1 disabled:opacity-40"
      >
        <Trash2 className="size-3" strokeWidth={1.5} />
        {deletePending ? copy.dashboards.deleting : copy.dashboards.deleteCta}
      </button>
    </li>
  );
}
