import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as any[],
  insertQueue: [] as any[],
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

function makeSelectChain(result: any) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "where", "orderBy", "limit", "offset"];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: any) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

vi.mock("@/db/db", () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
  },
}));

vi.mock("@/db/schema", () => ({
  cbaIntelAgreements: {
    id: "id",
    reviewStatus: "review_status",
    jurisdiction: "jurisdiction",
    sector: "sector",
    unionNormalized: "union_normalized",
    employerNormalized: "employer_normalized",
    createdAt: "created_at",
    termMonths: "term_months",
  },
  cbaIntelWageAdjustments: {
    agreementId: "agreement_id",
  },
  cbaIntelClauses: {
    agreementId: "agreement_id",
    clauseFamily: "clause_family",
  },
  cbaIntelBenchmarkSnapshots: {
    targetAgreementId: "target_agreement_id",
    createdAt: "created_at",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.mockLoggerInfo,
    warn: mocks.mockLoggerWarn,
    error: mocks.mockLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    ne: vi.fn(() => ({})),
    ilike: vi.fn(() => ({})),
    desc: vi.fn(() => ({})),
  };
});

describe("benchmark-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;

    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsertReturning.mockImplementation(() => Promise.resolve(mocks.insertQueue.shift() ?? []));
    mocks.mockInsertValues.mockImplementation(() => ({ returning: mocks.mockInsertReturning }));
    mocks.mockInsert.mockImplementation(() => ({ values: mocks.mockInsertValues }));
  });

  it("returns insufficientData when comparables are below threshold", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "target-1",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 36,
        },
      ],
      [
        {
          id: "cmp-1",
          employerNormalized: "Treasury Board",
          unionNormalized: "PSAC",
          jurisdiction: "federal",
          sector: "other",
          termMonths: 30,
        },
        {
          id: "cmp-2",
          employerNormalized: "Private Co",
          unionNormalized: "Unifor",
          jurisdiction: "bc",
          sector: "private",
          termMonths: 24,
        },
      ],
      [
        { agreementId: "cmp-1", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "2.5" },
      ],
      [
        { agreementId: "cmp-1", clauseFamily: "wages" },
        { agreementId: "cmp-2", clauseFamily: null },
      ],
    );

    const { findComparableAgreements } = await import("../benchmark-service");
    const result = await findComparableAgreements("target-1", { minComparables: 2 });

    expect(result.insufficientData).toBe(true);
    expect(result.requiredComparables).toBe(2);
    expect(result.comparableCount).toBe(1);
    expect(result.targetTermMonths).toBe(36);
    expect(mocks.mockLoggerWarn).toHaveBeenCalled();
  });

  it("computes benchmark aggregates when sample size is sufficient", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "target-1",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 36,
        },
      ],
      [
        {
          id: "cmp-1",
          employerNormalized: "Employer A",
          unionNormalized: "Union A",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 24,
        },
        {
          id: "cmp-2",
          employerNormalized: null,
          unionNormalized: null,
          jurisdiction: "federal",
          sector: "other",
          termMonths: 36,
        },
      ],
      [
        { agreementId: "cmp-1", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "2.0" },
        { agreementId: "cmp-2", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "4.0" },
        { agreementId: "target-1", effectiveDate: undefined, adjustmentPercent: "2.0" },
        { agreementId: "target-1", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "3.0" },
        { agreementId: "target-1", effectiveDate: undefined, adjustmentPercent: "1.5" },
      ],
      [
        { agreementId: "cmp-1", clauseFamily: "wages" },
        { agreementId: "cmp-1", clauseFamily: "leave" },
        { agreementId: "cmp-2", clauseFamily: "wages" },
      ],
    );

    const { findComparableAgreements } = await import("../benchmark-service");
    const result = await findComparableAgreements("target-1", {
      union: "A",
      employerClass: "Employer",
      minComparables: 2,
    });

    expect(result.insufficientData).toBeUndefined();
    expect(result.comparableCount).toBe(2);
    expect(result.medianWageIncrease).toBe(4);
    expect(result.avgTermMonths).toBe(30);
    expect(result.clauseFamilyCoverage).toEqual({ wages: 100, leave: 50 });
    expect(result.targetWageIncrease).toBe(3);
    expect(result.targetWagePercentile).toBe(50);
    expect(result.comparables[1].employer).toBe("Unknown");
    expect(result.comparables[1].union).toBe("Unknown");
  });

  it("returns null aggregates when comparable wages and terms are missing", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "target-1",
          jurisdiction: null,
          sector: null,
          termMonths: null,
        },
      ],
      [
        {
          id: "cmp-1",
          employerNormalized: "Employer A",
          unionNormalized: "Union A",
          jurisdiction: null,
          sector: null,
          termMonths: null,
        },
      ],
      [{ agreementId: "cmp-1", effectiveDate: new Date("2026-01-01"), adjustmentPercent: null }],
      [{ agreementId: "cmp-1", clauseFamily: null }],
    );

    const { findComparableAgreements } = await import("../benchmark-service");
    const result = await findComparableAgreements("target-1", { minComparables: 1 });

    expect(result.medianWageIncrease).toBeNull();
    expect(result.avgTermMonths).toBeNull();
    expect(result.clauseFamilyCoverage).toEqual({});
    expect(result.targetWageIncrease).toBeNull();
    expect(result.targetWagePercentile).toBeNull();
  });

  it("handles wage sorting with missing effectiveDate and computes mixed clause coverage", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "target-1",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 36,
        },
      ],
      [
        {
          id: "cmp-1",
          employerNormalized: "Employer A",
          unionNormalized: "Union A",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 24,
        },
        {
          id: "cmp-2",
          employerNormalized: "Employer B",
          unionNormalized: "Union B",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 24,
        },
      ],
      [
        { agreementId: "cmp-1", effectiveDate: undefined, adjustmentPercent: "1.0" },
        { agreementId: "cmp-1", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "2.0" },
        { agreementId: "cmp-1", effectiveDate: undefined, adjustmentPercent: "0.5" },
        { agreementId: "cmp-2", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "3.0" },
      ],
      [
        { agreementId: "cmp-1", clauseFamily: "wages" },
        // cmp-2 intentionally has no clause row to exercise the empty-set fallback path.
      ],
    );

    const { findComparableAgreements } = await import("../benchmark-service");
    const result = await findComparableAgreements("target-1", { minComparables: 2 });

    expect(result.clauseFamilyCoverage).toEqual({ wages: 50 });
    expect(result.comparables[0].latestWageIncreasePct).toBe(2);
  });

  it("uses default minComparables when filter value is not provided", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "target-1",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 36,
        },
      ],
      [
        {
          id: "cmp-1",
          employerNormalized: "Employer A",
          unionNormalized: "Union A",
          jurisdiction: "federal",
          sector: "public",
          termMonths: 24,
        },
      ],
      [{ agreementId: "cmp-1", effectiveDate: new Date("2026-01-01"), adjustmentPercent: "2.0" }],
      [{ agreementId: "cmp-1", clauseFamily: "wages" }],
    );

    const { findComparableAgreements } = await import("../benchmark-service");
    const result = await findComparableAgreements("target-1");

    expect(result.insufficientData).toBe(true);
    expect(result.requiredComparables).toBe(5);
  });

  it("throws if target agreement does not exist", async () => {
    mocks.selectQueue.push([]);

    const { findComparableAgreements } = await import("../benchmark-service");
    await expect(findComparableAgreements("missing")).rejects.toThrow("Agreement not found: missing");
  });

  it("wraps non-Error failures when computing benchmark", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw "boom";
    });

    const { findComparableAgreements } = await import("../benchmark-service");
    await expect(findComparableAgreements("target-1")).rejects.toThrow("Failed to compute benchmark");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });

  it("saveBenchmarkSnapshot persists transformed result", async () => {
    const benchmarkResult = {
      targetAgreementId: "target-1",
      comparables: [
        {
          agreementId: "cmp-1",
          employer: "Employer A",
          union: "Union A",
          jurisdiction: "federal",
          sector: "public",
          latestWageIncreasePct: 3,
          termMonths: 24,
          clauseFamilies: ["wages"],
          comparability: "exact" as const,
        },
      ],
      comparableCount: 1,
      medianWageIncrease: 3,
      avgTermMonths: 24,
      clauseFamilyCoverage: { wages: 100 },
      targetWageIncrease: 2.5,
      targetTermMonths: 36,
      targetWagePercentile: 40,
    };

    mocks.selectQueue.push([
      {
        id: "target-1",
        jurisdiction: "federal",
        sector: "public",
        unionNormalized: "PSAC",
      },
    ]);
    mocks.insertQueue.push([{ id: "snap-1", targetAgreementId: "target-1" }]);

    const { saveBenchmarkSnapshot } = await import("../benchmark-service");
    const snapshot = await saveBenchmarkSnapshot(benchmarkResult, "user-1");

    expect(snapshot).toMatchObject({ id: "snap-1", targetAgreementId: "target-1" });
    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        targetAgreementId: "target-1",
        filterJurisdiction: "federal",
        filterSector: "public",
        filterUnion: "PSAC",
        computedBy: "user-1",
        comparables: [
          expect.objectContaining({
            agreementId: "cmp-1",
            title: "Employer A / Union A",
          }),
        ],
      }),
    );
    expect(mocks.mockLoggerInfo).toHaveBeenCalled();
  });

  it("saveBenchmarkSnapshot tolerates missing target metadata", async () => {
    mocks.selectQueue.push([]);
    mocks.insertQueue.push([{ id: "snap-2", targetAgreementId: "target-1" }]);

    const { saveBenchmarkSnapshot } = await import("../benchmark-service");
    await saveBenchmarkSnapshot(
      {
        targetAgreementId: "target-1",
        comparables: [],
        comparableCount: 0,
        medianWageIncrease: null,
        avgTermMonths: null,
        clauseFamilyCoverage: {},
        targetWageIncrease: null,
        targetTermMonths: null,
        targetWagePercentile: null,
      },
      "user-1",
    );

    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        filterJurisdiction: undefined,
        filterSector: undefined,
        filterUnion: undefined,
      }),
    );
  });

  it("saveBenchmarkSnapshot wraps persistence failures", async () => {
    mocks.selectQueue.push([]);
    mocks.mockInsertValues.mockImplementationOnce(() => {
      throw new Error("insert failed");
    });

    const { saveBenchmarkSnapshot } = await import("../benchmark-service");
    await expect(
      saveBenchmarkSnapshot(
        {
          targetAgreementId: "target-1",
          comparables: [],
          comparableCount: 0,
          medianWageIncrease: null,
          avgTermMonths: null,
          clauseFamilyCoverage: {},
          targetWageIncrease: null,
          targetTermMonths: null,
          targetWagePercentile: null,
        },
        "user-1",
      ),
    ).rejects.toThrow("Failed to save benchmark snapshot");
  });

  it("getBenchmarkSnapshots returns paginated items and caps limit", async () => {
    mocks.selectQueue.push(
      [{ count: 12 }],
      [
        { id: "snap-2", targetAgreementId: "target-1" },
        { id: "snap-1", targetAgreementId: "target-1" },
      ],
    );

    const { getBenchmarkSnapshots } = await import("../benchmark-service");
    const result = await getBenchmarkSnapshots("target-1", { page: 2, limit: 99 });

    expect(result).toEqual({
      items: [
        { id: "snap-2", targetAgreementId: "target-1" },
        { id: "snap-1", targetAgreementId: "target-1" },
      ],
      total: 12,
      page: 2,
      limit: 50,
    });
  });

  it("getBenchmarkSnapshots wraps fetch failures", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("query failed");
    });

    const { getBenchmarkSnapshots } = await import("../benchmark-service");
    await expect(getBenchmarkSnapshots("target-1")).rejects.toThrow("Failed to fetch benchmark snapshots");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });
});
