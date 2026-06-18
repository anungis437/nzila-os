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

vi.mock("@/db/db", () => ({ db: { select: mocks.mockSelect, insert: mocks.mockInsert, update: mocks.mockUpdate } }));

vi.mock("@/db/schema", () => ({
  cbaIntelExtractionRuns: { id: "id", documentId: "document_id", status: "status", extractionMethod: "method", createdAt: "created_at" },
  cbaIntelFindings: {
    id: "id",
    documentId: "document_id",
    extractionRunId: "extraction_run_id",
    clauseFamily: "clause_family",
    findingType: "finding_type",
    reviewStatus: "review_status",
    confidence: "confidence",
    createdAt: "created_at",
  },
  cbaIntelAgreements: {
    id: "id",
    jurisdiction: "jurisdiction",
    sector: "sector",
    reviewStatus: "review_status",
    title: "title",
    employerNormalized: "employer_normalized",
    unionNormalized: "union_normalized",
    localEntity: "local_entity",
    createdAt: "created_at",
  },
  cbaIntelWageAdjustments: { id: "id", agreementId: "agreement_id", year: "year", effectiveDate: "effective_date" },
  cbaIntelClauses: { id: "id", agreementId: "agreement_id", clauseFamily: "clause_family", clauseNumber: "clause_number" },
  extractionMethodEnum: { enumValues: ["llm", "rule_based"] },
  extractionStatusEnum: { enumValues: ["pending", "running", "completed", "completed_with_errors", "failed"] },
  clauseFamilyEnum: { enumValues: ["wages", "leave"] },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn(() => ({})),
    and: vi.fn(() => ({})),
    or: vi.fn(() => ({})),
    ilike: vi.fn(() => ({})),
    desc: vi.fn(() => ({})),
  };
});

describe("extraction-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertQueue.length = 0;
    mocks.updateQueue.length = 0;
    mocks.mockSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.mockInsert.mockImplementation(() => makeInsertChain(mocks.insertQueue.shift() ?? []));
    mocks.mockUpdate.mockImplementation(() => makeUpdateChain(mocks.updateQueue.shift() ?? []));
  });

  it("creates, gets, completes, and lists extraction runs", async () => {
    mocks.insertQueue.push([{ id: "r1", documentId: "d1" }]);
    mocks.selectQueue.push([{ id: "r1", startedAt: new Date("2026-01-01T00:00:00.000Z") }]);
    mocks.updateQueue.push([{ id: "r1", status: "completed_with_errors" }]);
    mocks.selectQueue.push([{ id: "r1" }], [{ count: 1 }], [{ id: "r1" }]);

    const { createExtractionRun, completeExtractionRun, getExtractionRunById, listExtractionRuns } = await import(
      "../extraction-service"
    );

    await expect(createExtractionRun({ documentId: "d1" } as never)).resolves.toMatchObject({ id: "r1" });
    await expect(completeExtractionRun("r1", { findingsCount: 5, errorCount: 1 })).resolves.toMatchObject({
      status: "completed_with_errors",
    });
    await expect(getExtractionRunById("r1")).resolves.toEqual({ id: "r1" });
    await expect(
      listExtractionRuns({ documentId: "d1", status: "completed", method: "llm" }, { limit: 1000 }),
    ).resolves.toEqual({ items: [{ id: "r1" }], total: 1, page: 1, limit: 100 });
  });

  it("completeExtractionRun returns null when run is missing", async () => {
    mocks.selectQueue.push([]);
    const { completeExtractionRun } = await import("../extraction-service");
    await expect(completeExtractionRun("missing", { findingsCount: 0 })).resolves.toBeNull();
  });

  it("completeExtractionRun can finish without errors", async () => {
    mocks.selectQueue.push([{ id: "r2", startedAt: null }]);
    mocks.updateQueue.push([{ id: "r2", status: "completed" }]);
    const { completeExtractionRun } = await import("../extraction-service");
    await expect(completeExtractionRun("r2", { findingsCount: 1, errorCount: 0 })).resolves.toMatchObject({
      status: "completed",
    });
  });

  it("completeExtractionRun handles undefined error fields and null updated row", async () => {
    mocks.selectQueue.push([{ id: "r3", startedAt: new Date("2026-01-01T00:00:00.000Z") }]);
    mocks.updateQueue.push([]);
    const { completeExtractionRun } = await import("../extraction-service");
    await expect(completeExtractionRun("r3", { findingsCount: 2 })).resolves.toBeNull();
  });

  it("completeExtractionRun accepts explicit errors payload", async () => {
    mocks.selectQueue.push([{ id: "r4", startedAt: new Date("2026-01-01T00:00:00.000Z") }]);
    mocks.updateQueue.push([{ id: "r4", status: "completed_with_errors" }]);
    const { completeExtractionRun } = await import("../extraction-service");
    await expect(
      completeExtractionRun("r4", {
        findingsCount: 1,
        errorCount: 1,
        errors: [{ field: "rawContent", message: "missing" }],
      }),
    ).resolves.toMatchObject({ id: "r4", status: "completed_with_errors" });
  });

  it("creates finding and batch, then lists findings", async () => {
    mocks.insertQueue.push([{ id: "f1" }], [{ id: "f2" }, { id: "f3" }]);
    mocks.selectQueue.push([{ count: 2 }], [{ id: "f2" }, { id: "f3" }]);
    const { createFinding, createFindingsBatch, listFindings } = await import("../extraction-service");

    await expect(createFinding({ findingType: "wage", label: "increase", value: "2%" } as never)).resolves.toMatchObject({
      id: "f1",
    });
    await expect(createFindingsBatch([])).resolves.toEqual([]);
    await expect(createFindingsBatch([{ findingType: "a", label: "b" }] as never)).resolves.toHaveLength(2);
    await expect(
      listFindings({ documentId: "d1", extractionRunId: "r1", clauseFamily: "wages", findingType: "wage", reviewStatus: "pending_review", minConfidence: 0.7 }, { limit: 500 }),
    ).resolves.toEqual({ items: [{ id: "f2" }, { id: "f3" }], total: 2, page: 1, limit: 200 });
  });

  it("creates and lists agreements, wage adjustments, and clauses", async () => {
    mocks.insertQueue.push([{ id: "a1", title: "Agreement" }], [{ id: "w1" }], [{ id: "c1" }]);
    mocks.selectQueue.push(
      [{ id: "a1" }],
      [{ count: 1 }],
      [{ id: "a1" }],
      [{ id: "w1" }],
      [{ id: "c1" }],
    );
    const {
      createAgreement,
      getAgreementById,
      listAgreements,
      createWageAdjustment,
      listWageAdjustments,
      createClause,
      listClauses,
    } = await import("../extraction-service");

    await expect(createAgreement({ title: "Agreement" } as never)).resolves.toMatchObject({ id: "a1" });
    await expect(getAgreementById("a1")).resolves.toEqual({ id: "a1" });
    await expect(
      listAgreements(
        {
          jurisdiction: "federal",
          sector: "public",
          reviewStatus: "pending_review",
          search: "PSAC",
          employerLike: "Treasury",
          unionLike: "PSAC",
        },
        { limit: 1000 },
      ),
    ).resolves.toEqual({ items: [{ id: "a1" }], total: 1, page: 1, limit: 100 });
    await expect(createWageAdjustment({ agreementId: "a1" } as never)).resolves.toEqual({ id: "w1" });
    await expect(listWageAdjustments("a1")).resolves.toEqual([{ id: "w1" }]);
    await expect(createClause({ clauseFamily: "wages", rawText: "abc" } as never)).resolves.toEqual({ id: "c1" });
    await expect(listClauses("a1")).resolves.toEqual([{ id: "c1" }]);
  });

  it("returns null for missing agreement", async () => {
    mocks.selectQueue.push([]);
    const { getAgreementById } = await import("../extraction-service");
    await expect(getAgreementById("missing")).resolves.toBeNull();
  });

  it("lists agreements/findings/runs with no filters", async () => {
    mocks.selectQueue.push([{ count: 0 }], [], [{ count: 0 }], [], [{ count: 0 }], []);
    const { listAgreements, listFindings, listExtractionRuns } = await import("../extraction-service");
    await expect(listAgreements()).resolves.toEqual({ items: [], total: 0, page: 1, limit: 25 });
    await expect(listFindings()).resolves.toEqual({ items: [], total: 0, page: 1, limit: 50 });
    await expect(listExtractionRuns()).resolves.toEqual({ items: [], total: 0, page: 1, limit: 25 });
  });

  it("wraps errors for all exported operations", async () => {
    const {
      createExtractionRun,
      completeExtractionRun,
      getExtractionRunById,
      listExtractionRuns,
      createFinding,
      createFindingsBatch,
      listFindings,
      getAgreementById,
      listAgreements,
      createWageAdjustment,
      listWageAdjustments,
      createClause,
      listClauses,
    } = await import("../extraction-service");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createExtractionRun({ documentId: "d1" } as never)).rejects.toThrow("Failed to create extraction run");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(completeExtractionRun("r1", { findingsCount: 1 })).rejects.toThrow("Failed to complete extraction run");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(getExtractionRunById("r1")).rejects.toThrow("Failed to get extraction run");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(listExtractionRuns()).rejects.toThrow("Failed to list extraction runs");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createFinding({ findingType: "a", label: "b" } as never)).rejects.toThrow("Failed to create finding");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createFindingsBatch([{ findingType: "a", label: "b" }] as never)).rejects.toThrow(
      "Failed to create findings batch",
    );

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(listFindings()).rejects.toThrow("Failed to list findings");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(getAgreementById("a1")).rejects.toThrow("Failed to get extracted agreement");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(listAgreements()).rejects.toThrow("Failed to list extracted agreements");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createWageAdjustment({ agreementId: "a1" } as never)).rejects.toThrow("Failed to create wage adjustment");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(listWageAdjustments("a1")).rejects.toThrow("Failed to list wage adjustments");

    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert fail");
    });
    await expect(createClause({ clauseFamily: "wages" } as never)).rejects.toThrow("Failed to create clause");

    mocks.mockSelect.mockImplementationOnce(() => {
      throw new Error("select fail");
    });
    await expect(listClauses("a1")).rejects.toThrow("Failed to list clauses");
  });

  it("wraps errors", async () => {
    mocks.mockInsert.mockImplementationOnce(() => {
      throw new Error("insert failed");
    });
    const { createAgreement } = await import("../extraction-service");
    await expect(createAgreement({ title: "A" } as never)).rejects.toThrow("Failed to create extracted agreement");
    expect(mocks.mockLoggerError).toHaveBeenCalled();
  });
});
