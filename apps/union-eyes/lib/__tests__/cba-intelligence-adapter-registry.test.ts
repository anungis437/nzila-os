import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdapter, getRegisteredAdapterKeys } from "@/lib/services/cba-intelligence/adapters";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("adapter registry", () => {
  it("returns html_bulletin adapter", () => {
    const adapter = getAdapter("html_bulletin");
    expect(adapter).not.toBeNull();
    expect(adapter?.key).toBe("html_bulletin");
  });

  it("returns null for unknown adapter key", () => {
    expect(getAdapter("unknown_adapter")).toBeNull();
  });

  it("lists registered adapter keys", () => {
    const keys = getRegisteredAdapterKeys();
    expect(keys).toContain("html_bulletin");
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });
});
