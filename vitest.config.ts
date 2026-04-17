import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db",
      "packages/adapters/codex-local",
      "packages/adapters/opencode-local",
      "packages/plugin-company",
      "packages/plugin-apps-builder",
      "packages/plugin-store",
      "server",
      "ui",
      "cli",
    ],
  },
});
