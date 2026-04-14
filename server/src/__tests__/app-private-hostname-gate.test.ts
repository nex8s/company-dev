import { describe, expect, it } from "vitest";
import { shouldEnablePrivateHostnameGuard } from "../app.ts";

describe("shouldEnablePrivateHostnameGuard", () => {
  it("enables the hostname guard for local_trusted mode", () => {
    expect(shouldEnablePrivateHostnameGuard({
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
    })).toBe(true);
  });

  it("enables the hostname guard for authenticated private deployments", () => {
    expect(shouldEnablePrivateHostnameGuard({
      deploymentMode: "authenticated",
      deploymentExposure: "private",
    })).toBe(true);
  });

  it("does not enable the hostname guard for authenticated public deployments", () => {
    expect(shouldEnablePrivateHostnameGuard({
      deploymentMode: "authenticated",
      deploymentExposure: "public",
    })).toBe(false);
  });
});
