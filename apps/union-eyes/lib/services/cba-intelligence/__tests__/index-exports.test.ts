import { describe, expect, it } from "vitest";

describe("cba-intelligence index exports", () => {
  it("re-exports core service entry points", async () => {
    const mod = await import("../index");
    expect(typeof mod.listSources).toBe("function");
    expect(typeof mod.createIngestionJob).toBe("function");
    expect(typeof mod.upsertDocument).toBe("function");
    expect(typeof mod.createExtractionRun).toBe("function");
    expect(typeof mod.flagForFollowupReview).toBe("function");
    expect(typeof mod.findComparableAgreements).toBe("function");
    expect(typeof mod.saveBenchmarkSnapshot).toBe("function");
    expect(typeof mod.computeFreshnessStatus).toBe("function");
    expect(typeof mod.getCbaIntelOperationalHealth).toBe("function");
    expect(mod.CBA_INTELLIGENCE_MODULE_VERSION).toBe("1.0.0");
  });
});
