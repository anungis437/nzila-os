import { describe, it, expect } from "vitest";
import {
  computeFreshnessStatus,
  normalizeFreshnessThresholds,
} from "@/lib/services/cba-intelligence/freshness-service";

describe("freshness-service – computeFreshnessStatus", () => {
  const thresholds = { agingDays: 14, staleDays: 30, expiredDays: 90 };

  it("returns 'unknown' when daysSinceLastSuccess is null", () => {
    expect(computeFreshnessStatus(null, thresholds)).toBe("unknown");
  });

  it("returns 'fresh' for 0 days", () => {
    expect(computeFreshnessStatus(0, thresholds)).toBe("fresh");
  });

  it("returns 'fresh' for 13 days", () => {
    expect(computeFreshnessStatus(13, thresholds)).toBe("fresh");
  });

  it("returns 'aging' at exactly agingDays threshold", () => {
    expect(computeFreshnessStatus(14, thresholds)).toBe("aging");
  });

  it("returns 'aging' for 29 days", () => {
    expect(computeFreshnessStatus(29, thresholds)).toBe("aging");
  });

  it("returns 'stale' at exactly staleDays threshold", () => {
    expect(computeFreshnessStatus(30, thresholds)).toBe("stale");
  });

  it("returns 'stale' for 89 days", () => {
    expect(computeFreshnessStatus(89, thresholds)).toBe("stale");
  });

  it("returns 'expired' at exactly expiredDays threshold", () => {
    expect(computeFreshnessStatus(90, thresholds)).toBe("expired");
  });

  it("returns 'expired' for 365 days", () => {
    expect(computeFreshnessStatus(365, thresholds)).toBe("expired");
  });

  it("uses default thresholds when not provided", () => {
    expect(computeFreshnessStatus(10)).toBe("fresh");
    expect(computeFreshnessStatus(20)).toBe("aging");
    expect(computeFreshnessStatus(50)).toBe("stale");
    expect(computeFreshnessStatus(100)).toBe("expired");
  });

  it("handles custom thresholds", () => {
    const custom = { agingDays: 7, staleDays: 14, expiredDays: 30 };
    expect(computeFreshnessStatus(6, custom)).toBe("fresh");
    expect(computeFreshnessStatus(7, custom)).toBe("aging");
    expect(computeFreshnessStatus(14, custom)).toBe("stale");
    expect(computeFreshnessStatus(30, custom)).toBe("expired");
  });

  it("normalizes invalid threshold ordering before status evaluation", () => {
    const invalid = { agingDays: 30, staleDays: 20, expiredDays: 10 };

    // Normalized ordering becomes 30, 31, 32.
    expect(computeFreshnessStatus(30, invalid)).toBe("aging");
    expect(computeFreshnessStatus(31, invalid)).toBe("stale");
    expect(computeFreshnessStatus(32, invalid)).toBe("expired");
  });
});

describe("freshness-service – normalizeFreshnessThresholds", () => {
  it("uses positive defaults and enforces strict ordering", () => {
    expect(
      normalizeFreshnessThresholds({ agingDays: -1, staleDays: 0, expiredDays: 0 }),
    ).toEqual({ agingDays: 14, staleDays: 30, expiredDays: 90 });

    expect(
      normalizeFreshnessThresholds({ agingDays: 30, staleDays: 30, expiredDays: 31 }),
    ).toEqual({ agingDays: 30, staleDays: 31, expiredDays: 32 });
  });
});
