import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The B-09..B-12 contract tests are pure-in-memory and finish in ms,
    // but the B-15 domain-router suite spins up embedded-postgres per test
    // (3–40s on slower hosts). 60s matches plugin-store / plugin-connect-tools.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
