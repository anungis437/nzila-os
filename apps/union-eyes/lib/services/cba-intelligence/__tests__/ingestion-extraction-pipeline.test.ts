import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  // Source registry
  mockListSources: vi.fn(),
  mockUpdateSourceHealth: vi.fn(),
  // Ingestion service
  mockCreateIngestionJob: vi.fn(),
  mockStartIngestionJob: vi.fn(),
  mockCompleteIngestionJob: vi.fn(),
  mockFailIngestionJob: vi.fn(),
  // Document service
  mockUpsertDocument: vi.fn(),
  mockComputeContentHash: vi.fn(),
  // Adapters
  mockGetAdapter: vi.fn(),
  mockGetRegisteredAdapterKeys: vi.fn(),
  // Extraction service
  mockCreateExtractionRun: vi.fn(),
  mockCompleteExtractionRun: vi.fn(),
  mockCreateFindingsBatch: vi.fn(),
  // Document service (for extraction)
  mockUpdateDocumentStatus: vi.fn(),
  // DB
  mockDbSelect: vi.fn(),
  mockDbSelectFrom: vi.fn(),
  mockDbSelectWhere: vi.fn(),
  mockDbSelectLimit: vi.fn(),
  // Metrics (no-op)
  mockMetricInc: vi.fn(),
  mockMetricObserve: vi.fn(),
  mockMetricSet: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/observability/metrics", () => ({
  cbaIntelIngestionJobsTotal: { inc: mocks.mockMetricInc },
  cbaIntelIngestionDuration: { observe: mocks.mockMetricObserve },
  cbaIntelDocumentsIngested: { inc: mocks.mockMetricInc },
  cbaIntelExtractionConfidence: { observe: mocks.mockMetricObserve },
  cbaIntelSourceFreshness: { set: mocks.mockMetricSet },
}));

vi.mock("@/lib/services/cba-intelligence/source-registry-service", () => ({
  listSources: mocks.mockListSources,
  updateSourceHealth: mocks.mockUpdateSourceHealth,
}));

vi.mock("@/lib/services/cba-intelligence/ingestion-service", () => ({
  createIngestionJob: mocks.mockCreateIngestionJob,
  startIngestionJob: mocks.mockStartIngestionJob,
  completeIngestionJob: mocks.mockCompleteIngestionJob,
  failIngestionJob: mocks.mockFailIngestionJob,
}));

vi.mock("@/lib/services/cba-intelligence/document-service", () => ({
  upsertDocument: mocks.mockUpsertDocument,
  computeContentHash: mocks.mockComputeContentHash,
  updateDocumentStatus: mocks.mockUpdateDocumentStatus,
}));

vi.mock("@/lib/services/cba-intelligence/adapters", () => ({
  getAdapter: mocks.mockGetAdapter,
  getRegisteredAdapterKeys: mocks.mockGetRegisteredAdapterKeys,
}));

vi.mock("@/lib/services/cba-intelligence/extraction-service", () => ({
  createExtractionRun: mocks.mockCreateExtractionRun,
  completeExtractionRun: mocks.mockCompleteExtractionRun,
  createFindingsBatch: mocks.mockCreateFindingsBatch,
  listAgreements: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: {
    select: mocks.mockDbSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  cbaIntelDocuments: { id: "id", isLatest: "is_latest", processingStatus: "processing_status" },
  cbaIntelSources: {},
  cbaIntelIngestionJobs: {},
  cbaIntelFreshnessLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ eq: val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn(),
  ilike: vi.fn(),
  relations: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testSource = {
  id: "src-001",
  name: "Test ESDC Source",
  nameEn: "Test ESDC Source",
  slug: "test-esdc",
  sourceType: "federal_labour",
  adapterKey: "esdc_federal",
  collectionMethod: "scheduled_fetch",
  trustTier: "official",
  isActive: true,
  baseUrl: "https://example.gov.ca",
  config: {},
  jurisdictions: ["CA-FED"],
  jurisdiction: "CA-FED",
};

const testDiscoveredDoc = {
  sourceUrl: "https://example.gov.ca/cba/001.html",
  title: "Collective Agreement between ACME Corp and CUPE Local 123",
  documentType: "collective_agreement",
  language: "en",
  jurisdiction: "CA-ON",
};

const testFetchedContent = {
  rawContent:
    "<html><body><h1>Collective Agreement</h1>" +
    "<p>between ACME Corporation and Canadian Union of Public Employees Local 123</p>" +
    "<p>Effective Date: January 1, 2025</p>" +
    "<p>Expiry Date: December 31, 2027</p>" +
    "<h2>Article 1 - Wages</h2>" +
    "<p>A 3.5% wage increase effective January 1, 2025.</p>" +
    "<p>A 3.0% wage increase effective January 1, 2026.</p>" +
    "<h2>Article 2 - Benefits</h2>" +
    "<p>The Employer shall provide dental, vision, and health insurance benefits.</p>" +
    "<h2>Article 3 - Grievance Procedure</h2>" +
    "<p>Any grievance or dispute shall be submitted to arbitration within 30 days.</p>" +
    "</body></html>",
  wordCount: 120,
  pageCount: 3,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CBA Intelligence — Ingestion Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default adapter mock
    const mockAdapter = {
      discover: vi.fn().mockResolvedValue([testDiscoveredDoc]),
      fetch: vi.fn().mockResolvedValue(testFetchedContent),
    };
    mocks.mockGetAdapter.mockReturnValue(mockAdapter);
    mocks.mockGetRegisteredAdapterKeys.mockReturnValue(["esdc_federal"]);

    // Source registry
    mocks.mockListSources.mockResolvedValue({
      items: [testSource],
      total: 1,
      page: 1,
      limit: 100,
    });

    // Ingestion job lifecycle
    mocks.mockCreateIngestionJob.mockResolvedValue({ id: "job-001" });
    mocks.mockStartIngestionJob.mockResolvedValue(true);
    mocks.mockCompleteIngestionJob.mockResolvedValue(undefined);

    // Document persistence
    mocks.mockComputeContentHash.mockReturnValue("abc123hash");
    mocks.mockUpsertDocument.mockResolvedValue({ action: "created", id: "doc-001" });

    // Health
    mocks.mockUpdateSourceHealth.mockResolvedValue(undefined);
  });

  it("runs full ingestion: discover → fetch → persist → metrics", async () => {
    const { runFullIngestion } = await import("@/lib/services/cba-intelligence/ingestion-orchestrator");

    const result = await runFullIngestion();

    // Should have processed 1 source
    expect(result.totalSources).toBe(1);
    expect(result.sourcesSucceeded).toBe(1);
    expect(result.sourcesFailed).toBe(0);
    expect(result.totalDocumentsIngested).toBe(1);

    // Source result details
    const sr = result.results[0];
    expect(sr.status).toBe("completed");
    expect(sr.documentsFound).toBe(1);
    expect(sr.documentsNew).toBe(1);

    // Adapter called correctly
    expect(mocks.mockGetAdapter).toHaveBeenCalledWith("esdc_federal");

    // Document persisted
    expect(mocks.mockUpsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "src-001",
        sourceUrl: "https://example.gov.ca/cba/001.html",
        contentHash: "abc123hash",
      }),
    );

    // Prometheus metrics emitted
    expect(mocks.mockMetricInc).toHaveBeenCalled();
    expect(mocks.mockMetricObserve).toHaveBeenCalled();
  });

  it("reports failure when adapter throws", async () => {
    const errorAdapter = {
      discover: vi.fn().mockRejectedValue(new Error("Network timeout")),
      fetch: vi.fn(),
    };
    mocks.mockGetAdapter.mockReturnValue(errorAdapter);
    mocks.mockFailIngestionJob.mockResolvedValue(undefined);

    const { runFullIngestion } = await import("@/lib/services/cba-intelligence/ingestion-orchestrator");
    const result = await runFullIngestion();

    expect(result.sourcesFailed).toBe(1);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].errors).toContain("Network timeout");

    // Failure metric emitted
    expect(mocks.mockMetricInc).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("handles single-source ingestion by ID", async () => {
    const { runSourceIngestion } = await import("@/lib/services/cba-intelligence/ingestion-orchestrator");

    const result = await runSourceIngestion("src-001");

    expect(result.sourceId).toBe("src-001");
    expect(result.status).toBe("completed");
    expect(result.documentsNew).toBe(1);
  });

  it("counts updated and unchanged documents correctly", async () => {
    const adapter = {
      discover: vi.fn().mockResolvedValue([
        { ...testDiscoveredDoc, sourceUrl: "https://example.gov.ca/cba/001.html" },
        { ...testDiscoveredDoc, sourceUrl: "https://example.gov.ca/cba/002.html" },
        { ...testDiscoveredDoc, sourceUrl: "https://example.gov.ca/cba/003.html" },
      ]),
      fetch: vi.fn().mockResolvedValue(testFetchedContent),
    };
    mocks.mockGetAdapter.mockReturnValue(adapter);

    mocks.mockUpsertDocument
      .mockResolvedValueOnce({ action: "created", id: "doc-001" })
      .mockResolvedValueOnce({ action: "updated", id: "doc-002" })
      .mockResolvedValueOnce({ action: "unchanged", id: "doc-003" });

    const { runFullIngestion } = await import("@/lib/services/cba-intelligence/ingestion-orchestrator");
    const result = await runFullIngestion();

    const sr = result.results[0];
    expect(sr.documentsFound).toBe(3);
    expect(sr.documentsNew).toBe(1);
    expect(sr.documentsUpdated).toBe(1);
    expect(sr.documentsUnchanged).toBe(1);
    expect(sr.documentsFailed).toBe(0);
    expect(result.totalDocumentsIngested).toBe(2); // new + updated
  });
});

describe("CBA Intelligence — Extraction Pipeline Integration", () => {
  const testDocument = {
    id: "doc-001",
    rawContent: testFetchedContent.rawContent,
    documentType: "text/html",
    language: "en",
    jurisdiction: "CA-ON",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // DB select for document lookup
    mocks.mockDbSelect.mockReturnValue({ from: mocks.mockDbSelectFrom });
    mocks.mockDbSelectFrom.mockReturnValue({ where: mocks.mockDbSelectWhere });
    mocks.mockDbSelectWhere.mockReturnValue({ limit: mocks.mockDbSelectLimit });
    mocks.mockDbSelectLimit.mockResolvedValue([testDocument]);

    // Extraction run lifecycle
    mocks.mockCreateExtractionRun.mockResolvedValue({ id: "run-001" });
    mocks.mockCompleteExtractionRun.mockResolvedValue(undefined);
    mocks.mockCreateFindingsBatch.mockResolvedValue(undefined);
    mocks.mockUpdateDocumentStatus.mockResolvedValue(undefined);
  });

  it("extracts metadata, wages, and clauses from HTML document", async () => {
    const { extractDocument } = await import("@/lib/services/cba-intelligence/extraction-orchestrator");

    const result = await extractDocument("doc-001");

    expect(result.documentId).toBe("doc-001");
    expect(result.errors).toHaveLength(0);

    // Check metadata extraction
    expect(result.agreement).toBeDefined();

    // Check wage extraction — should find 3.5% and 3.0%
    expect(result.wageAdjustments.length).toBeGreaterThanOrEqual(1);
    const pcts = result.wageAdjustments.map((w) => w.adjustmentPercent);
    expect(pcts).toContain(3.5);

    // Check clause classification — should find wages, benefits, grievance
    const families = result.clauses.map((c) => c.clauseFamily);
    expect(families).toContain("wages");

    // Findings persisted
    expect(mocks.mockCreateFindingsBatch).toHaveBeenCalled();
    const findings = mocks.mockCreateFindingsBatch.mock.calls[0][0];
    expect(findings.length).toBeGreaterThan(0);

    // Extraction confidence metrics emitted
    expect(mocks.mockMetricObserve).toHaveBeenCalled();
  });

  it("handles document-not-found gracefully", async () => {
    mocks.mockDbSelectLimit.mockResolvedValue([]);

    const { extractDocument } = await import("@/lib/services/cba-intelligence/extraction-orchestrator");

    await expect(extractDocument("nonexistent")).rejects.toThrow("Document not found");
  });

  it("handles document with no raw content", async () => {
    mocks.mockDbSelectLimit.mockResolvedValue([
      { ...testDocument, rawContent: null },
    ]);

    const { extractDocument } = await import("@/lib/services/cba-intelligence/extraction-orchestrator");

    await expect(extractDocument("doc-001")).rejects.toThrow("no raw content");
  });
});
