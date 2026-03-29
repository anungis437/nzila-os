/**
 * Bargaining Notes Service — Unit Tests
 * Exercises REAL production code with only @/db/db, @/db/schema, drizzle-orm, @/lib/logger mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
  const mockSetWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  // chain: select → from → where → orderBy → limit → offset
  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    mockDb: {
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
      update: mockUpdate,
      query: { bargainingNotes: { findFirst: vi.fn() } },
    },
    mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit, mockOffset,
    mockReturning, mockValues, mockInsert, mockDelete, mockDeleteWhere,
    mockUpdate, mockSet, mockSetWhere,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema", () => ({
  bargainingNotes: {
    id: "id", cbaId: "cbaId", organizationId: "organizationId",
    sessionType: "sessionType", confidentialityLevel: "confidentialityLevel",
    sessionDate: "sessionDate", createdAt: "createdAt", createdBy: "createdBy",
    title: "title", content: "content", tags: "tags", sessionNumber: "sessionNumber",
    relatedClauseIds: "relatedClauseIds", relatedDecisionIds: "relatedDecisionIds",
    updatedAt: "updatedAt",
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
  getBargainingNoteById,
  listBargainingNotes,
  getBargainingNotesByCBA,
  createBargainingNote,
  bulkCreateBargainingNotes,
  updateBargainingNote,
  deleteBargainingNote,
  searchBargainingNotes,
  getBargainingTimeline,
  getNotesByTags,
  getNotesRelatedToClauses,
  getNotesRelatedToPrecedents,
} from "../bargaining-notes-service";

describe("bargaining-notes-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getBargainingNoteById ────────────────────────────────────────────────
  describe("getBargainingNoteById", () => {
    it("returns note when found", async () => {
      const note = { id: "n1", title: "Session 1" };
      mocks.mockDb.query.bargainingNotes.findFirst.mockResolvedValueOnce(note);
      const result = await getBargainingNoteById("n1");
      expect(result).toEqual(note);
    });

    it("returns null when not found", async () => {
      mocks.mockDb.query.bargainingNotes.findFirst.mockResolvedValueOnce(undefined);
      const result = await getBargainingNoteById("nope");
      expect(result).toBeNull();
    });

    it("throws on DB error", async () => {
      mocks.mockDb.query.bargainingNotes.findFirst.mockRejectedValueOnce(new Error("db"));
      await expect(getBargainingNoteById("n1")).rejects.toThrow("Failed to fetch bargaining note");
    });
  });

  // ── listBargainingNotes ──────────────────────────────────────────────────
  describe("listBargainingNotes", () => {
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

    it("returns paginated notes with default params", async () => {
      setupListMock(1, [{ id: "n1" }]);
      const result = await listBargainingNotes();
      expect(result).toEqual({ notes: [{ id: "n1" }], total: 1, page: 1, limit: 20 });
    });

    it("applies all filter types", async () => {
      setupListMock(0, []);
      const result = await listBargainingNotes(
        {
          cbaId: "cba-1",
          organizationId: "org-1",
          sessionType: ["negotiation"],
          confidentialityLevel: "restricted",
          dateFrom: new Date("2025-01-01"),
          dateTo: new Date("2026-01-01"),
          createdBy: "user-1",
          searchQuery: "wages",
          tags: ["economics"],
        },
        { page: 2, limit: 10, sortBy: "createdAt", sortOrder: "asc" }
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it("throws on DB error", async () => {
      mocks.mockDb.select.mockImplementation(() => { throw new Error("db"); });
      await expect(listBargainingNotes()).rejects.toThrow("Failed to list bargaining notes");
    });
  });

  // ── getBargainingNotesByCBA ──────────────────────────────────────────────
  describe("getBargainingNotesByCBA", () => {
    it("returns notes for a CBA", async () => {
      const mockOrderBy2 = vi.fn().mockResolvedValue([{ id: "n1" }]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getBargainingNotesByCBA("cba-1");
      expect(result).toEqual([{ id: "n1" }]);
    });

    it("applies sessionType filter when provided", async () => {
      const mockOrderBy2 = vi.fn().mockResolvedValue([]);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getBargainingNotesByCBA("cba-1", "negotiation");
      expect(result).toEqual([]);
    });

    it("throws on DB error", async () => {
      mocks.mockDb.select.mockImplementation(() => { throw new Error("db"); });
      await expect(getBargainingNotesByCBA("cba-1")).rejects.toThrow("Failed to fetch bargaining notes by CBA");
    });
  });

  // ── createBargainingNote ─────────────────────────────────────────────────
  describe("createBargainingNote", () => {
    it("creates and returns a new note", async () => {
      const note = { id: "n1", title: "New Note" };
      mocks.mockReturning.mockResolvedValueOnce([note]);
      const result = await createBargainingNote({ title: "New Note" } as never);
      expect(result).toEqual(note);
    });

    it("throws on DB error", async () => {
      mocks.mockInsert.mockImplementationOnce(() => { throw new Error("db"); });
      await expect(createBargainingNote({} as never)).rejects.toThrow("Failed to create bargaining note");
    });
  });

  // ── bulkCreateBargainingNotes ────────────────────────────────────────────
  describe("bulkCreateBargainingNotes", () => {
    it("creates multiple notes", async () => {
      const notes = [{ id: "n1" }, { id: "n2" }];
      mocks.mockReturning.mockResolvedValueOnce(notes);
      const result = await bulkCreateBargainingNotes([{} as never, {} as never]);
      expect(result).toEqual(notes);
    });

    it("throws on DB error", async () => {
      mocks.mockInsert.mockImplementationOnce(() => { throw new Error("db"); });
      await expect(bulkCreateBargainingNotes([{} as never])).rejects.toThrow("Failed to bulk create bargaining notes");
    });
  });

  // ── updateBargainingNote ─────────────────────────────────────────────────
  describe("updateBargainingNote", () => {
    it("returns updated note", async () => {
      const updated = { id: "n1", title: "Updated" };
      mocks.mockReturning.mockResolvedValueOnce([updated]);
      const result = await updateBargainingNote("n1", { title: "Updated" } as never);
      expect(result).toEqual(updated);
    });

    it("returns null when note not found (empty returning)", async () => {
      mocks.mockReturning.mockResolvedValueOnce([undefined]);
      const result = await updateBargainingNote("nope", {} as never);
      expect(result).toBeNull();
    });

    it("throws on DB error", async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error("db"); });
      await expect(updateBargainingNote("n1", {} as never)).rejects.toThrow("Failed to update bargaining note");
    });
  });

  // ── deleteBargainingNote ─────────────────────────────────────────────────
  describe("deleteBargainingNote", () => {
    it("returns true on success", async () => {
      const result = await deleteBargainingNote("n1");
      expect(result).toBe(true);
    });

    it("throws on DB error", async () => {
      mocks.mockDelete.mockImplementationOnce(() => { throw new Error("db"); });
      await expect(deleteBargainingNote("n1")).rejects.toThrow("Failed to delete bargaining note");
    });
  });

  // ── searchBargainingNotes ────────────────────────────────────────────────
  describe("searchBargainingNotes", () => {
    it("searches by query and optional filters", async () => {
      const mockLimit2 = vi.fn().mockResolvedValue([{ id: "n1" }]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await searchBargainingNotes("wages", { organizationId: "org-1", cbaId: "cba-1", sessionType: ["negotiation"] });
      expect(result).toEqual([{ id: "n1" }]);
    });

    it("throws on DB error", async () => {
      mocks.mockDb.select.mockImplementation(() => { throw new Error("db"); });
      await expect(searchBargainingNotes("q")).rejects.toThrow("Failed to search bargaining notes");
    });
  });

  // ── getBargainingTimeline ────────────────────────────────────────────────
  describe("getBargainingTimeline", () => {
    it("returns mapped timeline entries", async () => {
      const rows = [{ id: "n1", sessionDate: new Date("2026-01-01"), sessionType: "negotiation", sessionNumber: 1, title: "S1" }];
      const mockOrderBy2 = vi.fn().mockResolvedValue(rows);
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getBargainingTimeline("cba-1");
      expect(result).toEqual([{ id: "n1", sessionDate: rows[0].sessionDate, sessionType: "negotiation", sessionNumber: 1, title: "S1" }]);
    });

    it("throws on DB error", async () => {
      mocks.mockDb.select.mockImplementation(() => { throw new Error("db"); });
      await expect(getBargainingTimeline("cba-1")).rejects.toThrow("Failed to fetch bargaining timeline");
    });
  });

  // ── getNotesByTags ───────────────────────────────────────────────────────
  describe("getNotesByTags", () => {
    it("returns notes matching tags", async () => {
      const mockLimit2 = vi.fn().mockResolvedValue([{ id: "n1" }]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getNotesByTags(["wages"], "org-1");
      expect(result).toEqual([{ id: "n1" }]);
    });

    it("works without organizationId", async () => {
      const mockLimit2 = vi.fn().mockResolvedValue([]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getNotesByTags(["wages"]);
      expect(result).toEqual([]);
    });
  });

  // ── getNotesRelatedToClauses ─────────────────────────────────────────────
  describe("getNotesRelatedToClauses", () => {
    it("returns notes matching clause IDs", async () => {
      const mockLimit2 = vi.fn().mockResolvedValue([{ id: "n1" }]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getNotesRelatedToClauses(["clause-1"]);
      expect(result).toEqual([{ id: "n1" }]);
    });

    it("throws on DB error", async () => {
      mocks.mockDb.select.mockImplementation(() => { throw new Error("db"); });
      await expect(getNotesRelatedToClauses(["c1"])).rejects.toThrow("Failed to fetch notes related to clauses");
    });
  });

  // ── getNotesRelatedToPrecedents ──────────────────────────────────────────
  describe("getNotesRelatedToPrecedents", () => {
    it("returns notes matching decision IDs", async () => {
      const mockLimit2 = vi.fn().mockResolvedValue([{ id: "n1" }]);
      const mockOrderBy2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom2 });

      const result = await getNotesRelatedToPrecedents(["dec-1"]);
      expect(result).toEqual([{ id: "n1" }]);
    });
  });
});
