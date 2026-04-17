/**
 * @paperclipai/plugin-company — Company.dev domain plugin.
 *
 * Scaffold only at A-01. Subsequent tasks (A-02..A-10) add:
 *   - CompanyProfile schema + migrations
 *   - Agent role seeding (CEO + department factory)
 *   - Getting Started checklist state machine
 *   - Pending review queue
 *   - Heartbeat / check-in system messages
 *   - Credit ledger wiring
 *   - Custom dashboard pages
 *   - Server panel (Fly machine metadata)
 *   - Publishing → Store bridge
 */

export * from "./schema.js";
export * from "./agents/factory.js";
export * from "./agents/prompts.js";
export * from "./getting-started/checklist.js";
export * from "./getting-started/steps.js";
export * from "./reviews/queue.js";

export interface CompanyPluginRegistration {
  readonly name: "plugin-company";
  readonly version: string;
}

/**
 * Register the plugin with the host. Called by server boot.
 *
 * At A-01 this is an inert marker. Later tasks add hooks, routes, and
 * schema registration through the context argument.
 */
export function registerPlugin(): CompanyPluginRegistration {
  return {
    name: "plugin-company",
    version: "0.3.1",
  };
}
