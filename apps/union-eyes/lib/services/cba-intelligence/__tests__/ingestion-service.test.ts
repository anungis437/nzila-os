import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as any[],
  insertQueue: [] as any[],
  updateQueue: [] as any[],
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateSourceHealth: vi.fn(),
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
  cbaIntelIngestionJobs: {
    id: "id",
    sourceId: "source_id",
    status: "status",
    createdAt: "created_at",
  },
  ingestionStatusEnum: { enumValues: ["queued", "running", "completed", "failed"] },
}));

vi.mock("@/lib/services/cba-intelligence/source-registry-service", () => ({
  updateSourceHealth: mocks.mockUpdateSourceHealth,
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

describe("ingestion-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;
    mocks.updateQueue.length = 0;
    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsert.mockImplementation(() => makeInsertChain(mocks.insertQueue.shift() ?? []));
    mocks.mockUpdate.mockImplementation(() => makeUpdateChain(mocks.updateQueue.shift() ?? []));
  });

  it("lists and gets ingestion jobs", async () => {
    mocks.selectQueue.push([{ count: 1 }], [{ id: "j1" }], [{ id: "j1" }]);
    const { listIngestionJobs, getIngestionJobById } = await import("../ingestion-service");
    await expect(listIngestionJobs({ sourceId: "s1", status: "queued" }, { limit: 500 })).resolves.toEqual({
      items: [{ id: "j1" }],
      total: 1,
      page: 1,
      limit: 100,
    });
    await expect(getIngestionJobById("j1")).resolves.toEqual({ id: "j1" });
  });

  it("creates and starts jobs", async () => {
    mocks.insertQueue.push([{ id: "j1", sourceId: "s1" }]);
    mocks.updateQueue.push([{ id: "j1", status: "running" }], []);
    const { createIngestionJob, startIngestionJob } = await import("../ingestion-service");
    await expect(createIngestionJob({ sourceId: "s1" } as never)).resolves.toMatchObject({ id: "j1" });
    await expect(startIngestionJob("j1")).resolves.toMatchObject({ status: "running" });
    await expect(startIngestionJob("missing")).resolves.toBeNull();
  });

  it("completeIngestionJob handles missing job and completed status variants", async () => {
    mocks.selectQueue.push([], [{ id: "j1", sourceId: "s1", startedAt: new Date("2026-01-01T00:00:00.000Z") }]);
    mocks.updateQueue.push([{ id: "j1", sourceId: "s1", status: "completed_with_errors" }]);
    const { completeIngestionJob } = await import("../ingestion-service");
    await expect(completeIngestionJob("missing", { documentsFound: 1 })).resolves.toBeNull();
    await expect(completeIngestionJob("j1", { documentsFound: 1, documentsFailed: 2 })).resolves.toMatchObject({
      status: "completed_with_errors",
    });
    expect(mocks.mockUpdateSourceHealth).toHaveBeenCalledWith("s1", true);
  });

  it("completeIngestionJob handles non-error completion and null update result", async () => {
    mocks.selectQueue.push(
      [{ id: "j2", sourceId: "s2", startedAt: null }],
      [{ id: "j3", sourceId: "s3", startedAt: null }],
    );
    mocks.updateQueue.push([{ id: "j2", sourceId: "s2", status: "completed" }], []);
    const { completeIngestionJob } = await import("../ingestion-service");
    await expect(completeIngestionJob("j2", { documentsFound: 1, documentsFailed: 0 })).resolves.toMatchObject({
      status: "completed",
    });
    await expect(completeIngestionJob("j3", { documentsFound: 1 })).resolves.toBeNull();
  });

  it("failIngestionJob retries then fails terminally", async () => {
    mocks.selectQueue.push(
      [{ id: "j1", sourceId: "s1", startedAt: null, retryCount: 0, maxRetries: 2 }],
      [{ id: "j1", sourceId: "s1", startedAt: null, retryCount: 2, maxRetries: 2 }],
    );
    mocks.updateQueue.push(
      [{ id: "j1", sourceId: "s1", status: "queued" }],
      [{ id: "j1", sourceId: "s1", status: "failed" }],
    );
    const { failIngestionJob } = await import("../ingestion-service");
    await expect(failIngestionJob("j1", "boom", "network", { code: 500 })).resolves.toMatchObject({ status: "queued" });
    await expect(failIngestionJob("j1", "boom", "network")).resolves.toMatchObject({ status: "failed" });
    expect(mocks.mockUpdateSourceHealth).toHaveBeenCalledWith("s1", false);
  });

  it("cancelIngestionJob returns boolean", async () => {
    mocks.updateQueue.push([{ id: "j1" }], []);
    const { cancelIngestionJob } = await import("../ingestion-service");
    await expect(cancelIngestionJob("j1")).resolves.toBe(true);
    await expect(cancelIngestionJob("missing")).resolves.toBe(false);
  });

  it("returns null when failing a missing job", async () => {
    mocks.selectQueue.push([]);
    const { failIngestionJob } = await import("../ingestion-service");
    await expect(failIngestionJob("missing", "boom", "network")).resolves.toBeNull();
  });

  it("returns null when fail update returns no row", async () => {
    mocks.selectQueue.push([{ id: "j4", sourceId: "s4", startedAt: new Date("2026-01-01T00:00:00.000Z"), retryCount: 2, maxRetries: 2 }]);
    mocks.updateQueue.push([]);
    const { failIngestionJob } = await import("../ingestion-service");
    await expect(failIngestionJob("j4", "boom", "network")).resolves.toBeNull();
  });

  it("wraps errors for get/create/start/cancel", async () => {
    const {
      getIngestionJobById,
      createIngestionJob,
      startIngestionJob,
      cancelIngestionJob,
    } = await import("../ingestion-service");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getIngestionJobById("x")).rejects.toThrow("Failed to get ingestion job");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createIngestionJob({ sourceId: "s1" } as never)).rejects.toThrow("Failed to create ingestion job");

    mocks.mockUpdate.mockImplementationOnce(() => {
      throw new Error("update fail");
    });
    await expect(startIngestionJob("x")).rejects.toThrow("Failed to start ingestion job");

    mocks.mockUpdate.mockImplementationOnce(() => {
      throw new Error("update fail");
    });
    await expect(cancelIngestionJob("x")).rejects.toThrow("Failed to cancel ingestion job");
  });

  it("wraps errors for complete/fail operations", async () => {
    const { completeIngestionJob, failIngestionJob } = await import("../ingestion-service");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(completeIngestionJob("x", { documentsFound: 1 })).rejects.toThrow("Failed to complete ingestion job");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(failIngestionJob("x", "boom", "network")).rejects.toThrow("Failed to record ingestion job failure");
  });

  it("wraps errors", async () => {
    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    const { listIngestionJobs } = await import("../ingestion-service");
    await expect(listIngestionJobs()).rejects.toThrow("Failed to list ingestion jobs");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });
});
