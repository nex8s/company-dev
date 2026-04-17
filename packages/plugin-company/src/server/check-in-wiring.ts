import {
  type CheckInLifecycleKind,
  type CheckInPoster,
  type RunLifecycleEvent,
} from "../heartbeat/check-in-poster.js";

/**
 * Subset of Paperclip's `LiveEvent` envelope this wiring needs. Modelled as a
 * structural type so plugin-company doesn't depend on the host's live-event
 * concrete type.
 */
export interface HeartbeatLiveEvent {
  readonly companyId: string;
  readonly type: string;
  readonly payload?: Record<string, unknown> | null;
}

/**
 * Subscribe-API plugin-company expects from the host. Matches the shape of
 * `subscribeCompanyLiveEvents(companyId, listener)` returning an unsubscribe
 * function — see server/src/services/live-events.ts.
 */
export type LiveEventSubscribe = (
  companyId: string,
  listener: (event: HeartbeatLiveEvent) => void,
) => () => void;

/**
 * Map a live event payload to a check-in lifecycle kind. Returns null if the
 * event is not one of the categories that produces a check-in.
 *
 * Recognised heartbeat lifecycle messages (heartbeat.run.event with
 * payload.eventType === "lifecycle"):
 *   - "Detached child process reported activity; cleared detached warning" → error_recovery
 *   - any message containing "recovered" → error_recovery
 *   - any message containing "restarted" or "process_lost" → restart
 *   - any message containing "retry" or "retried" → retry
 *
 * The host can also publish a structured plugin-company event by setting
 * payload.eventType === "checkin" and payload.kind to one of the lifecycle
 * kinds; that path bypasses the message heuristic entirely.
 */
export function categorizeLiveEvent(event: HeartbeatLiveEvent): {
  kind: CheckInLifecycleKind;
  detail?: string | null;
  errorCode?: string | null;
  runId: string;
} | null {
  if (event.type !== "heartbeat.run.event") return null;
  const payload = event.payload ?? {};
  const runId = readString(payload.runId);
  if (!runId) return null;

  // Structured path — host or another plugin opted into the explicit shape.
  if (payload.eventType === "checkin") {
    const kind = readKind(payload.kind);
    if (!kind) return null;
    return {
      runId,
      kind,
      detail: readNullableString(payload.detail),
      errorCode: readNullableString(payload.errorCode),
    };
  }

  if (payload.eventType !== "lifecycle") return null;
  const message = readString(payload.message)?.toLowerCase() ?? "";
  const detail = readString(payload.message) ?? null;
  const errorCode = readNullableString(payload.errorCode);

  if (message.includes("recovered") || message.includes("cleared detached")) {
    return { runId, kind: "error_recovery", detail, errorCode };
  }
  if (message.includes("restarted") || message.includes("process lost") || message.includes("process_lost")) {
    return { runId, kind: "restart", detail, errorCode };
  }
  if (message.includes("retry") || message.includes("retried")) {
    return { runId, kind: "retry", detail, errorCode };
  }
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readKind(value: unknown): CheckInLifecycleKind | null {
  return value === "error_recovery" || value === "restart" || value === "retry" ? value : null;
}

export interface InstallCheckInPosterDeps {
  readonly subscribe: LiveEventSubscribe;
  readonly poster: CheckInPoster;
  /** Optional logger; defaults to console.warn for handler errors. */
  readonly onError?: (err: unknown, event: HeartbeatLiveEvent) => void;
}

export interface CheckInPosterInstallation {
  /** Tear down the per-company subscription. */
  readonly dispose: () => void;
}

/**
 * Wire the check-in poster onto a single company's live-event stream. Each
 * matching `heartbeat.run.event` lifecycle entry is categorized and forwarded
 * to the poster.
 *
 * Returns an installation handle whose `dispose()` removes the listener.
 * Multiple companies are wired by calling this once per company; the wiring
 * layer (server bootstrap) holds the handles and disposes them on shutdown.
 */
export function installCheckInPosterForCompany(
  companyId: string,
  deps: InstallCheckInPosterDeps,
): CheckInPosterInstallation {
  const onError = deps.onError ?? defaultOnError;
  const unsubscribe = deps.subscribe(companyId, (event) => {
    const categorized = categorizeLiveEvent(event);
    if (!categorized) return;
    const lifecycleEvent: RunLifecycleEvent = {
      runId: categorized.runId,
      companyId,
      kind: categorized.kind,
      detail: categorized.detail ?? null,
      errorCode: categorized.errorCode ?? null,
    };
    void deps.poster.postCheckIn(lifecycleEvent).catch((err) => onError(err, event));
  });
  return { dispose: unsubscribe };
}

function defaultOnError(err: unknown, event: HeartbeatLiveEvent) {
  // eslint-disable-next-line no-console
  console.warn("[plugin-company] check-in poster failed", { err, event });
}

/**
 * Subscribe-API for a single process-wide hook on every company's heartbeat
 * stream. Matches `subscribeAllCompaniesLiveEvents(listener)` from
 * server/src/services/live-events.ts (introduced in A-06.6).
 *
 * This replaces the per-company install loop used in A-06.5 — new companies
 * created at runtime are now auto-wired without any additional plumbing.
 */
export type AllCompaniesLiveEventSubscribe = (
  listener: (event: HeartbeatLiveEvent) => void,
) => () => void;

export interface InstallCheckInPosterAllCompaniesDeps {
  readonly subscribeAll: AllCompaniesLiveEventSubscribe;
  readonly poster: CheckInPoster;
  readonly onError?: (err: unknown, event: HeartbeatLiveEvent) => void;
}

/**
 * Wire the check-in poster onto every company's heartbeat stream via a single
 * global subscription. Returns an installation handle whose `dispose()`
 * removes the listener.
 */
export function installCheckInPosterAllCompanies(
  deps: InstallCheckInPosterAllCompaniesDeps,
): CheckInPosterInstallation {
  const onError = deps.onError ?? defaultOnError;
  const unsubscribe = deps.subscribeAll((event) => {
    const categorized = categorizeLiveEvent(event);
    if (!categorized) return;
    const lifecycleEvent: RunLifecycleEvent = {
      runId: categorized.runId,
      companyId: event.companyId,
      kind: categorized.kind,
      detail: categorized.detail ?? null,
      errorCode: categorized.errorCode ?? null,
    };
    void deps.poster.postCheckIn(lifecycleEvent).catch((err) => onError(err, event));
  });
  return { dispose: unsubscribe };
}
