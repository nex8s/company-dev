import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Embedded-postgres spin-up variance — matches plugin-identity /
    // plugin-payments / plugin-connect-tools (per-test fresh DB).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
