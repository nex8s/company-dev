import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Embedded-postgres spin-up is highly variable on CI hosts (3–40s);
    // matches plugin-store's 60s ceiling per `it`.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
