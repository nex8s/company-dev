import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Embedded-postgres spin-up adds ~3s of setup per test; the 5s default
    // is too tight for suites that build a fresh DB inside each `it`.
    // 60s matches plugin-identity / plugin-connect-tools / plugin-store
    // on slower CI hosts.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
