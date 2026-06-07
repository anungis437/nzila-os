import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as unknown[],
  insertQueue: [] as unknown[],
  updateQueue: [] as unknown[],
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockMetricsUpdate: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

function makeInsertChain(result: unknown) {
  const chain: Record<string, unknown> = {
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function makeUpdateChain(result: unknown) {
  const chain: Record<string, unknown> = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
  };
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

vi.mock("@/db/db", () => ({ db: { select: mocks.mockSelect, insert: mocks.mockInsert, update: mocks.mockUpdate } }));

vi.mock("@/db/schema", () => ({
  cbaIntelReviewDecisions: { targetType: "target_type", targetId: "target_id", createdAt: "created_at" },
  cbaIntelFindings: { id: "id", reviewStatus: "review_status", confidence: "confidence", createdAt: "created_at", clauseFamily: "clause_family" },
  cbaIntelAgreements: { id: "id", reviewStatus: "review_status", overallConfidence: "overall_confidence", createdAt: "created_at" },
  cbaIntelWageAdjustments: { id: "id", reviewStatus: "review_status" },
  cbaIntelClauses: { id: "id", reviewStatus: "review_status" },
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

  it("gets review queue and pending agreement queue", async () => {
    mocks.selectQueue.push([{ count: 1 }], [{ id: "f1" }], [{ count: 1 }], [{ id: "a1" }]);
    const { getReviewQueue, getPendingAgreementReviews } = await import("../review-service");
    await expect(
      getReviewQueue({ minConfidence: 0.5, maxConfidence: 0.9, clauseFamily: "wages" }, { limit: 200 }),
    ).resolves.toEqual({ items: [{ id: "f1" }], total: 1, page: 1, limit: 100 });
    await expect(getPendingAgreementReviews({ limit: 200 })).resolves.toEqual({
      items: [{ id: "a1" }],
      total: 1,
      page: 1,
      limit: 100,
    });
  });

  it("submits review and writes audit decision", async () => {
    mocks.selectQueue.push([{ id: "f1", reviewStatus: "pending_review" }]);
    mocks.insertQueue.push([{ id: "d1", decision: "approved" }]);
    mocks.updateQueue.push([]);
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

  it("defaults previousStatus to pending_review when missing", async () => {
    mocks.selectQueue.push([{ id: "f2", reviewStatus: null }]);
    mocks.insertQueue.push([{ id: "d3", decision: "approved" }]);
    mocks.updateQueue.push([]);
    const { submitReview } = await import("../review-service");
    await expect(
      submitReview({ targetType: "finding", targetId: "f2", decision: "approved", reviewerId: "u1", reviewerRole: "steward" }),
    ).resolves.toMatchObject({ id: "d3" });
  });

  it("flags followup using system defaults", async () => {
    mocks.selectQueue.push([{ id: "c1", reviewStatus: "pending_review" }]);
    mocks.insertQueue.push([{ id: "d2", decision: "needs_followup" }]);
    mocks.updateQueue.push([]);
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
