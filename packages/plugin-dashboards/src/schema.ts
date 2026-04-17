import { dashboardPages } from "@paperclipai/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export { dashboardPages };

export type DashboardPage = InferSelectModel<typeof dashboardPages>;
export type NewDashboardPage = InferInsertModel<typeof dashboardPages>;

/**
 * Widget types the A-08 dashboard engine recognises. Each type has a
 * resolver in `./widgets/resolvers.ts` that produces the `data` payload
 * at render-time.
 */
export const DASHBOARD_WIDGET_TYPES = [
  "revenue",
  "ai-usage",
  "team-status",
  "task-kanban",
] as const;
export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

export interface DashboardWidgetPosition {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DashboardWidget {
  readonly id: string;
  readonly type: DashboardWidgetType;
  readonly title?: string;
  readonly params?: Record<string, unknown>;
  readonly position?: DashboardWidgetPosition;
}

export interface DashboardLayout {
  readonly widgets: readonly DashboardWidget[];
}
