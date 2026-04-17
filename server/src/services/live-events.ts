import { EventEmitter } from "node:events";
import type { LiveEvent, LiveEventType } from "@paperclipai/shared";

type LiveEventPayload = Record<string, unknown>;
type LiveEventListener = (event: LiveEvent) => void;

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

/**
 * Listeners registered via `subscribeAllCompaniesLiveEvents`. Held outside the
 * EventEmitter (which keys on event name) so a single subscription receives
 * every per-company emit without having to know the company set in advance.
 *
 * Used by plugin bootstraps that need a process-wide hook on the heartbeat
 * stream — see plugin-company's `installCheckInPosterAllCompanies`.
 */
const allCompaniesListeners = new Set<LiveEventListener>();

let nextEventId = 0;

function toLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}): LiveEvent {
  nextEventId += 1;
  return {
    id: nextEventId,
    companyId: input.companyId,
    type: input.type,
    createdAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };
}

export function publishLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}) {
  const event = toLiveEvent(input);
  emitter.emit(input.companyId, event);
  for (const listener of allCompaniesListeners) {
    try {
      listener(event);
    } catch {
      // Listeners are best-effort; a single broken subscriber must not block
      // delivery to other subscribers or to the per-company channel above.
    }
  }
  return event;
}

export function publishGlobalLiveEvent(input: {
  type: LiveEventType;
  payload?: LiveEventPayload;
}) {
  const event = toLiveEvent({ companyId: "*", type: input.type, payload: input.payload });
  emitter.emit("*", event);
  return event;
}

export function subscribeCompanyLiveEvents(companyId: string, listener: LiveEventListener) {
  emitter.on(companyId, listener);
  return () => emitter.off(companyId, listener);
}

export function subscribeGlobalLiveEvents(listener: LiveEventListener) {
  emitter.on("*", listener);
  return () => emitter.off("*", listener);
}

/**
 * Subscribe to every per-company `publishLiveEvent` emission across the
 * process. Returns an unsubscribe function. Idempotent on the listener
 * identity — subscribing the same function twice attaches it once.
 *
 * Use this for plugin bootstraps that need a process-wide hook (e.g.
 * plugin-company's check-in poster) so newly created companies are wired
 * automatically without a per-company install loop.
 *
 * Listener errors are caught so a single misbehaving subscriber cannot
 * break delivery to other subscribers or to per-company channels.
 */
export function subscribeAllCompaniesLiveEvents(listener: LiveEventListener) {
  allCompaniesListeners.add(listener);
  return () => {
    allCompaniesListeners.delete(listener);
  };
}
