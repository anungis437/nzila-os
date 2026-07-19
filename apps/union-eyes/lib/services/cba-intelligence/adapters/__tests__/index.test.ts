import { describe, expect, it } from "vitest";

describe("adapters index registry", () => {
  it("returns registered adapter keys and adapters", async () => {
    const mod = await import("../index");

    const keys = mod.getRegisteredAdapterKeys();
    expect(keys).toEqual(
      expect.arrayContaining([
        "html_bulletin",
        "esdc_federal",
        "canlii_legal",
        "statscan_csv",
        "provincial_board",
        "union_bargaining",
        "fpslreb",
      ]),
    );

    expect(mod.getAdapter("html_bulletin")?.key).toBe("html_bulletin");
    expect(mod.getAdapter("missing")).toBeNull();
  });
});
