/**
 * Server-info provider for the B-08 "Server" settings tab.
 *
 * **Temporary location:** A-09 (Company "Server" panel — Fly machine
 * metadata) had not landed when B-08 shipped. Until A-09 graduates with
 * its own `FlyServerInfoProvider`, B-08 ships a `LocalServerInfoProvider`
 * stub matching the same interface so the tab renders well-formed JSON
 * in dev. Swap the provider injected at the host mount when A-09 lands;
 * no router code needs to change.
 */

export type ServerInstanceState =
  | "starting"
  | "running"
  | "stopped"
  | "destroyed"
  | "unknown";

export interface ServerMachineEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly message: string;
}

export interface ServerInstanceInfo {
  readonly instanceId: string;
  readonly region: string;
  readonly state: ServerInstanceState;
  readonly cpu: { readonly cores: number; readonly utilizationPct: number | null };
  readonly ramMb: { readonly total: number; readonly usedPct: number | null };
  readonly storageGb: { readonly total: number; readonly usedPct: number | null };
  readonly uptimeSeconds: number | null;
  readonly machineEvents: readonly ServerMachineEvent[];
  /** Free-form vendor flag the UI can display (e.g. "fly", "local-dev", "k8s"). */
  readonly source: string;
}

export interface ServerInfoProvider {
  /**
   * The `companyId` is included so a Fly impl can route to the per-company
   * machine app; the `LocalServerInfoProvider` ignores it.
   */
  getServerInfo(input: { companyId: string }): Promise<ServerInstanceInfo>;
}

/**
 * Local-dev stub — returns deterministic but realistic-looking metadata so
 * the UI can render the panel against a fresh checkout. Matches the shape
 * the A-09 spec promises.
 */
export class LocalServerInfoProvider implements ServerInfoProvider {
  async getServerInfo(_input: { companyId: string }): Promise<ServerInstanceInfo> {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000); // pretend up 1h
    return {
      instanceId: "local-dev",
      region: "local",
      state: "running",
      cpu: { cores: 4, utilizationPct: null },
      ramMb: { total: 8 * 1024, usedPct: null },
      storageGb: { total: 64, usedPct: null },
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      machineEvents: [
        {
          id: "local-boot",
          timestamp: startedAt.toISOString(),
          type: "started",
          message: "Local dev server started (no Fly metadata available)",
        },
      ],
      source: "local-dev",
    };
  }
}
