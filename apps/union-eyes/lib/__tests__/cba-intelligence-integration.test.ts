import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock infrastructure
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockExecute: vi.fn(),
}));

function makeDbChain(result: unknown = []): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "from", "innerJoin", "leftJoin", "rightJoin",
    "orderBy", "limit", "offset", "update", "set", "where",
    "returning", "insert", "values", "groupBy", "having",
    "onConflictDoUpdate", "onConflictDoNothing",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => makeDbChain(result));
  }
  chain.then = (resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };
  return chain;
}

vi.mock("@/db/db", () => ({
  db: {
    ...makeDbChain(),
    select: mocks.mockSelect.mockImplementation(() => makeDbChain()),
    insert: mocks.mockInsert.mockImplementation(() => makeDbChain()),
    update: mocks.mockUpdate.mockImplementation(() => makeDbChain()),
    delete: mocks.mockDelete.mockImplementation(() => makeDbChain()),
    execute: mocks.mockExecute.mockResolvedValue([]),
  },
}));

vi.mock("@/db/schema", () => {
  const table = (name: string) => ({ _: { name }, $inferSelect: {}, $inferInsert: {} });
  return {
    cbaIntelSources: table("cba_intel_sources"),
    cbaIntelIngestionJobs: table("cba_intel_ingestion_jobs"),
    cbaIntelDocuments: table("cba_intel_documents"),
    cbaIntelExtractionRuns: table("cba_intel_extraction_runs"),
    cbaIntelFindings: table("cba_intel_findings"),
    cbaIntelAgreements: table("cba_intel_agreements"),
    cbaIntelWageAdjustments: table("cba_intel_wage_adjustments"),
    cbaIntelClauses: table("cba_intel_clauses"),
    cbaIntelReviewDecisions: table("cba_intel_review_decisions"),
    cbaIntelBenchmarkSnapshots: table("cba_intel_benchmark_snapshots"),
    cbaIntelFreshnessSnapshots: table("cba_intel_freshness_snapshots"),
    sourceTypeEnum: { enumValues: ["federal_labour"] },
    collectionMethodEnum: { enumValues: ["manual_upload"] },
    trustTierEnum: { enumValues: ["official"] },
    healthStatusEnum: { enumValues: ["healthy", "degraded", "unreachable", "unknown"] },
    ingestionStatusEnum: { enumValues: ["queued", "running", "completed", "failed"] },
    docTypeEnum: { enumValues: ["cba", "arbitration", "bulletin"] },
    docProcessingStatusEnum: { enumValues: ["pending", "processed", "failed"] },
    extractionMethodEnum: { enumValues: ["rule_based", "llm", "hybrid"] },
    extractionStatusEnum: { enumValues: ["pending", "running", "completed", "failed"] },
    clauseFamilyEnum: { enumValues: ["wages", "hours", "benefits", "leave", "safety", "discipline", "seniority", "management_rights", "grievance", "other"] },
    reviewStatusEnum: { enumValues: ["pending_review", "approved", "rejected", "needs_followup"] },
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    desc: vi.fn((col: unknown) => ({ type: "desc", col })),
    ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    sql: actual.sql,
    relations: vi.fn(() => ({})),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Pipeline fixture data
// ---------------------------------------------------------------------------

const SOURCE_ID = "src-fslrb-001";
const JOB_ID = "job-001";
const DOC_ID = "doc-psac-pa-001";
const EXTRACTION_RUN_ID = "extr-001";
const FINDING_ID = "find-001";
const AGREEMENT_ID = "agr-psac-pa-001";
const WAGE_ADJ_ID = "wage-001";
const CLAUSE_ID = "clause-001";
const REVIEW_ID = "review-001";
const _BENCHMARK_SNAPSHOT_ID = "bench-001";
const ORG_ID = "org-test-001";

const SOURCE_FIXTURE = {
  id: SOURCE_ID,
  slug: "fslrb-decisions",
  nameEn: "Federal Service Labour Relations Board",
  nameFr: "Commission des relations de travail dans la fonction publique",
  sourceType: "federal_labour",
  collectionMethod: "manual_upload",
  trustTier: "official",
  healthStatus: "healthy",
  isActive: true,
  jurisdictions: ["federal"],
  baseUrl: "https://decisions.fslrb-crtefp.gc.ca",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const JOB_FIXTURE = {
  id: JOB_ID,
  sourceId: SOURCE_ID,
  orgId: ORG_ID,
  status: "completed",
  triggerType: "manual",
  documentsFound: 3,
  documentsNew: 2,
  documentsUpdated: 1,
  startedAt: new Date("2026-03-01T10:00:00Z"),
  completedAt: new Date("2026-03-01T10:05:00Z"),
  durationMs: 300000,
  createdAt: new Date("2026-03-01"),
};

const DOC_FIXTURE = {
  id: DOC_ID,
  sourceId: SOURCE_ID,
  orgId: ORG_ID,
  title: "PSAC PA Group Collective Agreement 2025-2028",
  sourceUrl: "https://decisions.fslrb-crtefp.gc.ca/docs/psac-pa-2025.pdf",
  documentType: "cba",
  contentHash: "abc123def456",
  language: "en",
  jurisdiction: "federal",
  processingStatus: "processed",
  isLatest: true,
  createdAt: new Date("2026-03-01"),
};

const FINDING_FIXTURE = {
  id: FINDING_ID,
  documentId: DOC_ID,
  extractionRunId: EXTRACTION_RUN_ID,
  orgId: ORG_ID,
  findingType: "wage_increase",
  clauseFamily: "wages",
  confidence: 0.92,
  summary: "Annual wage increase of 2.8% in year 1",
  rawText: "The annual rate of pay shall be increased by 2.8% effective April 1, 2025",
  reviewStatus: "pending_review",
  createdAt: new Date("2026-03-01"),
};

const AGREEMENT_FIXTURE = {
  id: AGREEMENT_ID,
  documentId: DOC_ID,
  orgId: ORG_ID,
  employer: "Treasury Board of Canada",
  union: "PSAC",
  bargainingUnit: "PA Group",
  jurisdiction: "federal",
  sector: "public_admin",
  effectiveDate: new Date("2025-04-01"),
  expiryDate: new Date("2028-03-31"),
  termMonths: 36,
  reviewStatus: "approved",
  createdAt: new Date("2026-03-01"),
};

// ---------------------------------------------------------------------------
// Tests — Full integration pipeline
// ---------------------------------------------------------------------------

describe("CBA Intelligence – Integration pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Step 1: creates a source via source-registry", async () => {
    const _returning = makeDbChain([SOURCE_FIXTURE]);
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([SOURCE_FIXTURE]));

    const { createSource } = await import("@/lib/services/cba-intelligence/source-registry-service");
    const result = await createSource(
      SOURCE_FIXTURE as unknown as Parameters<typeof createSource>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: SOURCE_ID, slug: "fslrb-decisions" });
  });

  it("Step 2: creates an ingestion job", async () => {
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([JOB_FIXTURE]));

    const { createIngestionJob } = await import("@/lib/services/cba-intelligence/ingestion-service");
    const result = await createIngestionJob(
      {
        sourceId: SOURCE_ID,
        orgId: ORG_ID,
        triggerType: "manual",
      } as unknown as Parameters<typeof createIngestionJob>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: JOB_ID, sourceId: SOURCE_ID });
  });

  it("Step 3: upserts a document via document-service", async () => {
    mocks.mockSelect.mockReturnValueOnce(makeDbChain([])); // no existing doc
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([DOC_FIXTURE]));

    const { upsertDocument } = await import("@/lib/services/cba-intelligence/document-service");
    const result = await upsertDocument(
      {
        sourceId: SOURCE_ID,
        orgId: ORG_ID,
        title: DOC_FIXTURE.title,
        sourceUrl: DOC_FIXTURE.sourceUrl,
        documentType: "cba",
        rawContent: "Full text of the agreement...",
        language: "en",
        jurisdiction: "federal",
      } as unknown as Parameters<typeof upsertDocument>[0],
    );

    expect(result).toHaveProperty("document");
    expect(result).toHaveProperty("action");
  });

  it("Step 4: creates an extraction run", async () => {
    const runFixture = {
      id: EXTRACTION_RUN_ID,
      documentId: DOC_ID,
      orgId: ORG_ID,
      method: "rule_based",
      status: "pending",
      createdAt: new Date("2026-03-01"),
    };
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([runFixture]));

    const { createExtractionRun } = await import("@/lib/services/cba-intelligence/extraction-service");
    const result = await createExtractionRun(
      {
        documentId: DOC_ID,
        orgId: ORG_ID,
        method: "rule_based",
      } as unknown as Parameters<typeof createExtractionRun>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: EXTRACTION_RUN_ID, documentId: DOC_ID });
  });

  it("Step 5: creates findings from extraction", async () => {
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([FINDING_FIXTURE]));

    const { createFinding } = await import("@/lib/services/cba-intelligence/extraction-service");
    const result = await createFinding(
      {
        documentId: DOC_ID,
        extractionRunId: EXTRACTION_RUN_ID,
        orgId: ORG_ID,
        findingType: "wage_increase",
        clauseFamily: "wages",
        confidence: 0.92,
        summary: FINDING_FIXTURE.summary,
        rawText: FINDING_FIXTURE.rawText,
      } as unknown as Parameters<typeof createFinding>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ findingType: "wage_increase", confidence: 0.92 });
  });

  it("Step 6: creates an agreement from extracted data", async () => {
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([AGREEMENT_FIXTURE]));

    const { createAgreement } = await import("@/lib/services/cba-intelligence/extraction-service");
    const result = await createAgreement(
      {
        documentId: DOC_ID,
        orgId: ORG_ID,
        employer: "Treasury Board of Canada",
        union: "PSAC",
        bargainingUnit: "PA Group",
        jurisdiction: "federal",
        sector: "public_admin",
      } as unknown as Parameters<typeof createAgreement>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ employer: "Treasury Board of Canada", union: "PSAC" });
  });

  it("Step 7: creates wage adjustments for the agreement", async () => {
    const wageFixture = {
      id: WAGE_ADJ_ID,
      agreementId: AGREEMENT_ID,
      orgId: ORG_ID,
      effectiveDate: new Date("2025-04-01"),
      increasePct: "2.80",
      increaseType: "general",
      createdAt: new Date("2026-03-01"),
    };
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([wageFixture]));

    const { createWageAdjustment } = await import("@/lib/services/cba-intelligence/extraction-service");
    const result = await createWageAdjustment(
      {
        agreementId: AGREEMENT_ID,
        orgId: ORG_ID,
        effectiveDate: new Date("2025-04-01"),
        increasePct: "2.80",
        increaseType: "general",
      } as unknown as Parameters<typeof createWageAdjustment>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ agreementId: AGREEMENT_ID });
  });

  it("Step 8: creates clauses for the agreement", async () => {
    const clauseFixture = {
      id: CLAUSE_ID,
      agreementId: AGREEMENT_ID,
      orgId: ORG_ID,
      clauseFamily: "wages",
      title: "Annual Pay Increases",
      rawText: "Annual rate of pay shall be increased...",
      contentHash: "abc123",
      confidence: 0.95,
      createdAt: new Date("2026-03-01"),
    };
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([clauseFixture]));

    const { createClause } = await import("@/lib/services/cba-intelligence/extraction-service");
    const result = await createClause(
      {
        agreementId: AGREEMENT_ID,
        orgId: ORG_ID,
        clauseFamily: "wages",
        title: "Annual Pay Increases",
        rawText: "Annual rate of pay shall be increased...",
      } as unknown as Parameters<typeof createClause>[0],
    );

    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(result).toMatchObject({ clauseFamily: "wages" });
  });

  it("Step 9: submits a review decision", async () => {
    const reviewFixture = {
      id: REVIEW_ID,
      targetType: "finding",
      targetId: FINDING_ID,
      decision: "approved",
      reason: "Verified against source PDF",
      reviewerId: "user-admin-001",
      reviewerRole: "admin",
      createdAt: new Date("2026-03-02"),
    };

    // submitReview does: select target to verify → insert review → update target status
    mocks.mockSelect.mockReturnValueOnce(makeDbChain([{ id: FINDING_ID, reviewStatus: "pending_review" }]));
    mocks.mockInsert.mockReturnValueOnce(makeDbChain([reviewFixture]));
    mocks.mockUpdate.mockReturnValueOnce(makeDbChain([{ ...FINDING_FIXTURE, reviewStatus: "approved" }]));

    const { submitReview } = await import("@/lib/services/cba-intelligence/review-service");
    const _result = await submitReview({
      targetType: "finding",
      targetId: FINDING_ID,
      decision: "approved",
      reason: "Verified against source PDF",
      reviewerId: "user-admin-001",
      reviewerRole: "admin",
    });

    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it("Step 10: computes freshness status for the source", async () => {
    const { computeFreshnessStatus } = await import("@/lib/services/cba-intelligence/freshness-service");

    // Source last updated 5 days ago → should be fresh
    expect(computeFreshnessStatus(5)).toBe("fresh");
    // 20 days → aging
    expect(computeFreshnessStatus(20)).toBe("aging");
    // 50 days → stale
    expect(computeFreshnessStatus(50)).toBe("stale");
  });

  it("Step 11: finds comparable agreements for benchmarking", async () => {
    // Simulate finding 3 comparable agreements
    const comparables = [
      { ...AGREEMENT_FIXTURE, id: "agr-comp-1", employer: "Canada Border Services Agency" },
      { ...AGREEMENT_FIXTURE, id: "agr-comp-2", employer: "Parks Canada" },
    ];
    mocks.mockSelect.mockReturnValueOnce(makeDbChain(comparables));
    // Second select for wage adjustments
    mocks.mockSelect.mockReturnValueOnce(makeDbChain([
      { agreementId: "agr-comp-1", increasePct: "2.50" },
      { agreementId: "agr-comp-2", increasePct: "3.10" },
    ]));

    const { findComparableAgreements } = await import("@/lib/services/cba-intelligence/benchmark-service");
    const _result = await findComparableAgreements(AGREEMENT_ID, {
      jurisdiction: "federal",
      sector: "public_admin",
    });

    expect(mocks.mockSelect).toHaveBeenCalled();
  });
});
