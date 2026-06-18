import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listIngestionJobs: vi.fn(),
  listExtractionRuns: vi.fn(),
  getReviewQueueCounts: vi.fn(),
  getFreshnessOverview: vi.fn(),
}));

vi.mock("@/lib/services/cba-intelligence/ingestion-service", () => ({
  listIngestionJobs: mocks.listIngestionJobs,
}));

vi.mock("@/lib/services/cba-intelligence/extraction-service", () => ({
  listExtractionRuns: mocks.listExtractionRuns,
}));

vi.mock("@/lib/services/cba-intelligence/review-service", () => ({
  getReviewQueueCounts: mocks.getReviewQueueCounts,
}));

vi.mock("@/lib/services/cba-intelligence/freshness-service", () => ({
  getFreshnessOverview: mocks.getFreshnessOverview,
}));

describe("CBA intelligence health service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy when all checks are strong", async () => {
    mocks.listIngestionJobs.mockResolvedValue({
      items: [{ status: "completed" }, { status: "completed_with_errors" }],
    });
    mocks.listExtractionRuns.mockResolvedValue({
      items: [{ status: "completed" }, { status: "completed_with_errors" }],
    });
    mocks.getReviewQueueCounts.mockResolvedValue({
      findings: 10,
      agreements: 4,
      wageAdjustments: 2,
      clauses: 8,
      total: 24,
    });
    mocks.getFreshnessOverview.mockResolvedValue({
      summary: { fresh: 6, aging: 1, stale: 0, expired: 0, unknown: 0, total: 7 },
      sources: [],
    });

    const { getCbaIntelOperationalHealth } = await import("../health-service");
    const result = await getCbaIntelOperationalHealth();

    expect(result.level).toBe("healthy");
    expect(result.checks.length).toBe(4);
    expect(result.throughput.ingestionSuccessRate).toBe(1);
  });

  it("returns critical when stale/expired and success rates degrade", async () => {
    mocks.listIngestionJobs.mockResolvedValue({
      items: [{ status: "failed" }, { status: "completed_with_errors" }],
    });
    mocks.listExtractionRuns.mockResolvedValue({
      items: [{ status: "failed" }, { status: "failed" }, { status: "completed_with_errors" }],
    });
    mocks.getReviewQueueCounts.mockResolvedValue({
      findings: 900,
      agreements: 120,
      wageAdjustments: 40,
      clauses: 60,
      total: 1120,
    });
    mocks.getFreshnessOverview.mockResolvedValue({
      summary: { fresh: 1, aging: 1, stale: 2, expired: 1, unknown: 0, total: 5 },
      sources: [],
    });

    const { getCbaIntelOperationalHealth } = await import("../health-service");
    const result = await getCbaIntelOperationalHealth();

    expect(result.level).toBe("critical");
    expect(result.quality.expiredSources).toBe(1);
    expect(result.quality.reviewBacklog).toBe(1120);
  });

  it("returns warning when throughput is unavailable and backlog/freshness are elevated but non-critical", async () => {
    mocks.listIngestionJobs.mockResolvedValue({ items: [] });
    mocks.listExtractionRuns.mockResolvedValue({ items: [] });
    mocks.getReviewQueueCounts.mockResolvedValue({
      findings: 150,
      agreements: 120,
      wageAdjustments: 20,
      clauses: 15,
      total: 305,
    });
    mocks.getFreshnessOverview.mockResolvedValue({
      summary: { fresh: 2, aging: 1, stale: 1, expired: 0, unknown: 0, total: 4 },
      sources: [],
    });

    const { getCbaIntelOperationalHealth } = await import("../health-service");
    const result = await getCbaIntelOperationalHealth();

    expect(result.level).toBe("warning");
    expect(result.throughput.ingestionSuccessRate).toBeNull();
    expect(result.throughput.extractionSuccessRate).toBeNull();
    expect(result.checks.find((c) => c.name === "ingestion_success_rate")?.detail).toContain("n/a");
    expect(result.checks.find((c) => c.name === "review_backlog")?.level).toBe("warning");
    expect(result.checks.find((c) => c.name === "source_freshness")?.level).toBe("warning");
  });

  it("returns warning for degraded but non-critical success-rate buckets", async () => {
    mocks.listIngestionJobs.mockResolvedValue({
      items: [
        { status: "completed" },
        { status: "completed" },
        { status: "completed_with_errors" },
        { status: "completed" },
        { status: "failed" },
      ],
    });
    mocks.listExtractionRuns.mockResolvedValue({
      items: [
        { status: "completed" },
        { status: "completed" },
        { status: "completed" },
        { status: "completed" },
        { status: "completed" },
        { status: "completed_with_errors" },
        { status: "failed" },
      ],
    });
    mocks.getReviewQueueCounts.mockResolvedValue({ findings: 1, agreements: 1, wageAdjustments: 1, clauses: 1, total: 4 });
    mocks.getFreshnessOverview.mockResolvedValue({
      summary: { fresh: 4, aging: 0, stale: 0, expired: 0, unknown: 0, total: 4 },
      sources: [],
    });

    const { getCbaIntelOperationalHealth } = await import("../health-service");
    const result = await getCbaIntelOperationalHealth();

    expect(result.checks.find((c) => c.name === "ingestion_success_rate")?.level).toBe("warning");
    expect(result.checks.find((c) => c.name === "extraction_success_rate")?.level).toBe("warning");
  });
});
