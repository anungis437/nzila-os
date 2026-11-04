import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as any[],
  insertQueue: [] as any[],
  updateQueue: [] as any[],
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockMetricsUpdate: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

function makeSelectChain(result: any) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: any) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

function makeInsertChain(result: any) {
  const chain: Record<string, unknown> = {
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function makeUpdateChain(result: any) {
  const chain: Record<string, unknown> = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
  };
  chain.then = (resolve: (value: any) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

vi.mock("@/db/db", () => ({ db: { select: mocks.mockSelect, insert: mocks.mockInsert, update: mocks.mockUpdate } }));

vi.mock("@/db/schema", () => ({
  cbaIntelReviewDecisions: { targetType: "target_type", targetId: "target_id", createdAt: "created_at" },
  cbaIntelFindings: { id: "id", reviewStatus: "review_status", confidence: "confidence", createdAt: "created_at", clauseFamily: "clause_family" },
  cbaIntelAgreements: { id: "id", reviewStatus: "review_status", overallConfidence: "overall_confidence", createdAt: "created_at", jurisdiction: "jurisdiction" },
  cbaIntelWageAdjustments: { id: "id", reviewStatus: "review_status", confidence: "confidence", createdAt: "created_at" },
  cbaIntelClauses: { id: "id", reviewStatus: "review_status", confidence: "confidence", createdAt: "created_at", clauseFamily: "clause_family" },
}));

vi.mock("@/lib/observability/metrics", () => ({ updateReviewQueueDepthMetrics: mocks.mockMetricsUpdate }));

vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.mockLoggerInfo, error: mocks.mockLoggerError, warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual, eq: vi.fn(() => ({})), and: vi.fn(() => ({})), desc: vi.fn(() => ({})) };
});

describe("review-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;
    mocks.updateQueue.length = 0;
    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsert.mockImplementation(() => makeInsertChain(mocks.insertQueue.shift() ?? []));
    mocks.mockUpdate.mockImplementation(() => makeUpdateChain(mocks.updateQueue.shift() ?? []));
  });

  it("lists the findings that await review as queue items, and the pending agreements", async () => {
    mocks.selectQueue.push(
      [{ count: 1 }],
      [{ id: "f1", label: "Wage increase", clauseFamily: "wages", confidence: "0.750", citationText: "2.5% in 2026", isInferred: true, reviewStatus: "needs_followup", createdAt: new Date("2026-10-01T00:00:00Z") }],
      [{ count: 1 }],
      [{ id: "a1" }],
    );
    const { getReviewQueue, getPendingAgreementReviews } = await import("../review-service");
    await expect(
      getReviewQueue({ minConfidence: 0.5, maxConfidence: 0.9, clauseFamily: "wages" }, { limit: 200 }),
    ).resolves.toEqual({
      items: [{ id: "f1", targetType: "finding", title: "Wage increase", employer: null, jurisdiction: null, clauseFamily: "wages", confidence: 0.75, citationText: "2.5% in 2026", isInferred: true, reviewStatus: "needs_followup", createdAt: "2026-10-01T00:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: 100,
    });
    await expect(getPendingAgreementReviews({ limit: 200 })).resolves.toEqual({
      items: [{ id: "a1" }],
      total: 1,
      page: 1,
      limit: 100,
    });
  });

  const createdAt = new Date("2026-10-01T00:00:00Z");
  it.each([
    [
      "agreement",
      "cbaIntelAgreements",
      { id: "a1", title: "Unit agreement", employerNormalized: "Employer", jurisdiction: "ON", overallConfidence: "0.900", reviewStatus: "pending_review", createdAt },
      { title: "Unit agreement", employer: "Employer", jurisdiction: "ON", clauseFamily: null, confidence: 0.9, citationText: null, isInferred: false, reviewStatus: "pending_review" },
    ],
    [
      "wage_adjustment",
      "cbaIntelWageAdjustments",
      { id: "w1", adjustmentType: "general_increase", adjustmentPercent: "2.500", adjustmentFlat: null, year: 2026, classification: "Clerks", confidence: "0.600", citationText: "2.5% in 2026", isInferred: false, reviewStatus: "needs_followup", createdAt },
      { title: "general increase · 2.5% · 2026 · Clerks", employer: null, jurisdiction: null, clauseFamily: null, confidence: 0.6, citationText: "2.5% in 2026", isInferred: false, reviewStatus: "needs_followup" },
    ],
    [
      "clause",
      "cbaIntelClauses",
      { id: "c1", title: null, clauseNumber: "12.01", clauseFamily: "overtime", summary: "Overtime is paid at 1.5x.", confidence: "0.400", isInferred: true, reviewStatus: null, createdAt },
      { title: "§12.01", employer: null, jurisdiction: null, clauseFamily: "overtime", confidence: 0.4, citationText: "Overtime is paid at 1.5x.", isInferred: true, reviewStatus: "pending_review" },
    ],
  ])("lists the %s rows that await review from their own table, not the findings", async (targetType, table, row, expected) => {
    mocks.selectQueue.push([{ count: 1 }], [row]);
    const { getReviewQueue } = await import("../review-service");
    const schema = await import("@/db/schema");

    const queue = await getReviewQueue({ targetType: targetType as never });

    expect(queue).toEqual({ items: [{ id: row.id, targetType, createdAt: "2026-10-01T00:00:00.000Z", ...expected }], total: 1, page: 1, limit: 25 });
    // The count and the page are both read from the table of the kind asked for.
    for (const result of mocks.mockSelect.mock.results) {
      expect((result.value as { from: ReturnType<typeof vi.fn> }).from).toHaveBeenCalledWith((schema as unknown as Record<string, unknown>)[table]);
    }
  });

  it("submits review and writes audit decision", async () => {
    mocks.selectQueue.push([{ id: "f1", reviewStatus: "pending_review" }]);
    mocks.insertQueue.push([{ id: "d1", decision: "approved" }]);
    mocks.updateQueue.push([{ id: "f1" }]);
    const { submitReview } = await import("../review-service");
    const result = await submitReview({
      targetType: "finding",
      targetId: "f1",
      decision: "approved",
      reviewerId: "u1",
      reviewerRole: "steward",
      reason: "ok",
    });
    expect(result).toMatchObject({ id: "d1", decision: "approved" });
    expect(mocks.mockLoggerInfo).toHaveBeenCalled();
  });

  it("does not overwrite a status that changed after it was read", async () => {
    mocks.selectQueue.push([{ id: "f1", reviewStatus: "pending_review" }]);
    mocks.insertQueue.push([{ id: "d1", decision: "approved" }]);
    mocks.updateQueue.push([]);
    const { submitReview } = await import("../review-service");
    await expect(
      submitReview({ targetType: "finding", targetId: "f1", decision: "approved", reviewerId: "u1", reviewerRole: "steward" }),
    ).rejects.toThrow("Review target changed concurrently");
  });

  it("defaults previousStatus to pending_review when missing", async () => {
    mocks.selectQueue.push([{ id: "f2", reviewStatus: null }]);
    mocks.insertQueue.push([{ id: "d3", decision: "approved" }]);
    mocks.updateQueue.push([{ id: "f1" }]);
    const { submitReview } = await import("../review-service");
    await expect(
      submitReview({ targetType: "finding", targetId: "f2", decision: "approved", reviewerId: "u1", reviewerRole: "steward" }),
    ).resolves.toMatchObject({ id: "d3" });
  });

  it("flags followup using system defaults", async () => {
    mocks.selectQueue.push([{ id: "c1", reviewStatus: "pending_review" }]);
    mocks.insertQueue.push([{ id: "d2", decision: "needs_followup" }]);
    mocks.updateQueue.push([{ id: "f1" }]);
    const { flagForFollowupReview } = await import("../review-service");
    const result = await flagForFollowupReview({ targetType: "clause", targetId: "c1", reason: "low confidence" });
    expect(result.decision).toBe("needs_followup");
  });

  it("throws on unknown target type and missing target", async () => {
    const { submitReview } = await import("../review-service");
    await expect(
      submitReview({ targetType: "unknown" as never, targetId: "x", decision: "approved", reviewerId: "u", reviewerRole: "r" }),
    ).rejects.toThrow("Unknown target type");

    mocks.selectQueue.push([]);
    await expect(
      submitReview({ targetType: "finding", targetId: "missing", decision: "approved", reviewerId: "u", reviewerRole: "r" }),
    ).rejects.toThrow("Target not found: finding/missing");
  });

  it("returns review history", async () => {
    mocks.selectQueue.push([{ id: "d1" }, { id: "d2" }]);
    const { getReviewHistory } = await import("../review-service");
    await expect(getReviewHistory("finding", "f1")).resolves.toEqual([{ id: "d1" }, { id: "d2" }]);
  });

  it("gets review queue counts and updates metrics", async () => {
    mocks.selectQueue.push([{ count: 2 }], [{ count: 3 }], [{ count: 4 }], [{ count: 5 }]);
    const { getReviewQueueCounts } = await import("../review-service");
    const counts = await getReviewQueueCounts();
    expect(counts).toEqual({ findings: 2, agreements: 3, wageAdjustments: 4, clauses: 5, total: 14 });
    expect(mocks.mockMetricsUpdate).toHaveBeenCalledWith(counts);
  });

  it("wraps errors for queue fetch", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    const { getReviewQueue } = await import("../review-service");
    await expect(getReviewQueue()).rejects.toThrow("Failed to fetch review queue");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });

  it("wraps pending/review-history/count fetch errors", async () => {
    const { getPendingAgreementReviews, getReviewHistory, getReviewQueueCounts } = await import("../review-service");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getPendingAgreementReviews()).rejects.toThrow("Failed to fetch agreement review queue");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getReviewHistory("finding", "f1")).rejects.toThrow("Failed to fetch review history");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getReviewQueueCounts()).rejects.toThrow("Failed to fetch review queue counts");
  });

  it("converts non-Error throw in submitReview catch", async () => {
    const { submitReview } = await import("../review-service");
    mocks.mockSelect.mockImplementationOnce(() => {
      throw "boom";
    });
    await expect(
      submitReview({ targetType: "finding", targetId: "f1", decision: "approved", reviewerId: "u1", reviewerRole: "steward" }),
    ).rejects.toThrow("Failed to submit review");
  });
});
