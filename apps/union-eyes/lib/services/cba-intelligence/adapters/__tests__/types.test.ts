import { describe, expect, it } from "vitest";

describe("adapter types module", () => {
  it("exports a runtime version marker", async () => {
    const mod = await import("../types");
    expect(mod.ADAPTER_TYPES_VERSION).toBe("1.0.0");
  });
});
