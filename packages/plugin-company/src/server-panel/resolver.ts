/**
 * A-09 Server panel resolver — if FLY_APP_NAME + FLY_API_TOKEN are present
 * in the environment, fetch live machine metadata from the Fly Machines API
 * (https://api.machines.dev/v1). Otherwise return a deterministic
 * local-dev stub so the Settings → Server UI renders the same shape in
 * every deployment mode.
 *
 * The resolver is a pure function taking injected config + an optional
 * `fetch` implementation. The route handler is responsible for reading
 * `process.env` and passing values in — this keeps the resolver trivially
 * testable without environment manipulation.
 */

export type ServerPanelMode = "fly" | "local-dev-stub";

export interface ServerPanelInstance {
  readonly machineId: string;
  readonly appName: string;
  readonly region: string;
  readonly state: string;
  readonly cpuKind: string;
  readonly cpus: number;
  readonly memoryMb: number;
  readonly image: string | null;
  readonly privateIp: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

export interface ServerPanelMachineEvent {
  readonly id: string;
  readonly type: string;
  readonly status: string | null;
  readonly source: string | null;
  readonly timestamp: string;
}

export interface ServerPanelData {
  readonly mode: ServerPanelMode;
  readonly instance: ServerPanelInstance | null;
  readonly machineEvents: readonly ServerPanelMachineEvent[];
  readonly note: string | null;
  readonly fetchedAt: string;
}

export interface ServerPanelResolverConfig {
  /** Fly app name (`FLY_APP_NAME`). Required for `mode: "fly"`. */
  readonly flyAppName?: string | null;
  /** Fly API token (`FLY_API_TOKEN`). Required for `mode: "fly"`. */
  readonly flyApiToken?: string | null;
  /** Optional: target a specific machine. Defaults to the first in the list. */
  readonly flyMachineId?: string | null;
  /** Override the Fly Machines base URL (test injection). Defaults to https://api.machines.dev/v1. */
  readonly flyApiBaseUrl?: string | null;
  /** Request timeout in ms. Defaults to 5000. */
  readonly requestTimeoutMs?: number;
}

export interface ServerPanelResolverDeps {
  /** Injectable fetch for tests. Defaults to global `fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  /** Injectable clock for tests. Defaults to `() => new Date()`. */
  readonly now?: () => Date;
}

const DEFAULT_FLY_API_BASE = "https://api.machines.dev/v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const MAX_EVENTS_RETURNED = 20;

export async function resolveServerPanel(
  config: ServerPanelResolverConfig,
  deps: ServerPanelResolverDeps = {},
): Promise<ServerPanelData> {
  const now = (deps.now ?? (() => new Date()))();
  const fetchedAt = now.toISOString();

  const appName = readNonEmpty(config.flyAppName);
  const token = readNonEmpty(config.flyApiToken);

  if (!appName) {
    return localDevStub(fetchedAt);
  }
  if (!token) {
    return {
      ...localDevStub(fetchedAt),
      note:
        "FLY_APP_NAME is set but FLY_API_TOKEN is missing; returning local-dev stub. " +
        "Set FLY_API_TOKEN to enable live Fly machine metadata.",
    };
  }

  const baseUrl = readNonEmpty(config.flyApiBaseUrl) ?? DEFAULT_FLY_API_BASE;
  const timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    return {
      mode: "fly",
      instance: null,
      machineEvents: [],
      note: "No fetch implementation available in this runtime.",
      fetchedAt,
    };
  }

  try {
    const machines = await listMachines({ fetchImpl, baseUrl, appName, token, timeoutMs });
    if (machines.length === 0) {
      return {
        mode: "fly",
        instance: null,
        machineEvents: [],
        note: `No machines found for Fly app "${appName}".`,
        fetchedAt,
      };
    }

    const targetMachineId = readNonEmpty(config.flyMachineId);
    const machine = targetMachineId
      ? machines.find((m) => m.id === targetMachineId) ?? machines[0]!
      : machines[0]!;
    const machineIdForEvents = readString(machine.id) ?? "unknown";

    const events = await listMachineEvents({
      fetchImpl,
      baseUrl,
      appName,
      token,
      timeoutMs,
      machineId: machineIdForEvents,
    });

    return {
      mode: "fly",
      instance: normalizeInstance(appName, machine),
      machineEvents: events.slice(0, MAX_EVENTS_RETURNED).map(normalizeEvent),
      note: null,
      fetchedAt,
    };
  } catch (err) {
    return {
      mode: "fly",
      instance: null,
      machineEvents: [],
      note: `Failed to reach Fly API: ${err instanceof Error ? err.message : String(err)}`,
      fetchedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Stub
// ---------------------------------------------------------------------------

function localDevStub(fetchedAt: string): ServerPanelData {
  return {
    mode: "local-dev-stub",
    instance: {
      machineId: "local-dev",
      appName: "company-dev-local",
      region: "local",
      state: "started",
      cpuKind: "shared",
      cpus: 1,
      memoryMb: 1024,
      image: null,
      privateIp: null,
      createdAt: null,
      updatedAt: fetchedAt,
    },
    machineEvents: [
      {
        id: "local-boot",
        type: "boot",
        status: "completed",
        source: "local-dev",
        timestamp: fetchedAt,
      },
    ],
    note: "Running in local-dev; Fly machine metadata unavailable. Deploy to Fly to see live data.",
    fetchedAt,
  };
}

// ---------------------------------------------------------------------------
// Fly API calls
// ---------------------------------------------------------------------------

interface FetchOpts {
  readonly fetchImpl: typeof globalThis.fetch;
  readonly baseUrl: string;
  readonly appName: string;
  readonly token: string;
  readonly timeoutMs: number;
}

async function listMachines(opts: FetchOpts): Promise<FlyMachine[]> {
  const url = `${opts.baseUrl}/apps/${encodeURIComponent(opts.appName)}/machines`;
  const res = await fetchWithTimeout(opts.fetchImpl, url, opts.token, opts.timeoutMs);
  if (!res.ok) throw new Error(`Fly listMachines → HTTP ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) throw new Error("Fly listMachines: unexpected response (not an array)");
  return json as FlyMachine[];
}

async function listMachineEvents(opts: FetchOpts & { machineId: string }): Promise<FlyMachineEvent[]> {
  const url = `${opts.baseUrl}/apps/${encodeURIComponent(opts.appName)}/machines/${encodeURIComponent(
    opts.machineId,
  )}/events`;
  const res = await fetchWithTimeout(opts.fetchImpl, url, opts.token, opts.timeoutMs);
  if (!res.ok) {
    // Events are best-effort — a 404 here shouldn't nuke the whole panel.
    return [];
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return json as FlyMachineEvent[];
}

async function fetchWithTimeout(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  token: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

interface FlyMachine {
  readonly id?: string;
  readonly name?: string;
  readonly state?: string;
  readonly region?: string;
  readonly private_ip?: string;
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly config?: {
    readonly image?: string;
    readonly guest?: {
      readonly cpu_kind?: string;
      readonly cpus?: number;
      readonly memory_mb?: number;
    };
  };
}

interface FlyMachineEvent {
  readonly id?: string;
  readonly type?: string;
  readonly status?: string;
  readonly source?: string;
  readonly timestamp?: string | number;
}

function normalizeInstance(appName: string, m: FlyMachine): ServerPanelInstance {
  return {
    machineId: readString(m.id) ?? "unknown",
    appName,
    region: readString(m.region) ?? "unknown",
    state: readString(m.state) ?? "unknown",
    cpuKind: readString(m.config?.guest?.cpu_kind) ?? "unknown",
    cpus: typeof m.config?.guest?.cpus === "number" ? m.config.guest.cpus : 0,
    memoryMb: typeof m.config?.guest?.memory_mb === "number" ? m.config.guest.memory_mb : 0,
    image: readString(m.config?.image) ?? null,
    privateIp: readString(m.private_ip) ?? null,
    createdAt: readString(m.created_at) ?? null,
    updatedAt: readString(m.updated_at) ?? null,
  };
}

function normalizeEvent(e: FlyMachineEvent): ServerPanelMachineEvent {
  const timestamp =
    typeof e.timestamp === "number"
      ? new Date(e.timestamp).toISOString()
      : readString(e.timestamp) ?? new Date(0).toISOString();
  return {
    id: readString(e.id) ?? `${e.type ?? "event"}-${timestamp}`,
    type: readString(e.type) ?? "unknown",
    status: readString(e.status) ?? null,
    source: readString(e.source) ?? null,
    timestamp,
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
