import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../source-registry-service", () => ({
  listSources: vi.fn(),
}));

vi.mock("../ingestion-service", () => ({
  createIngestionJob: vi.fn(),
}));

vi.mock("../document-service", () => ({
  upsertDocument: vi.fn(),
}));

vi.mock("../extraction-service", () => ({
  createExtractionRun: vi.fn(),
}));

vi.mock("../review-service", () => ({
  flagForFollowupReview: vi.fn(),
}));

vi.mock("../benchmark-service", () => ({
  findComparableAgreements: vi.fn(),
  saveBenchmarkSnapshot: vi.fn(),
}));

vi.mock("../freshness-service", () => ({
  computeFreshnessStatus: vi.fn(),
}));

vi.mock("../health-service", () => ({
  getCbaIntelOperationalHealth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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
  }, 10000);
});
