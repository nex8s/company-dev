import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db",
      "packages/adapters/codex-local",
      "packages/adapters/opencode-local",
      "packages/plugin-company",
      "packages/plugin-apps-builder",
      "packages/plugin-dashboards",
      "packages/plugin-payments",
      "packages/plugin-store",
      "packages/plugin-identity",
      "packages/plugin-connect-tools",
      "server",
      "ui",
      "cli",
    ],
  },
});
