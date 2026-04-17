import { describe, it, expect } from "vitest";
import type { BrowserProvider } from "./provider.js";

export type BrowserProviderFactory = () => BrowserProvider | Promise<BrowserProvider>;

/**
 * Shared contract every BrowserProvider implementation must satisfy.
 * Apply from each impl's *.contract.test.ts via `runBrowserProviderContract(...)`.
 */
export function runBrowserProviderContract(
  label: string,
  factory: BrowserProviderFactory,
): void {
  describe(`BrowserProvider contract · ${label}`, () => {
    it("startSession returns the UI response shape", async () => {
      const provider = await factory();
      const session = await provider.startSession({
        agentId: "agent-alpha",
        purpose: "scrape pricing",
      });

      expect(session).toMatchObject({
        sessionId: expect.any(String),
        agentId: "agent-alpha",
        purpose: "scrape pricing",
        status: expect.stringMatching(/^(inactive|active|stopped)$/),
      });
      expect(session.createdAt).toBeInstanceOf(Date);
      // liveViewUrl is nullable by contract — accept null or a non-empty string.
      if (session.liveViewUrl !== null) {
        expect(typeof session.liveViewUrl).toBe("string");
        expect(session.liveViewUrl.length).toBeGreaterThan(0);
      }
    });

    it("startSession is idempotent on retry with the same idempotency key", async () => {
      const provider = await factory();
      const input = {
        agentId: "agent-idem",
        purpose: "login",
        idempotencyKey: "session-key-1",
      };
      const first = await provider.startSession(input);
      const second = await provider.startSession(input);
      expect(second.sessionId).toBe(first.sessionId);
    });

    it("attachTool returns a handle linked to the session and tool", async () => {
      const provider = await factory();
      const session = await provider.startSession({
        agentId: "agent-tools",
        purpose: "scrape",
      });
      const handle = await provider.attachTool(session.sessionId, "playwright");

      expect(handle).toMatchObject({
        sessionId: session.sessionId,
        tool: "playwright",
      });
      expect(handle.attachedAt).toBeInstanceOf(Date);
      expect(typeof handle.noop).toBe("boolean");
    });

    it("attachTool rejects for an unknown session", async () => {
      const provider = await factory();
      await expect(provider.attachTool("session-missing", "puppeteer")).rejects.toThrow(
        /session not found/i,
      );
    });

    it("getLiveViewUrl agrees with startSession's liveViewUrl", async () => {
      const provider = await factory();
      const session = await provider.startSession({
        agentId: "agent-liveview",
        purpose: "inspect",
        liveView: true,
      });
      const url = await provider.getLiveViewUrl(session.sessionId);
      expect(url).toBe(session.liveViewUrl);
    });

    it("getLiveViewUrl returns null for an unknown session", async () => {
      const provider = await factory();
      const url = await provider.getLiveViewUrl("session-missing");
      expect(url).toBeNull();
    });

    it("stopSession marks an existing session stopped (or removes it)", async () => {
      const provider = await factory();
      const session = await provider.startSession({
        agentId: "agent-stop",
        purpose: "quick",
      });
      await provider.stopSession(session.sessionId);
      // After stopping, the session should no longer be treated as live:
      // either the live-view URL is null, or the session itself is gone.
      const url = await provider.getLiveViewUrl(session.sessionId);
      expect(url).toBeNull();
    });

    it("stopSession on an unknown session rejects with a descriptive error", async () => {
      const provider = await factory();
      await expect(provider.stopSession("session-missing")).rejects.toThrow(
        /not found/i,
      );
    });

    it("getSessionArtifacts returns an array", async () => {
      const provider = await factory();
      const session = await provider.startSession({
        agentId: "agent-artifacts",
        purpose: "capture",
      });
      const artifacts = await provider.getSessionArtifacts(session.sessionId);
      expect(Array.isArray(artifacts)).toBe(true);
    });
  });
}
