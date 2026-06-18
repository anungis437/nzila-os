import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as any[],
  insertQueue: [] as any[],
  updateQueue: [] as any[],
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
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

vi.mock("@/db/db", () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}));

vi.mock("@/db/schema", () => ({
  cbaIntelSources: {
    id: "id",
    slug: "slug",
    sourceType: "source_type",
    trustTier: "trust_tier",
    healthStatus: "health_status",
    isActive: "is_active",
    createdAt: "created_at",
    consecutiveFailures: "consecutive_failures",
  },
  sourceTypeEnum: { enumValues: ["federal_labour"] },
  trustTierEnum: { enumValues: ["official"] },
  sourceHealthEnum: { enumValues: ["healthy", "degraded", "unreachable", "unknown"] },
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
    desc: vi.fn(() => ({})),
  };
});

describe("source-registry-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;
    mocks.updateQueue.length = 0;
    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsert.mockImplementation(() => makeInsertChain(mocks.insertQueue.shift() ?? []));
    mocks.mockUpdate.mockImplementation(() => makeUpdateChain(mocks.updateQueue.shift() ?? []));
  });

  it("lists sources with pagination and filters", async () => {
    mocks.selectQueue.push([{ count: 2 }], [{ id: "s1" }, { id: "s2" }]);
    const { listSources } = await import("../source-registry-service");
    const result = await listSources(
      {
        sourceType: "federal_labour",
        trustTier: "official",
        healthStatus: "healthy",
        isActive: true,
      },
      { page: 2, limit: 200 },
    );
    expect(result).toEqual({ items: [{ id: "s1" }, { id: "s2" }], total: 2, page: 2, limit: 100 });
  });

  it("get by id and slug return null when not found", async () => {
    mocks.selectQueue.push([], []);
    const { getSourceById, getSourceBySlug } = await import("../source-registry-service");
    await expect(getSourceById("missing")).resolves.toBeNull();
    await expect(getSourceBySlug("missing")).resolves.toBeNull();
  });

  it("creates and updates a source", async () => {
    mocks.insertQueue.push([{ id: "s1", slug: "fslrb" }]);
    mocks.updateQueue.push([{ id: "s1", slug: "fslrb", isActive: false }]);
    const { createSource, updateSource } = await import("../source-registry-service");
    const created = await createSource({ slug: "fslrb" } as never);
    const updated = await updateSource("s1", { isActive: false } as never);
    expect(created.id).toBe("s1");
    expect(updated?.isActive).toBe(false);
  });

  it("updateSource returns null when returning row is empty", async () => {
    mocks.updateQueue.push([]);
    const { updateSource } = await import("../source-registry-service");
    await expect(updateSource("missing", { isActive: false } as never)).resolves.toBeNull();
  });

  it("updates source health for healthy and degraded states", async () => {
    mocks.updateQueue.push([], []);
    const { updateSourceHealth } = await import("../source-registry-service");
    await expect(updateSourceHealth("s1", true)).resolves.toBeUndefined();
    await expect(updateSourceHealth("s1", false)).resolves.toBeUndefined();
  });

  it("wraps source health update errors", async () => {
    mocks.mockUpdate.mockImplementationOnce(() => {
      throw new Error("update fail");
    });
    const { updateSourceHealth } = await import("../source-registry-service");
    await expect(updateSourceHealth("s1", true)).rejects.toThrow("Failed to update source health");
  });

  it("deactivates source and returns bool by update presence", async () => {
    mocks.updateQueue.push([{ id: "s1" }], []);
    const { deactivateSource } = await import("../source-registry-service");
    await expect(deactivateSource("s1")).resolves.toBe(true);
    await expect(deactivateSource("missing")).resolves.toBe(false);
  });

  it("lists active sources for ingestion", async () => {
    mocks.selectQueue.push([{ id: "s1", slug: "fslrb" }]);
    const { getActiveSourcesForIngestion } = await import("../source-registry-service");
    await expect(getActiveSourcesForIngestion()).resolves.toEqual([{ id: "s1", slug: "fslrb" }]);
  });

  it("wraps errors consistently", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    const { listSources } = await import("../source-registry-service");
    await expect(listSources()).rejects.toThrow("Failed to list CBA intelligence sources");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });

  it("wraps errors for get/create/update/deactivate/active list", async () => {
    const {
      getSourceById,
      getSourceBySlug,
      createSource,
      updateSource,
      deactivateSource,
      getActiveSourcesForIngestion,
    } = await import("../source-registry-service");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getSourceById("x")).rejects.toThrow("Failed to get CBA intelligence source");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getSourceBySlug("x")).rejects.toThrow("Failed to get CBA intelligence source by slug");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createSource({ slug: "x" } as never)).rejects.toThrow("Failed to create CBA intelligence source");

    mocks.mockUpdate.mockImplementationOnce(() => {
      throw new Error("update fail");
    });
    await expect(updateSource("x", { isActive: true } as never)).rejects.toThrow("Failed to update CBA intelligence source");

    mocks.mockUpdate.mockImplementationOnce(() => {
      throw new Error("update fail");
    });
    await expect(deactivateSource("x")).rejects.toThrow("Failed to deactivate CBA intelligence source");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getActiveSourcesForIngestion()).rejects.toThrow("Failed to fetch active sources for ingestion");
  });
});
