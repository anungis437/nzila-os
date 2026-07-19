import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as any[],
  insertQueue: [] as any[],
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockLoggerError: vi.fn(),
}));

function makeSelectChain(result: any) {
  const chain: Record<string, unknown> = {};
  const passthrough = ["from", "where", "limit", "orderBy", "offset"];
  for (const method of passthrough) {
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
  cbaIntelSources: {
    id: "id",
    isActive: "is_active",
    nameEn: "name_en",
    slug: "slug",
    lastSuccessAt: "last_success_at",
    lastCheckedAt: "last_checked_at",
    expectedUpdateDays: "expected_update_days",
  },
  cbaIntelDocuments: {
    sourceId: "source_id",
    lastSeenAt: "last_seen_at",
  },
  cbaIntelFreshnessLog: {
    sourceId: "source_id",
    checkedAt: "checked_at",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    lt: vi.fn(() => ({})),
    desc: vi.fn(() => ({})),
  };
});

describe("freshness-service DB functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));

    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;

    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsertReturning.mockImplementation(() => Promise.resolve(mocks.insertQueue.shift() ?? []));
    mocks.mockInsertValues.mockImplementation(() => ({ returning: mocks.mockInsertReturning }));
    mocks.mockInsert.mockImplementation(() => ({ values: mocks.mockInsertValues }));
  });

  it("computeSourceFreshness returns derived freshness and counts", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "src-1",
          slug: "fslrb",
          nameEn: "FSLRB",
          lastSuccessAt: new Date("2026-05-20T00:00:00.000Z"),
          lastCheckedAt: new Date("2026-05-31T00:00:00.000Z"),
          expectedUpdateDays: 14,
        },
      ],
      [{ totalDocs: 8 }],
      [{ staleDocs: 2 }],
    );

    const { computeSourceFreshness } = await import("../freshness-service");
    const result = await computeSourceFreshness("src-1");

    expect(result).toMatchObject({
      sourceId: "src-1",
      sourceSlug: "fslrb",
      sourceName: "FSLRB",
      daysSinceLastSuccess: 12,
      freshnessStatus: "fresh",
      documentCount: 8,
      staleDocumentCount: 2,
      expectedUpdateDays: 14,
    });
  });

  it("computeSourceFreshness falls back to slug when nameEn is missing", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "src-1",
          slug: "slug-only",
          nameEn: null,
          lastSuccessAt: new Date("2026-05-25T00:00:00.000Z"),
          lastCheckedAt: null,
          expectedUpdateDays: 14,
        },
      ],
      [{ totalDocs: 1 }],
      [{ staleDocs: 0 }],
    );

    const { computeSourceFreshness } = await import("../freshness-service");
    const result = await computeSourceFreshness("src-1");

    expect(result.sourceName).toBe("slug-only");
  });

  it("computeSourceFreshness throws for missing source", async () => {
    mocks.selectQueue.push([]);

    const { computeSourceFreshness } = await import("../freshness-service");
    await expect(computeSourceFreshness("missing")).rejects.toThrow("Source not found: missing");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });

  it("getFreshnessOverview aggregates statuses across active sources", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "src-1",
          slug: "alpha",
          nameEn: "Alpha",
          lastSuccessAt: new Date("2026-05-30T00:00:00.000Z"),
          lastCheckedAt: null,
          expectedUpdateDays: 7,
        },
        {
          id: "src-2",
          slug: "beta",
          nameEn: "Beta",
          lastSuccessAt: null,
          lastCheckedAt: null,
          expectedUpdateDays: 30,
        },
      ],
      [
        {
          id: "src-1",
          slug: "alpha",
          nameEn: "Alpha",
          lastSuccessAt: new Date("2026-05-30T00:00:00.000Z"),
          lastCheckedAt: null,
          expectedUpdateDays: 7,
        },
      ],
      [{ totalDocs: 3 }],
      [{ staleDocs: 0 }],
      [
        {
          id: "src-2",
          slug: "beta",
          nameEn: "Beta",
          lastSuccessAt: null,
          lastCheckedAt: null,
          expectedUpdateDays: 30,
        },
      ],
      [{ totalDocs: 4 }],
      [{ staleDocs: 1 }],
    );

    const { getFreshnessOverview } = await import("../freshness-service");
    const overview = await getFreshnessOverview();

    expect(overview.summary).toEqual({
      fresh: 1,
      aging: 0,
      stale: 0,
      expired: 0,
      unknown: 1,
      total: 2,
    });
    expect(overview.sources).toHaveLength(2);
  });

  it("getFreshnessOverview propagates DB failures", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db down");
    });

    const { getFreshnessOverview } = await import("../freshness-service");
    await expect(getFreshnessOverview()).rejects.toThrow("Failed to compute freshness overview");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });

  it("logFreshnessCheck writes normalized freshness snapshot", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "src-1",
          slug: "alpha",
          nameEn: "Alpha",
          lastSuccessAt: new Date("2026-04-15T00:00:00.000Z"),
          lastCheckedAt: null,
          expectedUpdateDays: 30,
        },
      ],
      [{ totalDocs: 6 }],
      [{ staleDocs: 3 }],
    );
    mocks.insertQueue.push([
      {
        id: "fresh-log-1",
        sourceId: "src-1",
      },
    ]);

    const { logFreshnessCheck } = await import("../freshness-service");
    const entry = await logFreshnessCheck("src-1", { agingDays: 30, staleDays: 20, expiredDays: 10 });

    expect(entry).toMatchObject({ id: "fresh-log-1", sourceId: "src-1" });
    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "src-1",
        documentCount: 6,
        staleDocumentCount: 3,
        freshnessStatus: "expired",
      }),
    );
  });

  it("computeSourceFreshness wraps non-Error failures", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw "boom";
    });

    const { computeSourceFreshness } = await import("../freshness-service");
    await expect(computeSourceFreshness("src-1")).rejects.toThrow("Failed to compute freshness");
  });

  it("computeFreshnessStatus covers stale and aging buckets with invalid thresholds", async () => {
    const { computeFreshnessStatus } = await import("../freshness-service");

    const invalidThresholds = { agingDays: 0, staleDays: -1, expiredDays: 0 };
    expect(computeFreshnessStatus(20, invalidThresholds)).toBe("aging");
    expect(computeFreshnessStatus(40, invalidThresholds)).toBe("stale");
  });

  it("logFreshnessCheck surfaces write failures", async () => {
    mocks.selectQueue.push(
      [
        {
          id: "src-1",
          slug: "alpha",
          nameEn: "Alpha",
          lastSuccessAt: new Date("2026-05-31T00:00:00.000Z"),
          lastCheckedAt: null,
          expectedUpdateDays: 30,
        },
      ],
      [{ totalDocs: 1 }],
      [{ staleDocs: 0 }],
    );
    mocks.mockInsertValues.mockImplementationOnce(() => {
      throw new Error("insert failed");
    });

    const { logFreshnessCheck } = await import("../freshness-service");
    await expect(logFreshnessCheck("src-1")).rejects.toThrow("Failed to log freshness check");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });

  it("getFreshnessHistory returns paginated history", async () => {
    mocks.selectQueue.push(
      [{ count: 42 }],
      [
        { id: "h1", sourceId: "src-1" },
        { id: "h2", sourceId: "src-1" },
      ],
    );

    const { getFreshnessHistory } = await import("../freshness-service");
    const result = await getFreshnessHistory("src-1", { page: 2, limit: 10 });

    expect(result).toEqual({
      items: [
        { id: "h1", sourceId: "src-1" },
        { id: "h2", sourceId: "src-1" },
      ],
      total: 42,
      page: 2,
      limit: 10,
    });
  });

  it("getFreshnessHistory caps page size at 100", async () => {
    mocks.selectQueue.push([{ count: 0 }], []);

    const { getFreshnessHistory } = await import("../freshness-service");
    const result = await getFreshnessHistory("src-1", { limit: 999 });

    expect(result.limit).toBe(100);
  });

  it("getFreshnessHistory surfaces DB errors", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("query failed");
    });

    const { getFreshnessHistory } = await import("../freshness-service");
    await expect(getFreshnessHistory("src-1")).rejects.toThrow("Failed to fetch freshness history");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });
});
