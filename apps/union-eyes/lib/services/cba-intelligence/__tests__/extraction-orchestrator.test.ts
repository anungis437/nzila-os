import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  dbFrom: vi.fn(),
  dbWhere: vi.fn(),
  dbLimit: vi.fn(),
  createExtractionRun: vi.fn(),
  completeExtractionRun: vi.fn(),
  createFindingsBatch: vi.fn(),
  updateDocumentStatus: vi.fn(),
  flagForFollowupReview: vi.fn(),
  metricObserve: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/db/db", () => ({ db: { select: mocks.dbSelect } }));
vi.mock("@/db/schema", () => ({
  cbaIntelDocuments: { id: "id", isLatest: "isLatest", processingStatus: "processingStatus" },
  cbaIntelFindings: { id: "id", reviewStatus: "reviewStatus", confidence: "confidence", createdAt: "createdAt", clauseFamily: "clauseFamily" },
  cbaIntelAgreements: { id: "id", reviewStatus: "reviewStatus", overallConfidence: "overallConfidence", createdAt: "createdAt" },
  cbaIntelWageAdjustments: { id: "id", reviewStatus: "reviewStatus" },
  cbaIntelClauses: { id: "id", reviewStatus: "reviewStatus" },
  cbaIntelReviewDecisions: { targetType: "targetType", targetId: "targetId", createdAt: "createdAt" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})) }));
vi.mock("@/lib/logger", () => ({ logger: { info: mocks.loggerInfo, error: mocks.loggerError, warn: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/observability/metrics", () => ({ cbaIntelExtractionConfidence: { observe: mocks.metricObserve } }));
vi.mock("@/lib/services/cba-intelligence/extraction-service", () => ({
  createExtractionRun: mocks.createExtractionRun,
  completeExtractionRun: mocks.completeExtractionRun,
  createFindingsBatch: mocks.createFindingsBatch,
}));
vi.mock("@/lib/services/cba-intelligence/document-service", () => ({ updateDocumentStatus: mocks.updateDocumentStatus }));
vi.mock("@/lib/services/cba-intelligence/review-service", () => ({ flagForFollowupReview: mocks.flagForFollowupReview }));

describe("extraction-orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CBA_INTEL_REVIEW_CONFIDENCE_THRESHOLD;
    delete process.env.CBA_INTEL_MAX_AUTO_REVIEW_ENQUEUES;
    mocks.dbSelect.mockReturnValue({ from: mocks.dbFrom });
    mocks.dbFrom.mockReturnValue({ where: mocks.dbWhere });
    mocks.dbWhere.mockReturnValue({ limit: mocks.dbLimit });
    mocks.createExtractionRun.mockResolvedValue({ id: "run-1" });
    mocks.completeExtractionRun.mockResolvedValue(undefined);
    mocks.createFindingsBatch.mockImplementation(async (rows: Array<{ confidence: string }>) =>
      rows.map((row, index) => ({ id: `f-${index + 1}`, confidence: row.confidence })),
    );
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
    mocks.flagForFollowupReview.mockResolvedValue(undefined);
  });

  it("covers helper utilities through __test__", async () => {
    const mod = await import("../extraction-orchestrator");
    expect(mod.__test__.parseThreshold(undefined, 0.5)).toBe(0.5);
    expect(mod.__test__.parseThreshold("bad", 0.5)).toBe(0.5);
    expect(mod.__test__.parseThreshold("2", 0.5)).toBe(1);
    expect(mod.__test__.parseThreshold("-1", 0.5)).toBe(0);

    process.env.CBA_INTEL_REVIEW_CONFIDENCE_THRESHOLD = "0.4";
    process.env.CBA_INTEL_MAX_AUTO_REVIEW_ENQUEUES = "0";
    expect(mod.__test__.getExtractionPolicy()).toEqual({
      followupConfidenceThreshold: 0.4,
      maxAutoReviewEnqueues: 20,
    });

    expect(mod.__test__.deriveActionRecommendations({
      agreement: { expiryDate: null } as never,
      wageAdjustments: [{ adjustmentPercent: 4.5 }] as never,
      clauses: [],
    })).toHaveLength(3);

    expect(mod.__test__.normalizeText('<script>x</script><style>y</style><p>A&nbsp;&amp;&lt;&gt;&quot;&#39; B</p>', 'text/html')).toContain('A &<>"\' B');
    expect(mod.__test__.normalizeText('A   B', 'text/plain')).toBe('A B');
    expect(mod.__test__.detectJurisdiction('ontario federal canada labour code')).toBe('CA-ON');
    expect(mod.__test__.detectJurisdiction('unknown')).toBeNull();
    expect(mod.__test__.detectSector('healthcare hospital nursing')).toBe('healthcare');
    expect(mod.__test__.detectSector('education school university')).toBe('education');
    expect(mod.__test__.detectSector('construction city of police firefighter transit retail manufacturing mining forestry telecommunications postal banking')).toBe('construction');
    expect(mod.__test__.detectSector('unknown')).toBeNull();
    expect(mod.__test__.tryParseDate('January 1, 2026')).toBe('2026-01-01');
    expect(mod.__test__.tryParseDate('not a date')).toBeNull();
    expect(mod.__test__.tryParseDate({ trim: () => { throw new Error('bad'); } } as never)).toBeNull();
    expect(mod.__test__.extractMetadata('This is a 3 year agreement contract.', { jurisdiction: null, language: null } as never).termMonths).toBe(36);

    const wages = mod.__test__.extractWages('3.5% wage increase year 1 - 2.5% 2026: 4.0% 2026: 4.0% 35% wage increase');
    expect(wages.some((w: { adjustmentPercent: number }) => w.adjustmentPercent === 3.5)).toBe(true);
    expect(wages.some((w: { adjustmentPercent: number }) => w.adjustmentPercent === 35)).toBe(false);
    expect(wages.some((w: { effectiveDate: string | null }) => w.effectiveDate === null)).toBe(true);
    const yearWages = mod.__test__.extractWages('year 1: 2.5% 2030: 31%');
    expect(yearWages.some((w: { adjustmentPercent: number; effectiveDate: string | null }) => w.adjustmentPercent === 2.5 && w.effectiveDate !== null)).toBe(true);
    expect(yearWages.some((w: { adjustmentPercent: number }) => w.adjustmentPercent === 31)).toBe(false);

    const clauses = mod.__test__.classifyClauses('Article 1\nThe wage salary compensation clause applies extensively to all employees over many words and lines.\n\nSection 2\nShort');
    expect(clauses.some((c: { clauseFamily: string }) => c.clauseFamily === 'wages')).toBe(true);
    expect(mod.__test__.classifyClauses('tiny text')).toEqual([]);
    expect(mod.__test__.classifyClauses('Article 2\nThis paragraph is intentionally long enough to pass the section length check but contains no known keyword families for classification whatsoever.')).toEqual([]);
  });

  it("extracts document successfully and auto-flags low-confidence findings", async () => {
    mocks.dbLimit.mockResolvedValue([
      {
        id: 'doc-1',
        rawContent: '<p>between the Treasury Board and the PSAC local unit. Effective January 1, 2025 until December 31, 2027. Healthcare hospital sector. A 4.5% wage increase. No grievance process mentioned.</p>',
        documentType: 'text/html',
        language: null,
        jurisdiction: null,
      },
    ]);
    const { extractDocument } = await import('../extraction-orchestrator');
    const result = await extractDocument('doc-1');
    expect(result.errors).toEqual([]);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.agreement?.employerName).toBeTruthy();
    expect(result.findings.some((f) => f.findingType === 'sector')).toBe(true);
    expect(mocks.createFindingsBatch).toHaveBeenCalled();
    expect(mocks.flagForFollowupReview).toHaveBeenCalled();
    expect(mocks.metricObserve).toHaveBeenCalled();
  });

  it("extracts with missing parties and default html type fallback", async () => {
    mocks.dbLimit.mockResolvedValue([
      {
        id: 'doc-4',
        rawContent: 'Ontario school agreement effective January 1, 2025 until December 31, 2025. Wage increase of 2%.',
        documentType: null,
        language: 'en',
        jurisdiction: null,
      },
    ]);
    const { extractDocument } = await import('../extraction-orchestrator');
    const result = await extractDocument('doc-4');
    expect(result.findings.some((f) => f.findingType === 'employer_name')).toBe(false);
    expect(result.findings.some((f) => f.findingType === 'union_name')).toBe(false);
    expect(result.findings.some((f) => f.findingType === 'jurisdiction')).toBe(true);
  });

  it("handles missing document and missing raw content", async () => {
    mocks.dbLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'doc-2', rawContent: null }]);
    const { extractDocument } = await import('../extraction-orchestrator');
    await expect(extractDocument('missing')).rejects.toThrow('Document not found: missing');
    await expect(extractDocument('doc-2')).rejects.toThrow('Document has no raw content: doc-2');
  });

  it("returns failure result when extraction pipeline throws after run creation", async () => {
    mocks.dbLimit.mockResolvedValue([{ id: 'doc-3', rawContent: 'plain text', documentType: 'text/plain', language: 'en', jurisdiction: 'CA-FED' }]);
    mocks.updateDocumentStatus.mockRejectedValueOnce(new Error('normalize fail')).mockResolvedValueOnce(undefined);
    const { extractDocument } = await import('../extraction-orchestrator');
    const result = await extractDocument('doc-3');
    expect(result.errors).toContain('normalize fail');
    expect(mocks.completeExtractionRun).toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("converts non-Error failures inside extraction catch", async () => {
    mocks.dbLimit.mockResolvedValue([{ id: 'doc-5', rawContent: 'plain text', documentType: 'text/plain', language: 'en', jurisdiction: 'CA-FED' }]);
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
    mocks.createFindingsBatch.mockRejectedValueOnce('boom');
    const { extractDocument } = await import('../extraction-orchestrator');
    const result = await extractDocument('doc-5');
    expect(result.errors).toContain('boom');
  });

  it("runBulkExtraction aggregates success and failure results", async () => {
    mocks.dbLimit
      .mockResolvedValueOnce([{ id: 'doc-a' }, { id: 'doc-b' }])
      .mockResolvedValueOnce([{ id: 'doc-a', rawContent: 'between Employer and Union. Effective January 1, 2025 until December 31, 2025. 2% wage increase.', documentType: 'text/plain', language: 'en', jurisdiction: 'CA-FED' }])
      .mockResolvedValueOnce([{ id: 'doc-b', rawContent: 'between Employer and Union. 31% wage increase.', documentType: 'text/plain', language: 'en', jurisdiction: 'CA-FED' }]);
    mocks.createFindingsBatch
      .mockImplementationOnce(async (rows: Array<{ confidence: string }>) => rows.map((row, index) => ({ id: `f-${index + 1}`, confidence: row.confidence })))
      .mockRejectedValueOnce(new Error('findings fail'));
    const mod = await import('../extraction-orchestrator');
    const result = await mod.runBulkExtraction();
    expect(result).toMatchObject({ processed: 2, succeeded: 1, failed: 1 });
  });
});
