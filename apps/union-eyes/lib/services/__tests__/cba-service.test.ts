/**
 * CBA Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
  const mockSetWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockGroupBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy, groupBy: mockGroupBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    mockDb: {
      select: mockSelect, insert: mockInsert, delete: mockDelete, update: mockUpdate,
      query: { collectiveAgreements: { findFirst: vi.fn() } },
    },
    mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit, mockOffset,
    mockReturning, mockValues, mockInsert, mockDelete, mockDeleteWhere,
    mockUpdate, mockSet, mockSetWhere, mockGroupBy,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema", () => ({
  collectiveAgreements: {
    id: "id", cbaNumber: "cbaNumber", organizationId: "organizationId",
    status: "status", jurisdiction: "jurisdiction", industrySector: "industrySector",
    employerName: "employerName", unionName: "unionName",
    effectiveDate: "effectiveDate", expiryDate: "expiryDate",
    isPublic: "isPublic", title: "title", rawText: "rawText",
    createdAt: "createdAt", updatedAt: "updatedAt", viewCount: "viewCount",
    employeeCoverage: "employeeCoverage",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: unknown[]) => ({ _type: "and", a })),
  or: vi.fn((...a: unknown[]) => ({ _type: "or", a })),
  like: vi.fn((_c, v) => ({ _type: "like", v })),
  desc: vi.fn((c) => ({ _type: "desc", c })),
  asc: vi.fn((c) => ({ _type: "asc", c })),
  sql: Object.assign(vi.fn(), { join: vi.fn(), raw: vi.fn() }),
  inArray: vi.fn((_c, v) => ({ _type: "inArray", v })),
  gte: vi.fn((_c, v) => ({ _type: "gte", v })),
  lte: vi.fn((_c, v) => ({ _type: "lte", v })),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getCBAById, getCBAByNumber, listCBAs, createCBA, updateCBA,
  deleteCBA, hardDeleteCBA, updateCBAStatus,
  getCBAsExpiringSoon, getCBAStatistics, searchCBAs,
} from "../cba-service";

describe("cba-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getCBAById ───────────────────────────────────────────────────────────
  describe("getCBAById", () => {
    it("returns CBA when found", async () => {
      const cba = { id: "cba-1", title: "Agreement" };
      mocks.mockDb.query.collectiveAgreements.findFirst.mockResolvedValueOnce(cba);
      const result = await getCBAById("cba-1");
      expect(result).toEqual(cba);
    });

    it("returns null when not found", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockResolvedValueOnce(undefined);
      expect(await getCBAById("nope")).toBeNull();
    });

    it("increments viewCount with includeAnalytics", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockResolvedValueOnce({ id: "cba-1" });
      const setWhere = vi.fn().mockResolvedValue(undefined);
      const setFn = vi.fn().mockReturnValue({ where: setWhere });
      mocks.mockDb.update.mockReturnValueOnce({ set: setFn });

      await getCBAById("cba-1", { includeAnalytics: true });
      expect(mocks.mockDb.update).toHaveBeenCalled();
    });

    it("throws on DB error", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockRejectedValueOnce(new Error("db"));
      await expect(getCBAById("x")).rejects.toThrow("Failed to fetch CBA");
    });
  });

  // ── getCBAByNumber ───────────────────────────────────────────────────────
  describe("getCBAByNumber", () => {
    it("returns CBA by number", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockResolvedValueOnce({ id: "cba-1", cbaNumber: "CBA-001" });
      expect(await getCBAByNumber("CBA-001")).toEqual({ id: "cba-1", cbaNumber: "CBA-001" });
    });

    it("returns null when not found", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockResolvedValueOnce(undefined);
      expect(await getCBAByNumber("nope")).toBeNull();
    });

    it("throws on DB error", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockRejectedValueOnce(new Error("db"));
      await expect(getCBAByNumber("x")).rejects.toThrow("Failed to fetch CBA by number");
    });
  });

  // ── listCBAs ─────────────────────────────────────────────────────────────
  describe("listCBAs", () => {
    function setupListMock(countVal: number, rows: unknown[]) {
      const countFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: countVal }]) });
      const dataOffset = vi.fn().mockResolvedValue(rows);
      const dataLimit = vi.fn().mockReturnValue({ offset: dataOffset });
      const dataOrderBy = vi.fn().mockReturnValue({ limit: dataLimit });
      const dataWhere = vi.fn().mockReturnValue({ orderBy: dataOrderBy });
      const dataFrom = vi.fn().mockReturnValue({ where: dataWhere });
      let n = 0;
      mocks.mockDb.select.mockImplementation(() => { n++; return n === 1 ? { from: countFrom } : { from: dataFrom }; });
    }

    it("returns paginated CBAs with defaults", async () => {
      setupListMock(1, [{ id: "cba-1" }]);
      const result = await listCBAs();
      expect(result).toEqual({ cbas: [{ id: "cba-1" }], total: 1, page: 1, limit: 20 });
    });

    it("applies all filter types", async () => {
      setupListMock(0, []);
      const result = await listCBAs({
        organizationId: "org-1", status: ["active"], jurisdiction: ["ON"],
        sector: "mining", employerName: "Acme", unionName: "CUPE",
        effectiveDateFrom: new Date(), effectiveDateTo: new Date(),
        expiryDateFrom: new Date(), expiryDateTo: new Date(),
        isPublic: true, searchQuery: "test",
      }, { page: 2, limit: 5, sortBy: "expiryDate", sortOrder: "asc" });
      expect(result.page).toBe(2);
    });

    it("throws on error", async () => {
      mocks.mockDb.select.mockImplementation(() => { throw new Error("db"); });
      await expect(listCBAs()).rejects.toThrow("Failed to list CBAs");
    });
  });

  // ── createCBA ────────────────────────────────────────────────────────────
  describe("createCBA", () => {
    it("creates and returns CBA", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cba-1" }]);
      expect(await createCBA({} as never)).toEqual({ id: "cba-1" });
    });

    it("throws on error", async () => {
      mocks.mockInsert.mockImplementationOnce(() => { throw new Error("db"); });
      await expect(createCBA({} as never)).rejects.toThrow("Failed to create CBA");
    });
  });

  // ── updateCBA ────────────────────────────────────────────────────────────
  describe("updateCBA", () => {
    it("returns updated CBA", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cba-1", title: "Updated" }]);
      expect(await updateCBA("cba-1", { title: "Updated" } as never)).toEqual({ id: "cba-1", title: "Updated" });
    });

    it("returns null when not found", async () => {
      mocks.mockReturning.mockResolvedValueOnce([undefined]);
      expect(await updateCBA("nope", {} as never)).toBeNull();
    });
  });

  // ── deleteCBA (soft) ─────────────────────────────────────────────────────
  describe("deleteCBA", () => {
    it("soft-deletes by setting status to archived", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cba-1", status: "archived" }]);
      expect(await deleteCBA("cba-1")).toBe(true);
    });

    it("returns false when not found", async () => {
      mocks.mockReturning.mockResolvedValueOnce([undefined]);
      expect(await deleteCBA("nope")).toBe(false);
    });
  });

  // ── hardDeleteCBA ────────────────────────────────────────────────────────
  describe("hardDeleteCBA", () => {
    it("returns true on success", async () => {
      expect(await hardDeleteCBA("cba-1")).toBe(true);
    });

    it("throws on error", async () => {
      mocks.mockDelete.mockImplementationOnce(() => { throw new Error("db"); });
      await expect(hardDeleteCBA("x")).rejects.toThrow("Failed to hard delete CBA");
    });
  });

  // ── updateCBAStatus ──────────────────────────────────────────────────────
  describe("updateCBAStatus", () => {
    it("updates status and returns CBA", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ id: "cba-1", status: "expired" }]);
      expect(await updateCBAStatus("cba-1", "expired")).toEqual({ id: "cba-1", status: "expired" });
    });

    it("returns null when not found", async () => {
      mocks.mockReturning.mockResolvedValueOnce([undefined]);
      expect(await updateCBAStatus("nope", "active")).toBeNull();
    });
  });

  // ── getCBAsExpiringSoon ──────────────────────────────────────────────────
  describe("getCBAsExpiringSoon", () => {
    it("returns CBAs expiring within window", async () => {
      const mockOrderBy2 = vi.fn().mockResolvedValue([{ id: "cba-1" }]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getCBAsExpiringSoon(90);
      expect(result).toEqual([{ id: "cba-1" }]);
    });

    it("applies organizationId filter when provided", async () => {
      const mockOrderBy2 = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getCBAsExpiringSoon(30, "org-1");
      expect(result).toEqual([]);
    });
  });

  // ── getCBAStatistics ─────────────────────────────────────────────────────
  describe("getCBAStatistics", () => {
    it("returns statistics grouped by status", async () => {
      const stats = [{ status: "active", count: 5, totalEmployees: 100 }];
      let n = 0;
      mocks.mockDb.select.mockImplementation(() => {
        n++;
        if (n === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue(stats) }) }) };
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 5 }]) }) };
      });

      const result = await getCBAStatistics("org-1");
      expect(result.byStatus).toEqual(stats);
      expect(result.total).toBe(5);
    });

    it("returns 0 total when no stats", async () => {
      let n = 0;
      mocks.mockDb.select.mockImplementation(() => {
        n++;
        if (n === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue([]) }) }) };
        }
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{}]) }) };
      });

      const result = await getCBAStatistics("org-1");
      expect(result.total).toBe(0);
    });
  });

  // ── searchCBAs ───────────────────────────────────────────────────────────
  describe("searchCBAs", () => {
    it("searches by query text", async () => {
      const mockOrderBy2 = vi.fn().mockResolvedValue([{ id: "cba-1" }]);
      const mockLimit2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await searchCBAs("test");
      expect(result).toEqual([{ id: "cba-1" }]);
    });

    it("applies organizationId filter", async () => {
      const mockOrderBy2 = vi.fn().mockResolvedValue([]);
      const mockLimit2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await searchCBAs("q", "org-1", 10);
      expect(result).toEqual([]);
    });
  });

  // ── Batch 35: branch gap-fill ────────────────────────────────────────────
  describe("Batch 35: branch gap-fill", () => {
    it("getCBAById with includeClauses: true covers L62 truthy arm", async () => {
      mocks.mockDb.query.collectiveAgreements.findFirst.mockResolvedValueOnce({ id: "cba-1", title: "CBA" });
      const result = await getCBAById("cba-1", { includeClauses: true });
      expect(result).toEqual({ id: "cba-1", title: "CBA" });
    });

    it("listCBAs with unrecognised sortBy falls back to createdAt (L194)", async () => {
      // Setup: two select calls — count then data
      const countFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) });
      const dataOffset = vi.fn().mockResolvedValue([]);
      const dataLimit = vi.fn().mockReturnValue({ offset: dataOffset });
      const dataOrderBy = vi.fn().mockReturnValue({ limit: dataLimit });
      const dataWhere = vi.fn().mockReturnValue({ orderBy: dataOrderBy });
      const dataFrom = vi.fn().mockReturnValue({ where: dataWhere });
      let n = 0;
      mocks.mockDb.select.mockImplementation(() => { n++; return n === 1 ? { from: countFrom } : { from: dataFrom }; });

      const result = await listCBAs({}, { sortBy: "title" as never });
      expect(result.cbas).toEqual([]);
    });

    it("updateCBA throws on DB error (catch block)", async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error("update-fail"); });
      await expect(updateCBA("cba-1", {} as never)).rejects.toThrow("Failed to update CBA");
    });

    it("deleteCBA throws on DB error (catch block)", async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error("del-fail"); });
      await expect(deleteCBA("cba-1")).rejects.toThrow("Failed to delete CBA");
    });

    it("updateCBAStatus throws on DB error (catch block)", async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error("status-fail"); });
      await expect(updateCBAStatus("cba-1", "expired" as never)).rejects.toThrow("Failed to update CBA status");
    });

    it("getCBAsExpiringSoon throws on DB error (catch block)", async () => {
      mocks.mockDb.select.mockImplementationOnce(() => { throw new Error("expire-fail"); });
      await expect(getCBAsExpiringSoon("org-1")).rejects.toThrow("Failed to fetch expiring CBAs");
    });

    it("getCBAStatistics throws on DB error (catch block)", async () => {
      mocks.mockDb.select.mockImplementationOnce(() => { throw new Error("stats-fail"); });
      await expect(getCBAStatistics("org-1")).rejects.toThrow("Failed to fetch CBA statistics");
    });

    it("searchCBAs throws on DB error (catch block)", async () => {
      mocks.mockDb.select.mockImplementationOnce(() => { throw new Error("search-fail"); });
      await expect(searchCBAs("q")).rejects.toThrow("Failed to search CBAs");
    });
  });
});
