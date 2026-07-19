import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSources: vi.fn(),
  updateSourceHealth: vi.fn(),
  createIngestionJob: vi.fn(),
  startIngestionJob: vi.fn(),
  completeIngestionJob: vi.fn(),
  failIngestionJob: vi.fn(),
  upsertDocument: vi.fn(),
  computeContentHash: vi.fn(),
  getAdapter: vi.fn(),
  getRegisteredAdapterKeys: vi.fn(),
  metricInc: vi.fn(),
  metricObserve: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError, debug: vi.fn() },
}));

vi.mock("@/lib/observability/metrics", () => ({
  cbaIntelIngestionJobsTotal: { inc: mocks.metricInc },
  cbaIntelIngestionDuration: { observe: mocks.metricObserve },
  cbaIntelDocumentsIngested: { inc: mocks.metricInc },
}));

vi.mock("@/lib/services/cba-intelligence/source-registry-service", () => ({
  listSources: mocks.listSources,
  updateSourceHealth: mocks.updateSourceHealth,
}));

vi.mock("@/lib/services/cba-intelligence/ingestion-service", () => ({
  createIngestionJob: mocks.createIngestionJob,
  startIngestionJob: mocks.startIngestionJob,
  completeIngestionJob: mocks.completeIngestionJob,
  failIngestionJob: mocks.failIngestionJob,
}));

vi.mock("@/lib/services/cba-intelligence/document-service", () => ({
  upsertDocument: mocks.upsertDocument,
  computeContentHash: mocks.computeContentHash,
}));

vi.mock("@/lib/services/cba-intelligence/adapters", () => ({
  getAdapter: mocks.getAdapter,
  getRegisteredAdapterKeys: mocks.getRegisteredAdapterKeys,
}));

describe("ingestion-orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CBA_INTEL_SOURCE_CONCURRENCY;
    delete process.env.CBA_INTEL_DOCUMENT_CONCURRENCY;
    delete process.env.CBA_INTEL_FETCH_TIMEOUT_MS;
    delete process.env.CBA_INTEL_FETCH_RETRIES;

    mocks.listSources.mockResolvedValue({ items: [] });
    mocks.updateSourceHealth.mockResolvedValue(undefined);
    mocks.createIngestionJob.mockResolvedValue({ id: "job-1" });
    mocks.startIngestionJob.mockResolvedValue({ id: "job-1", status: "running" });
    mocks.completeIngestionJob.mockResolvedValue(undefined);
    mocks.failIngestionJob.mockResolvedValue(undefined);
    mocks.upsertDocument.mockResolvedValue({ action: "created" });
    mocks.computeContentHash.mockReturnValue("hash");
    mocks.getAdapter.mockReturnValue({
      discover: vi.fn().mockResolvedValue([]),
      fetch: vi.fn(),
    });
    mocks.getRegisteredAdapterKeys.mockReturnValue(["adapter-1"]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("covers helper utilities through __test__", async () => {
    const mod = await import("../ingestion-orchestrator");
    expect(mod.__test__.parsePositiveInt(undefined, 3)).toBe(3);
    expect(mod.__test__.parsePositiveInt("0", 3)).toBe(3);
    expect(mod.__test__.parsePositiveInt("5", 3)).toBe(5);

    process.env.CBA_INTEL_SOURCE_CONCURRENCY = "2";
    process.env.CBA_INTEL_DOCUMENT_CONCURRENCY = "3";
    process.env.CBA_INTEL_FETCH_TIMEOUT_MS = "4000";
    process.env.CBA_INTEL_FETCH_RETRIES = "4";
    expect(mod.__test__.getIngestionTuning()).toEqual({
      sourceConcurrency: 2,
      documentConcurrency: 3,
      fetchTimeoutMs: 4000,
      fetchRetries: 4,
    });

    await expect(mod.__test__.runWithConcurrency([], 2, async (v: number) => v)).resolves.toEqual([]);
    await expect(mod.__test__.runWithConcurrency([1, 2, 3], 2, async (v: number) => v * 2)).resolves.toEqual([2, 4, 6]);

    vi.useRealTimers();
    await expect(mod.__test__.withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
  });

  it("returns empty full run when no eligible sources exist", async () => {
    mocks.listSources.mockResolvedValue({ items: [{ id: "s1", adapterKey: null, isActive: true, name: "Source 1" }] });
    mocks.getRegisteredAdapterKeys.mockReturnValue(["adapter-1"]);
    const { runFullIngestion } = await import("../ingestion-orchestrator");
    const result = await runFullIngestion();
    expect(result.totalSources).toBe(0);
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });

  it("handles start failure and source-level adapter failures", async () => {
    mocks.listSources.mockResolvedValue({
      items: [
        { id: "s1", adapterKey: "adapter-1", isActive: true, name: "Source 1", config: {}, jurisdictions: ["CA-FED"], sourceType: "federal" },
        { id: "s2", adapterKey: "adapter-1", isActive: true, name: "Source 2", config: {}, jurisdictions: ["CA-FED"], sourceType: "federal" },
      ],
    });
    mocks.startIngestionJob
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "job-2", status: "running" });
    mocks.createIngestionJob
      .mockResolvedValueOnce({ id: "job-1" })
      .mockResolvedValueOnce({ id: "job-2" });
    mocks.getAdapter.mockReturnValue({
      discover: vi.fn().mockRejectedValue(new Error("adapter blew up")),
      fetch: vi.fn(),
    });

    const { runFullIngestion } = await import("../ingestion-orchestrator");
    const result = await runFullIngestion();
    expect(result.sourcesFailed).toBe(2);
    expect(mocks.failIngestionJob).toHaveBeenCalled();
    expect(mocks.updateSourceHealth).toHaveBeenCalledWith("s2", false);
  });

  it("ingests documents through created/updated/unchanged/failed paths", async () => {
    process.env.CBA_INTEL_FETCH_RETRIES = "1";
    mocks.listSources.mockResolvedValue({
      items: [
        { id: "s1", adapterKey: "adapter-1", isActive: true, name: "Source 1", config: {}, jurisdictions: ["CA-FED"], sourceType: null },
      ],
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ rawContent: "one", wordCount: 1, pageCount: 1 })
      .mockResolvedValueOnce({ rawContent: "two", wordCount: 2, pageCount: 2 })
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce("fetch failed");
    mocks.getAdapter.mockReturnValue({
      discover: vi.fn().mockResolvedValue([
        { sourceUrl: "u1", title: "Doc 1", documentType: undefined, language: undefined, jurisdiction: undefined },
        { sourceUrl: "u2", title: "Doc 2", documentType: "full_agreement", language: "fr", jurisdiction: "CA-QC" },
        { sourceUrl: "u3", title: null, documentType: "full_agreement", language: "en", jurisdiction: null },
        { sourceUrl: "u4", title: "Doc 4", documentType: "full_agreement", language: "en", jurisdiction: null },
      ]),
      fetch,
    });
    mocks.upsertDocument
      .mockResolvedValueOnce({ action: "created" })
      .mockResolvedValueOnce({ action: "updated" })
      .mockResolvedValueOnce({ action: "unchanged" });

    const { runFullIngestion } = await import("../ingestion-orchestrator");
    const result = await runFullIngestion();
    expect(result.sourcesSucceeded).toBe(1);
    expect(result.results[0]).toMatchObject({
      documentsFound: 4,
      documentsNew: 1,
      documentsUpdated: 1,
      documentsUnchanged: 0,
      documentsFailed: 2,
      status: "completed_with_errors",
    });
    expect(mocks.completeIngestionJob).toHaveBeenCalled();
    expect(mocks.metricInc).toHaveBeenCalled();
    expect(mocks.metricObserve).toHaveBeenCalled();
  });

  it("throws for missing or inactive sources in runSourceIngestion", async () => {
    mocks.listSources.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [{ id: "s1", isActive: false, name: "Source 1" }] });
    const { runSourceIngestion } = await import("../ingestion-orchestrator");
    await expect(runSourceIngestion("missing")).rejects.toThrow("Source not found: missing");
    await expect(runSourceIngestion("s1")).rejects.toThrow("Source is inactive: Source 1");
  });

  it("runs active single-source ingestion successfully", async () => {
    mocks.listSources.mockResolvedValue({
      items: [{ id: "s1", adapterKey: "adapter-1", isActive: true, name: "Source 1", config: {}, jurisdictions: [], sourceType: "federal" }],
    });
    mocks.getAdapter.mockReturnValue({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u1", title: "Doc", documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockResolvedValue({ rawContent: "one", wordCount: 1, pageCount: 1 }),
    });
    mocks.upsertDocument.mockResolvedValue({ action: "unchanged" });
    const { runSourceIngestion } = await import("../ingestion-orchestrator");
    const result = await runSourceIngestion("s1");
    expect(result).toMatchObject({ documentsUnchanged: 1, status: "completed" });
  });

  it("covers ingestSource failure branches directly via __test__", async () => {
    const mod = await import("../ingestion-orchestrator");

    mocks.createIngestionJob.mockResolvedValue({ id: "job-x" });
    mocks.startIngestionJob.mockResolvedValue({ id: "job-x", status: "running" });

    const sourceBase = {
      id: "s-base",
      name: "Source Base",
      config: {},
      jurisdictions: [],
      sourceType: undefined,
      isActive: true,
    };

    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-no-key", name: "No Key", adapterKey: null } as never)).resolves.toMatchObject({
      status: "failed",
      errors: ["Source has no adapter key: s-no-key"],
    });

    mocks.getAdapter.mockReturnValueOnce(null);
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-no-adapter", name: "No Adapter", adapterKey: "missing" } as never)).resolves.toMatchObject({
      status: "failed",
      errors: ["No adapter registered for key: missing"],
    });

    process.env.CBA_INTEL_FETCH_RETRIES = "2";
    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u1", title: null, documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockRejectedValueOnce(new Error("retry me")).mockResolvedValueOnce({ rawContent: "ok", wordCount: undefined, pageCount: undefined }),
    });
    mocks.upsertDocument.mockResolvedValueOnce({ action: "unchanged" });
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-retry", name: "Retry", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      documentsUnchanged: 1,
      status: "completed",
    });

    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u2", title: null, documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockResolvedValue(undefined),
    });
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-null-fetch", name: "Null Fetch", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      documentsFailed: 1,
      status: "completed_with_errors",
    });

    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u6", title: null, documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockResolvedValue({ rawContent: "ok", wordCount: 1, pageCount: 1 }),
    });
    mocks.upsertDocument.mockRejectedValueOnce("persist boom");
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-persist-string", name: "Persist String", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      documentsFailed: 1,
      status: "completed_with_errors",
    });

    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u3", title: null, documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockRejectedValue(new Error("hard fail")),
    });
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-error-fetch", name: "Error Fetch", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      documentsFailed: 1,
      status: "completed_with_errors",
    });

    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u4", title: null, documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockRejectedValueOnce(new Error("first fail")).mockResolvedValueOnce(undefined),
    });
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-error-then-null", name: "Error Then Null", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      documentsFailed: 1,
      status: "completed_with_errors",
    });

    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockResolvedValue([{ sourceUrl: "u5", title: null, documentType: undefined, language: undefined, jurisdiction: undefined }]),
      fetch: vi.fn().mockRejectedValueOnce("first fail").mockResolvedValueOnce(undefined),
    });
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-string-then-null", name: "String Then Null", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      documentsFailed: 1,
      status: "completed_with_errors",
    });

    mocks.getAdapter.mockReturnValueOnce({
      discover: vi.fn().mockRejectedValueOnce("boom"),
      fetch: vi.fn(),
    });
    await expect(mod.__test__.ingestSource({ ...sourceBase, id: "s-err", name: "Err", adapterKey: "adapter-1", config: null } as never)).resolves.toMatchObject({
      status: "failed",
      errors: ["boom"],
    });
  });

  it("captures non-Error source-level failures in runFullIngestion", async () => {
    mocks.listSources.mockResolvedValue({
      items: [{ id: "s1", adapterKey: "adapter-1", isActive: true, name: "Source 1", config: {}, jurisdictions: [], sourceType: "federal" }],
    });
    mocks.createIngestionJob.mockImplementationOnce(() => {
      throw "boom";
    });
    const { runFullIngestion } = await import("../ingestion-orchestrator");
    const result = await runFullIngestion();
    expect(result.sourcesFailed).toBe(1);
    expect(result.results[0].errors).toEqual(["boom"]);
  });

  it("captures Error source-level failures in runFullIngestion", async () => {
    mocks.listSources.mockResolvedValue({
      items: [{ id: "s1", adapterKey: "adapter-1", isActive: true, name: "Source 1", config: {}, jurisdictions: [], sourceType: "federal" }],
    });
    mocks.createIngestionJob.mockImplementationOnce(() => {
      throw new Error("kaput");
    });
    const { runFullIngestion } = await import("../ingestion-orchestrator");
    const result = await runFullIngestion();
    expect(result.sourcesFailed).toBe(1);
    expect(result.results[0].errors).toEqual(["kaput"]);
  });
});
