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
  cbaIntelDocuments: {
    id: "id",
    sourceId: "source_id",
    sourceUrl: "source_url",
    documentType: "document_type",
    processingStatus: "processing_status",
    jurisdiction: "jurisdiction",
    language: "language",
    isLatest: "is_latest",
    createdAt: "created_at",
  },
  documentTypeEnum: { enumValues: ["cba"] },
  documentProcessingStatusEnum: { enumValues: ["pending", "processed", "failed"] },
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

describe("document-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;
    mocks.updateQueue.length = 0;
    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsert.mockImplementation(() => makeInsertChain(mocks.insertQueue.shift() ?? []));
    mocks.mockUpdate.mockImplementation(() => makeUpdateChain(mocks.updateQueue.shift() ?? []));
  });

  it("computes stable sha256 content hash", async () => {
    const { computeContentHash } = await import("../document-service");
    expect(computeContentHash("hello")).toBe(computeContentHash("hello"));
    expect(computeContentHash("hello")).not.toBe(computeContentHash("world"));
  });

  it("lists and fetches documents", async () => {
    mocks.selectQueue.push([{ count: 1 }], [{ id: "d1" }], [{ id: "d1" }]);
    const { listDocuments, getDocumentById } = await import("../document-service");
    await expect(
      listDocuments(
        {
          sourceId: "s1",
          documentType: "cba",
          processingStatus: "pending",
          jurisdiction: "federal",
          language: "en",
          isLatest: true,
        },
        { limit: 500 },
      ),
    ).resolves.toEqual({ items: [{ id: "d1" }], total: 1, page: 1, limit: 100 });
    await expect(getDocumentById("d1")).resolves.toEqual({ id: "d1" });
    mocks.selectQueue.push([]);
    await expect(getDocumentById("missing")).resolves.toBeNull();
  });

  it("upserts unchanged document by updating timestamps", async () => {
    const hash = "h1";
    mocks.selectQueue.push([{ id: "d1", contentHash: hash, version: 1 }]);
    mocks.updateQueue.push([{ id: "d1", contentHash: hash, version: 1 }]);
    const { upsertDocument } = await import("../document-service");
    const result = await upsertDocument({ sourceId: "s1", sourceUrl: "u", rawContent: "x", contentHash: hash } as never);
    expect(result.action).toBe("unchanged");
  });

  it("upserts changed document by creating new version", async () => {
    mocks.selectQueue.push([{ id: "d1", contentHash: "old", version: 2 }]);
    mocks.updateQueue.push([]);
    mocks.insertQueue.push([{ id: "d2", previousVersionId: "d1", version: 3 }]);
    const { upsertDocument } = await import("../document-service");
    const result = await upsertDocument({ sourceId: "s1", sourceUrl: "u", rawContent: "new" } as never);
    expect(result.action).toBe("updated");
    expect(result.document.previousVersionId).toBe("d1");
  });

  it("upserts new document when none exists", async () => {
    mocks.selectQueue.push([]);
    mocks.insertQueue.push([{ id: "d3", version: 1 }]);
    const { upsertDocument } = await import("../document-service");
    const result = await upsertDocument({ sourceId: "s1", sourceUrl: "u2", rawContent: "content" } as never);
    expect(result.action).toBe("created");
    expect(result.document.id).toBe("d3");
  });

  it("upsert handles empty rawContent fallback hashing", async () => {
    mocks.selectQueue.push([]);
    mocks.insertQueue.push([{ id: "d4", version: 1 }]);
    const { upsertDocument } = await import("../document-service");
    const result = await upsertDocument({ sourceId: "s1", sourceUrl: "u3" } as never);
    expect(result.action).toBe("created");
  });

  it("updates document status", async () => {
    mocks.updateQueue.push([{ id: "d1", processingStatus: "processed" }], []);
    const { updateDocumentStatus } = await import("../document-service");
    await expect(updateDocumentStatus("d1", "processed", { wordCount: 5 })).resolves.toMatchObject({
      processingStatus: "processed",
    });
    await expect(updateDocumentStatus("missing", "failed")).resolves.toBeNull();
  });

  it("wraps list/get/status update errors", async () => {
    const { listDocuments, getDocumentById, updateDocumentStatus } = await import("../document-service");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(listDocuments()).rejects.toThrow("Failed to list CBA intelligence documents");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await expect(getDocumentById("x")).rejects.toThrow("Failed to get CBA intelligence document");

    mocks.mockUpdate.mockImplementationOnce(() => {
      throw new Error("update fail");
    });
    await expect(updateDocumentStatus("x", "failed")).rejects.toThrow("Failed to update document status");
  });

  it("wraps errors", async () => {
    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    const { upsertDocument } = await import("../document-service");
    await expect(upsertDocument({ sourceId: "s1", sourceUrl: "u", rawContent: "x" } as never)).rejects.toThrow(
      "Failed to upsert CBA intelligence document",
    );
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });
});
