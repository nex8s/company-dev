import { describe, it, expect } from "vitest";
import { runIdentityProviderContract } from "./contract.js";
import { MockIdentityProvider } from "./mock.js";

runIdentityProviderContract("MockIdentityProvider", () => new MockIdentityProvider());

describe("MockIdentityProvider · mock-specific behaviour", () => {
  it("produces stub-prefixed entity ids", async () => {
    const mock = new MockIdentityProvider();
    const result = await mock.createLegalEntity({
      companyId: "77777777-7777-7777-7777-777777777777",
      name: "Stub LLC",
      founderEmail: "f@s.test",
    });
    expect(result.entityId.startsWith("stub-")).toBe(true);
    expect(result.entityType).toBe("Stub");
    expect(result.status).toBe("stub");
    expect(result.estimatedCostUsd).toBe(0);
    expect(result.documents).toEqual([]);
  });

  it("defaults jurisdiction to Delaware when no state is provided", async () => {
    const mock = new MockIdentityProvider();
    const result = await mock.createLegalEntity({
      companyId: "88888888-8888-8888-8888-888888888888",
      name: "Default LLC",
      founderEmail: "f@d.test",
    });
    expect(result.jurisdiction).toBe("Delaware");
  });

  it("logs a structured event on every write", async () => {
    const events: unknown[] = [];
    const mock = new MockIdentityProvider({ log: (e) => events.push(e) });

    const created = await mock.createLegalEntity({
      companyId: "99999999-9999-9999-9999-999999999999",
      name: "Logged LLC",
      founderEmail: "f@l.test",
    });
    await mock.dissolveLegalEntity(created.entityId);

    expect(events).toHaveLength(2);
    expect((events[0] as { intent: string }).intent).toBe("createLegalEntity");
    expect((events[1] as { intent: string }).intent).toBe("dissolveLegalEntity");
  });
});
