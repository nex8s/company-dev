import { describe, it, expect } from "vitest";
import { InMemoryAppsRepository } from "./apps.js";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const CHANNEL_ID = "22222222-2222-2222-2222-222222222222";

describe("plugin-apps-builder · AppsRepository", () => {
  it("creates an App row with the required columns", async () => {
    const repo = new InMemoryAppsRepository();

    const app = await repo.create({
      companyId: COMPANY_ID,
      name: "Landing Page",
    });

    expect(app.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(app.companyId).toBe(COMPANY_ID);
    expect(app.name).toBe("Landing Page");
    expect(app.channelId).toBeNull();
    expect(app.connections).toEqual([]);
    expect(app.envVars).toEqual({});
    expect(app.productionDomain).toBeNull();
    expect(app.createdAt).toBeInstanceOf(Date);
  });

  it("attaches a channel to an existing App", async () => {
    const repo = new InMemoryAppsRepository();

    const app = await repo.create({ companyId: COMPANY_ID, name: "Landing Page" });
    const updated = await repo.attachChannel(app.id, CHANNEL_ID);

    expect(updated.channelId).toBe(CHANNEL_ID);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(app.updatedAt.getTime());

    const fetched = await repo.get(app.id);
    expect(fetched?.channelId).toBe(CHANNEL_ID);
  });

  it("throws when attaching a channel to an unknown App", async () => {
    const repo = new InMemoryAppsRepository();
    await expect(repo.attachChannel("missing", CHANNEL_ID)).rejects.toThrow(/app not found/);
  });
});
