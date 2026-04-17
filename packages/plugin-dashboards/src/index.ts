/**
 * @paperclipai/plugin-dashboards — A-08 custom dashboards.
 *
 * Schema + CRUD for `dashboard_pages` + widget resolvers for the four types
 * PLAN.md lists (revenue, ai-usage, team-status, task-kanban).
 *
 * Server surface (Express router + deps-injected authz) lives under
 * `./server/*` so the main entry stays free of express + zod runtime
 * imports, mirroring plugin-company's layout.
 */

export * from "./schema.js";
export * from "./pages/operations.js";
export * from "./widgets/resolvers.js";

export interface DashboardsPluginRegistration {
  readonly name: "plugin-dashboards";
  readonly version: string;
}

export function registerPlugin(): DashboardsPluginRegistration {
  return {
    name: "plugin-dashboards",
    version: "0.1.0",
  };
}
