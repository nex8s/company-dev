import { describe, expect, it } from "vitest";
import { registerPlugin } from "./index.js";

describe("plugin-company scaffold (A-01)", () => {
  it("exports a registerPlugin function", () => {
    expect(typeof registerPlugin).toBe("function");
  });

  it("registerPlugin returns the plugin name", () => {
    const reg = registerPlugin();
    expect(reg.name).toBe("plugin-company");
    expect(typeof reg.version).toBe("string");
  });
});
