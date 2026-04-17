/**
 * Server-side surface for `@paperclipai/plugin-company` — the Express router
 * factory + the run-status check-in wiring. Imported by the host (Paperclip
 * `server/`) at boot via the documented plugin-company mount point in
 * `server/src/app.ts`.
 *
 * Splitting this under `./server/*` keeps the main entry of the package
 * (consumed by tests and by other plugins) free of express + zod runtime
 * imports, so plugin-company stays usable from contexts that don't ship a
 * web server (the CLI, future workers, etc).
 */

export {
  createPluginCompanyRouter,
  type PluginCompanyActorInfo,
  type PluginCompanyRouterDeps,
} from "./router.js";

export {
  categorizeLiveEvent,
  installCheckInPosterForCompany,
  type CheckInPosterInstallation,
  type HeartbeatLiveEvent,
  type InstallCheckInPosterDeps,
  type LiveEventSubscribe,
} from "./check-in-wiring.js";
