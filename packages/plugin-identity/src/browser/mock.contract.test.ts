import { describe, it, expect } from "vitest";
import { runBrowserProviderContract } from "./contract.js";
import { MockBrowserProvider } from "./mock.js";

runBrowserProviderContract("MockBrowserProvider", () => new MockBrowserProvider());

describe("MockBrowserProvider · mock-specific behaviour", () => {
  it("startSession returns inactive/null — matches the prototype's empty state", async () => {
    const mock = new MockBrowserProvider();
    const session = await mock.startSession({
      agentId: "agent-x",
      purpose: "reading docs",
    });
    expect(session.status).toBe("inactive");
    expect(session.liveViewUrl).toBeNull();
    expect(session.purpose).toBe("reading docs");
  });

  it("startSession leaves liveViewUrl null even when the caller sets liveView: true", async () => {
    const mock = new MockBrowserProvider();
    const session = await mock.startSession({
      agentId: "agent-y",
      purpose: "watch me",
      liveView: true,
    });
    expect(session.liveViewUrl).toBeNull();
  });

  it("attachTool returns a no-op handle", async () => {
    const mock = new MockBrowserProvider();
    const session = await mock.startSession({ agentId: "agent-z", purpose: "noop" });
    const handle = await mock.attachTool(session.sessionId, "playwright");
    expect(handle.noop).toBe(true);
    expect(handle.tool).toBe("playwright");
  });

  it("getSessionArtifacts always returns []", async () => {
    const mock = new MockBrowserProvider();
    const session = await mock.startSession({
      agentId: "agent-artifact",
      purpose: "capture",
    });
    expect(await mock.getSessionArtifacts(session.sessionId)).toEqual([]);
    expect(await mock.getSessionArtifacts("unknown-session")).toEqual([]);
  });

  it("produces bsession- prefixed session ids", async () => {
    const mock = new MockBrowserProvider();
    const session = await mock.startSession({ agentId: "agent-id", purpose: "id" });
    expect(session.sessionId.startsWith("bsession-")).toBe(true);
  });

  it("logs a structured event on every write", async () => {
    const events: { intent: string }[] = [];
    const mock = new MockBrowserProvider({ log: (e) => events.push(e) });
    const session = await mock.startSession({ agentId: "agent-log", purpose: "log" });
    await mock.attachTool(session.sessionId, "mcp");
    await mock.stopSession(session.sessionId);
    expect(events.map((e) => e.intent)).toEqual([
      "startSession",
      "attachTool",
      "stopSession",
    ]);
  });
});
