import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * C-13 — Playwright config for the Company.dev happy-path E2E harness.
 *
 * Mirrors `tests/e2e/playwright.config.ts` (the onboarding harness), but
 * runs on its own port + temp `PAPERCLIP_HOME` so the two harnesses can
 * run concurrently in CI.
 *
 * Happy-path spec: see `./happy-path.spec.ts` — landing → signup →
 * create company → CEO seeded → hire marketer → approve draft → launch
 * app → subscribe Starter → verify Server panel.
 */

const PORT = Number(process.env.COMPANY_DEV_E2E_PORT ?? 3299);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PAPERCLIP_HOME = fs.mkdtempSync(
  path.join(os.tmpdir(), "company-dev-e2e-home-"),
);

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm paperclipai onboard --yes --run",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PORT: String(PORT),
      PAPERCLIP_HOME,
      PAPERCLIP_INSTANCE_ID: "company-dev-e2e",
      PAPERCLIP_BIND: "loopback",
      PAPERCLIP_DEPLOYMENT_MODE: "local_trusted",
      PAPERCLIP_DEPLOYMENT_EXPOSURE: "private",
    },
  },
  outputDir: "./test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "./playwright-report" }],
  ],
});
