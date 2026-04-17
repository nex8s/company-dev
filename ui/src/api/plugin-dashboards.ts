import { api } from "./client";

/**
 * Typed client for A-08 plugin-dashboards HTTP routes.
 * Mounted under `/api/companies/:companyId/plugin-dashboards/...`.
 */

export interface DashboardWidget {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly params?: Record<string, unknown>;
  readonly position?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export interface DashboardLayout {
  readonly widgets: readonly DashboardWidget[];
}

export interface DashboardPageDto {
  readonly id: string;
  readonly title: string;
  readonly layout: DashboardLayout;
}

const base = (companyId: string) => `/companies/${companyId}/plugin-dashboards`;

export const pluginDashboardsApi = {
  listPages: (companyId: string) =>
    api.get<{ pages: readonly DashboardPageDto[] }>(`${base(companyId)}/pages`),

  createPage: (
    companyId: string,
    body: { title: string; layout: DashboardLayout },
  ) =>
    api.post<{ page: DashboardPageDto }>(`${base(companyId)}/pages`, body),

  getPage: (companyId: string, pageId: string) =>
    api.get<{ page: DashboardPageDto }>(
      `${base(companyId)}/pages/${pageId}`,
    ),

  deletePage: (companyId: string, pageId: string) =>
    api.delete<void>(`${base(companyId)}/pages/${pageId}`),
};
