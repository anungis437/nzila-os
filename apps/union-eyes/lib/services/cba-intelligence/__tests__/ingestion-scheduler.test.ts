import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as unknown[],
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  metricSet: vi.fn(),
  runFullIngestion: vi.fn(),
  runBulkExtraction: vi.fn(),
  computeFreshnessStatus: vi.fn(),
}));

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return chain;
}

vi.mock("@/db/db", () => ({
  db: {
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
  },
}));

vi.mock("@/db/schema", () => ({
  cbaIntelSources: { id: "id", name: "name", slug: "slug", isActive: "is_active" },
  cbaIntelIngestionJobs: {
    sourceId: "source_id",
    status: "status",
    createdAt: "created_at",
    completedAt: "completed_at",
    documentsFound: "documents_found",
  },
  cbaIntelFreshnessLog: { sourceId: "source_id" },
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})), desc: vi.fn(() => ({})) }));

vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError, debug: vi.fn() },
}));

vi.mock("@/lib/observability/metrics", () => ({
  cbaIntelSourceFreshness: { set: mocks.metricSet },
}));

vi.mock("../ingestion-orchestrator", () => ({ runFullIngestion: mocks.runFullIngestion }));
vi.mock("../extraction-orchestrator", () => ({ runBulkExtraction: mocks.runBulkExtraction }));
vi.mock("../freshness-service", () => ({ computeFreshnessStatus: mocks.computeFreshnessStatus }));

describe("ingestion-scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.dbSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.dbInsert.mockImplementation(() => ({ values: vi.fn(() => Promise.resolve()) }));
    mocks.runFullIngestion.mockResolvedValue({
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:01:00.000Z",
      totalSources: 1,
      sourcesSucceeded: 1,
      sourcesFailed: 0,
      totalDocumentsIngested: 0,
      results: [],
    });
    mocks.runBulkExtraction.mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 });
    mocks.computeFreshnessStatus.mockReturnValue("fresh");
  });

  it("computes source schedules with backoff and due logic", async () => {
    const now = Date.now();
    mocks.selectQueue.push(
      [
        { id: "s1", name: "Source 1" },
        { id: "s2", name: "Source 2" },
      ],
      [{ completedAt: new Date(now - 20_000).toISOString() }],
      [{ status: "failed" }, { status: "failed" }, { status: "completed" }],
      [],
      [],
    );

    const mod = await import("../ingestion-scheduler");
    const schedules = await mod.__test__.getSourceSchedules({
      defaultIntervalMs: 1_000,
      maxBackoffMs: 8_000,
      runExtractionAfter: true,
      updateFreshness: true,
    });

    expect(schedules).toHaveLength(2);
    expect(schedules[0]).toMatchObject({ sourceId: "s1", consecutiveFailures: 2, isDue: true });
    expect(schedules[1]).toMatchObject({ sourceId: "s2", consecutiveFailures: 0, isDue: true });

    expect(mod.__test__.getDefaultSchedule()).toMatchObject({
      defaultIntervalMs: 24 * 60 * 60 * 1000,
      maxBackoffMs: 7 * 24 * 60 * 60 * 1000,
      runExtractionAfter: true,
      updateFreshness: true,
    });
  });

  it("skips when a run is already in progress", async () => {
    const mod = await import("../ingestion-scheduler");
    mod.__test__.setRunning(true);

    const result = await mod.runScheduledIngestion();
    expect(result.skippedReason).toBe("Already running");

    mod.__test__.setRunning(false);
  });

  it("returns skipped when no sources are due", async () => {
    mocks.selectQueue.push(
      [{ id: "s1", name: "Source 1" }],
      [{ completedAt: new Date().toISOString() }],
      [{ status: "completed" }],
    );

    const mod = await import("../ingestion-scheduler");
    const result = await mod.runScheduledIngestion({ defaultIntervalMs: 24 * 60 * 60 * 1000 });

    expect(result.skippedReason).toBe("No sources due for ingestion");
    expect(mocks.runFullIngestion).not.toHaveBeenCalled();
  });

  it("runs ingestion, extraction and freshness updates", async () => {
    mocks.selectQueue.push(
      [{ id: "s1", name: "Source 1" }],
      [],
      [],
      [{ id: "s1", slug: "source-1" }],
      [{ completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), documentsFound: 5 }],
    );
    mocks.runFullIngestion.mockResolvedValue({
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:01:00.000Z",
      totalSources: 1,
      sourcesSucceeded: 1,
      sourcesFailed: 0,
      totalDocumentsIngested: 3,
      results: [],
    });
    mocks.runBulkExtraction.mockResolvedValue({ processed: 2, succeeded: 2, failed: 0 });
    mocks.computeFreshnessStatus.mockReturnValue("aging");

    const mod = await import("../ingestion-scheduler");
    const result = await mod.runScheduledIngestion();

    expect(result.ingestion?.totalDocumentsIngested).toBe(3);
    expect(result.extraction).toEqual({ processed: 2, succeeded: 2, failed: 0 });
    expect(result.freshnessUpdate).toBe(true);
    expect(mocks.metricSet).toHaveBeenCalled();
  });

  it("continues when freshness update fails", async () => {
    mocks.selectQueue.push(
      [{ id: "s1", name: "Source 1" }],
      [],
      [],
      [{ id: "s1", slug: null }],
      [{ completedAt: new Date().toISOString(), documentsFound: 1 }],
    );
    mocks.dbInsert.mockImplementation(() => ({ values: vi.fn(() => Promise.reject(new Error("insert failed"))) }));

    const mod = await import("../ingestion-scheduler");
    const result = await mod.runScheduledIngestion();

    expect(result.freshnessUpdate).toBe(false);
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("rethrows fatal scheduler failures and resets state", async () => {
    mocks.selectQueue.push([{ id: "s1", name: "Source 1" }], [], []);
    mocks.runFullIngestion.mockRejectedValue(new Error("ingestion crashed"));

    const mod = await import("../ingestion-scheduler");
    await expect(mod.runScheduledIngestion()).rejects.toThrow("ingestion crashed");
    expect(mod.isIngestionInProgress()).toBe(false);
  });

  it("supports disabled freshness updates", async () => {
    mocks.selectQueue.push([{ id: "s1", name: "Source 1" }], [], []);

    const mod = await import("../ingestion-scheduler");
    const result = await mod.runScheduledIngestion({ updateFreshness: false, runExtractionAfter: false });
    expect(result.freshnessUpdate).toBe(false);
  });

  it("logs and rethrows non-Error fatal failures", async () => {
    mocks.selectQueue.push([{ id: "s1", name: "Source 1" }], [], []);
    mocks.runFullIngestion.mockRejectedValue("boom");

    const mod = await import("../ingestion-scheduler");
    await expect(mod.runScheduledIngestion()).rejects.toBe("boom");
    expect(mocks.loggerError).toHaveBeenCalledWith("Scheduled ingestion: failed", { error: "boom" });
  });

  it("updates freshness logs across status variants", async () => {
    const now = new Date().toISOString();
    mocks.selectQueue.push(
      [
        { id: "s1", slug: "a" },
        { id: "s2", slug: null },
        { id: "s3", slug: "c" },
        { id: "s4", slug: "d" },
        { id: "s5", slug: "e" },
      ],
      [{ completedAt: now, documentsFound: 3 }],
      [{ completedAt: now, documentsFound: undefined }],
      [{ completedAt: now, documentsFound: 1 }],
      [{ completedAt: now, documentsFound: 2 }],
      [],
    );
    mocks.computeFreshnessStatus
      .mockReturnValueOnce("fresh")
      .mockReturnValueOnce("stale")
      .mockReturnValueOnce("expired")
      .mockReturnValueOnce("unknown");

    const mod = await import("../ingestion-scheduler");
    await mod.__test__.updateFreshnessLogs();

    expect(mocks.metricSet).toHaveBeenCalledWith({ source_slug: "a" }, 1);
    expect(mocks.metricSet).toHaveBeenCalledWith({ source_slug: "s2" }, 3);
    expect(mocks.metricSet).toHaveBeenCalledWith({ source_slug: "c" }, 4);
    expect(mocks.metricSet).toHaveBeenCalledWith({ source_slug: "d" }, 0);
  });

  it("starts and stops timer scheduler", async () => {
    vi.useFakeTimers();
    mocks.selectQueue.push([]);

    const mod = await import("../ingestion-scheduler");
    mod.startScheduler({ defaultIntervalMs: 5_000 });
    expect(mod.isSchedulerRunning()).toBe(true);

    mod.stopScheduler();
    expect(mod.isSchedulerRunning()).toBe(false);
    vi.useRealTimers();
  });

  it("logs failed initial and interval runs and handles restart", async () => {
    vi.useFakeTimers();
    mocks.dbSelect.mockImplementation(() => {
      throw new Error("db exploded");
    });

    const mod = await import("../ingestion-scheduler");
    mod.startScheduler({ defaultIntervalMs: 100 });
    mod.startScheduler({ defaultIntervalMs: 100 });

    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(120);
    await vi.runAllTicks();

    expect(mocks.loggerWarn).toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith("Initial scheduled run failed", expect.any(Object));
    expect(mocks.loggerError).toHaveBeenCalledWith("Scheduled run failed", expect.any(Object));

    mod.stopScheduler();
    vi.useRealTimers();
  });

  it("allows stopScheduler when no timer exists", async () => {
    const mod = await import("../ingestion-scheduler");
    mod.stopScheduler();
    expect(mod.isSchedulerRunning()).toBe(false);
  });
});
