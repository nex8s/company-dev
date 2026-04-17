export type BrowserSessionStatus = "inactive" | "active" | "stopped";

export type BrowserTool = "playwright" | "puppeteer" | "mcp";

export type BrowserSession = {
  sessionId: string;
  agentId: string;
  purpose: string;
  status: BrowserSessionStatus;
  liveViewUrl: string | null;
  createdAt: Date;
};

export type StartSessionInput = {
  agentId: string;
  purpose: string;
  liveView?: boolean;
  idempotencyKey?: string;
};

export type ToolHandle = {
  sessionId: string;
  tool: BrowserTool;
  attachedAt: Date;
  /** Real providers (Browserbase/Steel) return a live driver handle; Mock returns true. */
  noop: boolean;
};

export type SessionArtifactKind = "screenshot" | "har" | "video" | "log";

export type SessionArtifact = {
  artifactId: string;
  sessionId: string;
  kind: SessionArtifactKind;
  url: string;
  createdAt: Date;
};

export interface BrowserProvider {
  startSession(input: StartSessionInput): Promise<BrowserSession>;
  attachTool(sessionId: string, tool: BrowserTool): Promise<ToolHandle>;
  getLiveViewUrl(sessionId: string): Promise<string | null>;
  stopSession(sessionId: string): Promise<void>;
  getSessionArtifacts(sessionId: string): Promise<SessionArtifact[]>;
}
