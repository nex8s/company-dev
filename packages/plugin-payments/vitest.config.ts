import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Embedded-postgres spin-up adds ~3s of setup per test; the 5s default
    // is too tight for suites that build a fresh DB inside each `it`.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
