import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@paperclipai/adapter-claude-local/server";

async function writeFakeClaudeCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const argv = process.argv.slice(2);
const addDirIndex = argv.indexOf("--add-dir");
const addDir = addDirIndex >= 0 ? argv[addDirIndex + 1] : null;
const instructionsIndex = argv.indexOf("--append-system-prompt-file");
const instructionsFilePath = instructionsIndex >= 0 ? argv[instructionsIndex + 1] : null;
const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const payload = {
  argv,
  prompt: fs.readFileSync(0, "utf8"),
  addDir,
  instructionsFilePath,
  instructionsContents: instructionsFilePath ? fs.readFileSync(instructionsFilePath, "utf8") : null,
  skillEntries: addDir ? fs.readdirSync(path.join(addDir, ".claude", "skills")).sort() : [],
  claudeConfigDir: process.env.CLAUDE_CONFIG_DIR || null,
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({ type: "system", subtype: "init", session_id: "claude-session-1", model: "claude-sonnet" }));
console.log(JSON.stringify({ type: "assistant", session_id: "claude-session-1", message: { content: [{ type: "text", text: "hello" }] } }));
console.log(JSON.stringify({ type: "result", session_id: "claude-session-1", result: "hello", usage: { input_tokens: 1, cache_read_input_tokens: 0, output_tokens: 1 } }));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
  prompt: string;
  addDir: string | null;
  instructionsFilePath: string | null;
  instructionsContents: string | null;
  skillEntries: string[];
  claudeConfigDir: string | null;
};

describe("claude execute", () => {
  it("logs HOME, CLAUDE_CONFIG_DIR, and the resolved executable path in invocation metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-execute-meta-"));
    const workspace = path.join(root, "workspace");
    const binDir = path.join(root, "bin");
    const commandPath = path.join(binDir, "claude");
    const capturePath = path.join(root, "capture.json");
    const claudeConfigDir = path.join(root, "claude-config");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(claudeConfigDir, { recursive: true });
    await writeFakeClaudeCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPath = process.env.PATH;
    const previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = root;
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
    process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;

    let loggedCommand: string | null = null;
    let loggedEnv: Record<string, string> = {};
    try {
      const result = await execute({
        runId: "run-meta",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: "claude",
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
        onMeta: async (meta) => {
          loggedCommand = meta.command;
          loggedEnv = meta.env ?? {};
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();
      expect(loggedCommand).toBe(commandPath);
      expect(loggedEnv.HOME).toBe(root);
      expect(loggedEnv.CLAUDE_CONFIG_DIR).toBe(claudeConfigDir);
      expect(loggedEnv.PAPERCLIP_RESOLVED_COMMAND).toBe(commandPath);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("reuses a stable Paperclip-managed Claude prompt bundle across equivalent runs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-execute-bundle-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "claude");
    const capturePath1 = path.join(root, "capture-1.json");
    const capturePath2 = path.join(root, "capture-2.json");
    const instructionsPath = path.join(root, "AGENTS.md");
    const paperclipHome = path.join(root, "paperclip-home");
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(instructionsPath, "You are managed instructions.\n", "utf8");
    await writeFakeClaudeCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;

    try {
      const first = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          instructionsFilePath: instructionsPath,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath1,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(first.exitCode).toBe(0);
      expect(first.errorMessage).toBeNull();
      expect(first.sessionParams).toMatchObject({
        sessionId: "claude-session-1",
        cwd: workspace,
      });
      expect(typeof first.sessionParams?.promptBundleKey).toBe("string");

      const second = await execute({
        runId: "run-2",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: first.sessionParams ?? null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          instructionsFilePath: instructionsPath,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath2,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {
          issueId: "issue-1",
          taskId: "issue-1",
          wakeReason: "issue_commented",
          wakeCommentId: "comment-2",
          paperclipWake: {
            reason: "issue_commented",
            issue: {
              id: "issue-1",
              identifier: "PAP-874",
              title: "chat-speed issues",
              status: "in_progress",
              priority: "medium",
            },
            commentIds: ["comment-2"],
            latestCommentId: "comment-2",
            comments: [
              {
                id: "comment-2",
                issueId: "issue-1",
                body: "Second comment",
                bodyTruncated: false,
                createdAt: "2026-03-28T14:35:10.000Z",
                author: { type: "user", id: "user-1" },
              },
            ],
            commentWindow: {
              requestedCount: 1,
              includedCount: 1,
              missingCount: 0,
            },
            truncated: false,
            fallbackFetchNeeded: false,
          },
        },
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(second.exitCode).toBe(0);
      expect(second.errorMessage).toBeNull();

      const capture1 = JSON.parse(await fs.readFile(capturePath1, "utf8")) as CapturePayload;
      const capture2 = JSON.parse(await fs.readFile(capturePath2, "utf8")) as CapturePayload;
      const expectedRoot = path.join(
        paperclipHome,
        "instances",
        "default",
        "companies",
        "company-1",
        "claude-prompt-cache",
      );

      expect(capture1.addDir).toBeTruthy();
      expect(capture1.addDir).toBe(capture2.addDir);
      expect(capture1.instructionsFilePath).toBeTruthy();
      expect(capture1.instructionsFilePath).toBe(capture2.instructionsFilePath);
      expect(capture1.addDir?.startsWith(expectedRoot)).toBe(true);
      expect(capture1.instructionsFilePath?.startsWith(expectedRoot)).toBe(true);
      expect(capture1.instructionsContents).toContain("You are managed instructions.");
      expect(capture1.instructionsContents).toContain(`The above agent instructions were loaded from ${instructionsPath}.`);
      expect(capture1.skillEntries).toContain("paperclip");
      expect(capture2.argv).toContain("--resume");
      expect(capture2.argv).toContain("claude-session-1");
      expect(capture2.prompt).toContain("## Paperclip Resume Delta");
      expect(capture2.prompt).not.toContain("Follow the paperclip heartbeat.");
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("starts a fresh Claude session when the stable prompt bundle changes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-execute-reset-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "claude");
    const capturePath1 = path.join(root, "capture-before.json");
    const capturePath2 = path.join(root, "capture-after.json");
    const instructionsPath = path.join(root, "AGENTS.md");
    const paperclipHome = path.join(root, "paperclip-home");
    const logs: string[] = [];
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(instructionsPath, "Version one instructions.\n", "utf8");
    await writeFakeClaudeCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;

    try {
      const first = await execute({
        runId: "run-before",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          instructionsFilePath: instructionsPath,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath1,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      await fs.writeFile(instructionsPath, "Version two instructions.\n", "utf8");

      const second = await execute({
        runId: "run-after",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: first.sessionParams ?? null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          instructionsFilePath: instructionsPath,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath2,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async (_stream, chunk) => {
          logs.push(chunk);
        },
      });

      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      expect(second.errorMessage).toBeNull();

      const before = JSON.parse(await fs.readFile(capturePath1, "utf8")) as CapturePayload;
      const after = JSON.parse(await fs.readFile(capturePath2, "utf8")) as CapturePayload;

      expect(before.instructionsFilePath).not.toBe(after.instructionsFilePath);
      expect(after.argv).not.toContain("--resume");
      expect(after.prompt).toContain("Follow the paperclip heartbeat.");
      expect(logs.join("")).toContain("will not be resumed with");
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
