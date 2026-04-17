import { describe, expect, it } from "vitest";
import { resolveServerPanel } from "./resolver.js";

const fixedNow = () => new Date("2026-04-17T15:00:00.000Z");

function mockFetch(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url);
  }) as typeof fetch;
}

function jsonRes(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveServerPanel (A-09)", () => {
  it("returns `mode: local-dev-stub` when FLY_APP_NAME is absent", async () => {
    const data = await resolveServerPanel({ flyAppName: null, flyApiToken: null }, { now: fixedNow });
    expect(data.mode).toBe("local-dev-stub");
    expect(data.instance).toMatchObject({
      machineId: "local-dev",
      appName: "company-dev-local",
      region: "local",
      state: "started",
      cpuKind: "shared",
      cpus: 1,
      memoryMb: 1024,
    });
    expect(data.machineEvents).toHaveLength(1);
    expect(data.machineEvents[0]!.type).toBe("boot");
    expect(data.note).toMatch(/local-dev/);
    expect(data.fetchedAt).toBe("2026-04-17T15:00:00.000Z");
  });

  it("trims whitespace-only config values and still returns the stub", async () => {
    const data = await resolveServerPanel({ flyAppName: "   ", flyApiToken: "\t" }, { now: fixedNow });
    expect(data.mode).toBe("local-dev-stub");
  });

  it("falls back to stub with an explanatory note when flyAppName is set but token is missing", async () => {
    const data = await resolveServerPanel(
      { flyAppName: "company-dev-staging", flyApiToken: null },
      { now: fixedNow },
    );
    expect(data.mode).toBe("local-dev-stub");
    expect(data.note).toMatch(/FLY_API_TOKEN is missing/);
  });

  it("hits the Fly Machines API and normalizes machine + event data when both env vars are set", async () => {
    const calls: string[] = [];
    const machines = [
      {
        id: "1782abcdef",
        state: "started",
        region: "iad",
        private_ip: "fdaa:0:1:2",
        created_at: "2026-04-10T00:00:00Z",
        updated_at: "2026-04-17T12:00:00Z",
        config: {
          image: "registry.fly.io/company-dev-staging:deployment-01",
          guest: { cpu_kind: "shared", cpus: 2, memory_mb: 2048 },
        },
      },
    ];
    const events = [
      {
        id: "evt_1",
        type: "launch",
        status: "success",
        source: "user",
        timestamp: "2026-04-10T00:00:00Z",
      },
      {
        id: "evt_2",
        type: "start",
        status: "success",
        source: "flyd",
        timestamp: "2026-04-17T11:59:58Z",
      },
    ];
    const fetchImpl = mockFetch((url) => {
      calls.push(url);
      if (url.endsWith("/apps/company-dev-staging/machines")) return jsonRes(machines);
      if (url.endsWith("/apps/company-dev-staging/machines/1782abcdef/events"))
        return jsonRes(events);
      return jsonRes({ error: "unexpected" }, { status: 404 });
    });

    const data = await resolveServerPanel(
      {
        flyAppName: "company-dev-staging",
        flyApiToken: "fly_secret",
        flyApiBaseUrl: "https://api.machines.dev/v1",
      },
      { fetch: fetchImpl, now: fixedNow },
    );

    expect(data.mode).toBe("fly");
    expect(data.instance).toMatchObject({
      machineId: "1782abcdef",
      appName: "company-dev-staging",
      region: "iad",
      state: "started",
      cpuKind: "shared",
      cpus: 2,
      memoryMb: 2048,
      image: "registry.fly.io/company-dev-staging:deployment-01",
      privateIp: "fdaa:0:1:2",
    });
    expect(data.machineEvents).toHaveLength(2);
    expect(data.machineEvents[0]!.type).toBe("launch");
    expect(data.note).toBeNull();
    expect(calls[0]).toContain("/apps/company-dev-staging/machines");
  });

  it("selects a specific machine when flyMachineId is configured", async () => {
    const machines = [
      { id: "m1", state: "stopped", region: "iad", config: { guest: { cpus: 1, memory_mb: 256 } } },
      { id: "m2", state: "started", region: "sjc", config: { guest: { cpus: 4, memory_mb: 4096 } } },
    ];
    const fetchImpl = mockFetch((url) => {
      if (url.endsWith("/machines")) return jsonRes(machines);
      return jsonRes([]);
    });

    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t", flyMachineId: "m2" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.instance?.machineId).toBe("m2");
    expect(data.instance?.region).toBe("sjc");
  });

  it("falls back to the first machine if flyMachineId does not match any", async () => {
    const machines = [{ id: "m1", state: "started", config: { guest: { cpus: 1, memory_mb: 256 } } }];
    const fetchImpl = mockFetch((url) => (url.endsWith("/machines") ? jsonRes(machines) : jsonRes([])));

    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t", flyMachineId: "missing-id" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.instance?.machineId).toBe("m1");
  });

  it("returns `mode: fly` with a note when listMachines fails, rather than crashing", async () => {
    const fetchImpl = mockFetch(() => jsonRes({ error: "auth" }, { status: 401 }));
    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.mode).toBe("fly");
    expect(data.instance).toBeNull();
    expect(data.note).toMatch(/HTTP 401/);
  });

  it("returns `mode: fly` with a note when Fly has no machines for the app", async () => {
    const fetchImpl = mockFetch(() => jsonRes([]));
    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.mode).toBe("fly");
    expect(data.instance).toBeNull();
    expect(data.note).toMatch(/No machines found/);
  });

  it("treats a failing events fetch as non-fatal — instance still returned, events empty", async () => {
    const machines = [{ id: "m1", state: "started", config: { guest: { cpus: 1, memory_mb: 256 } } }];
    const fetchImpl = mockFetch((url) => {
      if (url.endsWith("/machines")) return jsonRes(machines);
      return jsonRes({ error: "not found" }, { status: 404 });
    });
    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.mode).toBe("fly");
    expect(data.instance?.machineId).toBe("m1");
    expect(data.machineEvents).toEqual([]);
  });

  it("survives a thrown fetch error and returns a graceful degraded payload", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("connection refused");
    };
    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.mode).toBe("fly");
    expect(data.instance).toBeNull();
    expect(data.note).toMatch(/connection refused/);
  });

  it("caps machineEvents at 20", async () => {
    const machines = [{ id: "m1", state: "started", config: { guest: { cpus: 1, memory_mb: 256 } } }];
    const events = Array.from({ length: 50 }, (_, i) => ({
      id: `e${i}`,
      type: "tick",
      timestamp: new Date(2026, 3, 1, 0, 0, i).toISOString(),
    }));
    const fetchImpl = mockFetch((url) =>
      url.endsWith("/machines") ? jsonRes(machines) : jsonRes(events),
    );
    const data = await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "t" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(data.machineEvents).toHaveLength(20);
  });

  it("attaches the Bearer token to requests", async () => {
    const captured: Headers[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      captured.push(new Headers(init?.headers ?? {}));
      return jsonRes([]);
    };
    await resolveServerPanel(
      { flyAppName: "x", flyApiToken: "my-secret" },
      { fetch: fetchImpl, now: fixedNow },
    );
    expect(captured[0]?.get("authorization")).toBe("Bearer my-secret");
  });
});
