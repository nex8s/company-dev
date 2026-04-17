import { randomUUID } from "node:crypto";
import type {
  BrowserProvider,
  BrowserSession,
  BrowserTool,
  SessionArtifact,
  StartSessionInput,
  ToolHandle,
} from "./provider.js";

export type MockBrowserLogEvent = {
  intent: "startSession" | "attachTool" | "stopSession";
  at: Date;
  payload: unknown;
};

export type MockBrowserProviderOptions = {
  /** Receives a structured log event for every write. Defaults to a no-op. */
  log?: (event: MockBrowserLogEvent) => void;
};

/**
 * Mock BrowserProvider — matches the "Browser inactive" empty state in the
 * prototype. `startSession` always returns `status: 'inactive'` with
 * `liveViewUrl: null`; `attachTool` returns a no-op handle.
 */
export class MockBrowserProvider implements BrowserProvider {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly idempotencySessions = new Map<string, string>();
  private readonly log: (event: MockBrowserLogEvent) => void;

  constructor(opts: MockBrowserProviderOptions = {}) {
    this.log = opts.log ?? (() => {});
  }

  async startSession(input: StartSessionInput): Promise<BrowserSession> {
    if (input.idempotencyKey) {
      const priorId = this.idempotencySessions.get(input.idempotencyKey);
      if (priorId) {
        const existing = this.sessions.get(priorId);
        if (existing) return existing;
      }
    }

    const session: BrowserSession = {
      sessionId: `bsession-${randomUUID()}`,
      agentId: input.agentId,
      purpose: input.purpose,
      status: "inactive",
      liveViewUrl: null,
      createdAt: new Date(),
    };
    this.sessions.set(session.sessionId, session);
    if (input.idempotencyKey) {
      this.idempotencySessions.set(input.idempotencyKey, session.sessionId);
    }
    this.log({ intent: "startSession", at: new Date(), payload: input });
    return session;
  }

  async attachTool(sessionId: string, tool: BrowserTool): Promise<ToolHandle> {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`session not found: ${sessionId}`);
    }
    this.log({ intent: "attachTool", at: new Date(), payload: { sessionId, tool } });
    return {
      sessionId,
      tool,
      attachedAt: new Date(),
      noop: true,
    };
  }

  async getLiveViewUrl(sessionId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    return session?.liveViewUrl ?? null;
  }

  async stopSession(sessionId: string): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`session not found: ${sessionId}`);
    }
    this.sessions.delete(sessionId);
    this.log({ intent: "stopSession", at: new Date(), payload: { sessionId } });
  }

  async getSessionArtifacts(_sessionId: string): Promise<SessionArtifact[]> {
    return [];
  }
}
