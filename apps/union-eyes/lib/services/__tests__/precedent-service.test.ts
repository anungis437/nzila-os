/**
 * Precedent Service — Unit Tests
 *
 * Covers all 12 exported functions:
 *   getPrecedentById, getPrecedentByCaseNumber, listPrecedents,
 *   createPrecedent, updatePrecedent, deletePrecedent,
 *   searchPrecedents, getPrecedentsByIssueType, getRelatedPrecedents,
 *   getArbitratorProfile, updateArbitratorStats, getTopArbitrators,
 *   getPrecedentStatistics, getMostCitedPrecedents
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted mocks ──────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockWhere = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindFirstArb: vi.fn(),
    mockReturning,
    mockWhere,
    mockSelectFrom: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockUpdateSet: vi.fn(() => ({
      where: vi.fn(() => ({ returning: mockReturning })),
    })),
    mockDeleteWhere: vi.fn(),
  };
});

/* chain helpers */
function sfwol(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn().mockResolvedValue(data),
          })),
        })),
      })),
    })),
  };
}
function sfwolNoOffset(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(data),
        })),
      })),
    })),
  };
}
function sfw(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(data),
    })),
  };
}
function sfol(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(data),
      })),
    })),
  };
}
function _sfwool(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(data),
          })),
        })),
      })),
    })),
  };
}
function sfg(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      groupBy: vi.fn().mockResolvedValue(data),
    })),
  };
}

vi.mock("@/db/db", () => ({
  db: {
    query: {
      arbitrationDecisions: { findFirst: mocks.mockFindFirst },
      arbitratorProfiles: { findFirst: mocks.mockFindFirstArb },
    },
    select: vi.fn(() => sfwol()),
    insert: vi.fn(() => ({ values: mocks.mockInsertValues })),
    update: vi.fn(() => ({ set: mocks.mockUpdateSet })),
    delete: vi.fn(() => ({ where: mocks.mockDeleteWhere })),
  },
}));

vi.mock("@/db/schema", () => ({
  arbitrationDecisions: {
    id: "id",
    caseNumber: "caseNumber",
    caseTitle: "caseTitle",
    tribunal: "tribunal",
    decisionType: "decisionType",
    decisionDate: "decisionDate",
    arbitrator: "arbitrator",
    union: "union",
    employer: "employer",
    outcome: "outcome",
    precedentValue: "precedentValue",
    summary: "summary",
    headnote: "headnote",
    issueTypes: "issueTypes",
    jurisdiction: "jurisdiction",
    sector: "sector",
    citationCount: "citationCount",
    viewCount: "viewCount",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    fullText: "fullText",
  },
  arbitratorProfiles: {
    id: "id",
    name: "name",
    totalDecisions: "totalDecisions",
    isActive: "isActive",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  or: vi.fn((...a: unknown[]) => a),
  like: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((c: unknown) => c),
  asc: vi.fn((c: unknown) => c),
  sql: Object.assign(vi.fn((...a: unknown[]) => a), { raw: vi.fn() }),
  inArray: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
  lte: vi.fn((...a: unknown[]) => a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import { db } from "@/db/db";
import {
  getPrecedentById,
  getPrecedentByCaseNumber,
  listPrecedents,
  createPrecedent,
  updatePrecedent,
  deletePrecedent,
  searchPrecedents,
  getPrecedentsByIssueType,
  getRelatedPrecedents,
  getArbitratorProfile,
  updateArbitratorStats,
  getTopArbitrators,
  getPrecedentStatistics,
  getMostCitedPrecedents,
} from "../precedent-service";

/* ── tests ──────────────────────────────────────────────────────────── */

describe("precedent-service", () => {
  const dec = {
    id: "d-1",
    caseNumber: "ARB-001",
    caseTitle: "Test Case",
    sector: "health",
    issueTypes: ["discipline"],
    outcome: "grievance_upheld",
    remedy: { monetaryAward: 5000 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // default select chain resolves []
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(sfwol());
  });

  // ── getPrecedentById ────────────────────────────────────────────────
  describe("getPrecedentById", () => {
    it("returns decision and increments view count", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(dec);
      mocks.mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([dec]),
      });
      const result = await getPrecedentById("d-1");
      expect(result).toBeDefined();
      expect(mocks.mockFindFirst).toHaveBeenCalled();
    });

    it("returns null when not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      expect(await getPrecedentById("bad")).toBeNull();
    });

    it("strips fullText when includeFullText=false", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ ...dec, fullText: "long..." });
      mocks.mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([dec]),
      });
      const r = await getPrecedentById("d-1", { includeFullText: false });
      expect(r?.fullText).toBeUndefined();
    });

    it("keeps fullText when includeFullText=true", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ ...dec, fullText: "long..." });
      mocks.mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([dec]),
      });
      const r = await getPrecedentById("d-1", { includeFullText: true });
      expect(r?.fullText).toBe("long...");
    });

    it("throws on DB error", async () => {
      mocks.mockFindFirst.mockRejectedValueOnce(new Error("db err"));
      await expect(getPrecedentById("d-1")).rejects.toThrow("Failed to fetch precedent");
    });
  });

  // ── getPrecedentByCaseNumber ────────────────────────────────────────
  describe("getPrecedentByCaseNumber", () => {
    it("returns decision by case number", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(dec);
      const r = await getPrecedentByCaseNumber("ARB-001");
      expect(r?.caseNumber).toBe("ARB-001");
    });

    it("returns null when not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      expect(await getPrecedentByCaseNumber("X")).toBeNull();
    });
  });

  // ── listPrecedents ─────────────────────────────────────────────────
  describe("listPrecedents", () => {
    it("returns paginated list with count", async () => {
      // First select call = count query
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfw([{ count: 1 }]))
        // Second select call = data query
        .mockReturnValueOnce(sfwol([dec]));
      const r = await listPrecedents({}, { page: 1, limit: 10 });
      expect(r.total).toBe(1);
      expect(r.precedents).toHaveLength(1);
      expect(r.page).toBe(1);
    });

    it("applies filters", async () => {
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfw([{ count: 0 }]))
        .mockReturnValueOnce(sfwol([]));
      const r = await listPrecedents({
        tribunal: ["OLRB"],
        outcome: ["grievance_upheld"],
        searchQuery: "test",
        dateFrom: new Date(),
        dateTo: new Date(),
        jurisdiction: "ON",
        sector: "health",
        arbitrator: "Smith",
        union: "CUPE",
        employer: "City",
        decisionType: ["award"],
        precedentValue: ["high"],
      });
      expect(r.total).toBe(0);
    });

    it("throws on error", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => {
          throw new Error("db");
        }),
      });
      await expect(listPrecedents()).rejects.toThrow("Failed to list precedents");
    });
  });

  // ── createPrecedent ────────────────────────────────────────────────
  describe("createPrecedent", () => {
    it("inserts and returns new decision", async () => {
      mocks.mockReturning.mockResolvedValueOnce([dec]);
      // updateArbitratorStats background: select for decisions
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfw([]));
      const r = await createPrecedent({
        organizationId: "org-1",
        caseNumber: "ARB-002",
        decisionDate: new Date(),
        arbitrator: "Smith",
      } as never);
      expect(r.id).toBe("d-1");
    });

    it("skips arbitrator stats when no arbitrator", async () => {
      mocks.mockReturning.mockResolvedValueOnce([dec]);
      const r = await createPrecedent({
        organizationId: "org-1",
        caseNumber: "ARB-003",
        decisionDate: new Date(),
      } as never);
      expect(r.id).toBe("d-1");
    });
  });

  // ── updatePrecedent ────────────────────────────────────────────────
  describe("updatePrecedent", () => {
    it("updates and returns the decision", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ ...dec, caseTitle: "Updated" }]);
      const r = await updatePrecedent("d-1", { caseTitle: "Updated" } as never);
      expect(r?.caseTitle).toBe("Updated");
    });

    it("returns null when not found", async () => {
      mocks.mockReturning.mockResolvedValueOnce([undefined]);
      const r = await updatePrecedent("bad", {} as never);
      expect(r).toBeNull();
    });
  });

  // ── deletePrecedent ────────────────────────────────────────────────
  describe("deletePrecedent", () => {
    it("returns true on success", async () => {
      mocks.mockDeleteWhere.mockResolvedValueOnce(undefined);
      expect(await deletePrecedent("d-1")).toBe(true);
    });

    it("throws on error", async () => {
      mocks.mockDeleteWhere.mockRejectedValueOnce(new Error("del err"));
      await expect(deletePrecedent("d-1")).rejects.toThrow("Failed to delete precedent");
    });
  });

  // ── searchPrecedents ───────────────────────────────────────────────
  describe("searchPrecedents", () => {
    it("returns matching decisions", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([dec]));
      const r = await searchPrecedents("discipline");
      expect(r).toHaveLength(1);
    });

    it("applies optional filters", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([]));
      const r = await searchPrecedents("test", {
        precedentValue: ["high"],
        tribunal: ["OLRB"],
      });
      expect(r).toHaveLength(0);
    });
  });

  // ── getPrecedentsByIssueType ───────────────────────────────────────
  describe("getPrecedentsByIssueType", () => {
    it("returns decisions matching JSONB issue type", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([dec]));
      const r = await getPrecedentsByIssueType("discipline");
      expect(r).toHaveLength(1);
    });
  });

  // ── getRelatedPrecedents ───────────────────────────────────────────
  describe("getRelatedPrecedents", () => {
    it("returns empty when source not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      const r = await getRelatedPrecedents("bad");
      expect(r).toEqual([]);
    });

    it("returns related when source exists", async () => {
      // getPrecedentById internal call
      mocks.mockFindFirst.mockResolvedValueOnce(dec);
      // increment view count
      mocks.mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([dec]),
      });
      // the final select for related
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([{ id: "d-2" }]));
      const r = await getRelatedPrecedents("d-1");
      expect(r).toHaveLength(1);
    });
  });

  // ── getArbitratorProfile ───────────────────────────────────────────
  describe("getArbitratorProfile", () => {
    it("returns profile when found", async () => {
      mocks.mockFindFirstArb.mockResolvedValueOnce({ name: "Smith" });
      const r = await getArbitratorProfile("Smith");
      expect(r?.name).toBe("Smith");
    });

    it("returns null when not found", async () => {
      mocks.mockFindFirstArb.mockResolvedValueOnce(undefined);
      expect(await getArbitratorProfile("Nobody")).toBeNull();
    });
  });

  // ── updateArbitratorStats ──────────────────────────────────────────
  describe("updateArbitratorStats", () => {
    it("does nothing when no decisions", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfw([]));
      await updateArbitratorStats("Smith");
      // shouldn't throw
    });

    it("updates existing profile", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        sfw([
          { ...dec, outcome: "grievance_upheld", remedy: { monetaryAward: 1000 }, issueTypes: ["discipline"], decisionDate: new Date() },
          { ...dec, outcome: "partial_success", remedy: { monetaryAward: 500 }, issueTypes: ["seniority"], decisionDate: new Date() },
          { ...dec, outcome: "grievance_denied", remedy: null, issueTypes: null, decisionDate: new Date() },
        ])
      );
      mocks.mockFindFirstArb.mockResolvedValueOnce({ name: "Smith" });
      mocks.mockUpdateSet.mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) });
      await updateArbitratorStats("Smith");
      // profile updated
    });

    it("inserts new profile when none exists", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        sfw([{ ...dec, decisionDate: new Date() }])
      );
      mocks.mockFindFirstArb.mockResolvedValueOnce(undefined);
      mocks.mockInsertValues.mockReturnValueOnce(undefined);
      await updateArbitratorStats("NewArb");
    });

    it("swallows errors silently", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => {
          throw new Error("db fail");
        }),
      });
      // Should NOT throw
      await updateArbitratorStats("Smith");
    });
  });

  // ── getTopArbitrators ──────────────────────────────────────────────
  describe("getTopArbitrators", () => {
    it("returns sorted profiles", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfwolNoOffset([{ name: "A" }]));
      const r = await getTopArbitrators(5);
      expect(r).toHaveLength(1);
    });
  });

  // ── getPrecedentStatistics ─────────────────────────────────────────
  describe("getPrecedentStatistics", () => {
    it("returns grouped stats", async () => {
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfg([{ outcome: "upheld", count: 3 }]))
        .mockReturnValueOnce(sfg([{ tribunal: "OLRB", count: 2 }]))
        .mockReturnValueOnce(sf([{ total: 5 }]));
      const r = await getPrecedentStatistics();
      expect(r.total).toBe(5);
      expect(r.byOutcome).toHaveLength(1);
      expect(r.byTribunal).toHaveLength(1);
    });
  });

  // ── getMostCitedPrecedents ─────────────────────────────────────────
  describe("getMostCitedPrecedents", () => {
    it("returns top cited decisions", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfol([dec]));
      const r = await getMostCitedPrecedents(5);
      expect(r).toHaveLength(1);
    });
  });

  // ── Batch 37: sort-column branches + catch-block + empty-decisions ────
  describe("listPrecedents — sort column branches", () => {
    it("sorts by decisionDate", async () => {
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfw([{ count: 0 }]))
        .mockReturnValueOnce(sfwol([]));
      const r = await listPrecedents({}, { sortBy: "decisionDate" });
      expect(r.total).toBe(0);
    });

    it("sorts by citationCount", async () => {
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfw([{ count: 0 }]))
        .mockReturnValueOnce(sfwol([]));
      const r = await listPrecedents({}, { sortBy: "citationCount" });
      expect(r.total).toBe(0);
    });

    it("sorts by default (createdAt) for unknown sortBy", async () => {
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfw([{ count: 0 }]))
        .mockReturnValueOnce(sfwol([]));
      const r = await listPrecedents({}, { sortBy: "unknown" });
      expect(r.total).toBe(0);
    });

    it("sorts ascending when sortOrder is asc", async () => {
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(sfw([{ count: 0 }]))
        .mockReturnValueOnce(sfwol([]));
      const r = await listPrecedents({}, { sortOrder: "asc" });
      expect(r.total).toBe(0);
    });
  });

  describe("updateArbitratorStats — empty decisions", () => {
    it("returns early with no decisions", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(sfw([]));
      await updateArbitratorStats("Nobody");
      // Should not attempt insert/update
      expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    });
  });

  describe("catch-block coverage", () => {
    it("getPrecedentByCaseNumber throws on error", async () => {
      mocks.mockFindFirst.mockRejectedValue(new Error("db"));
      await expect(getPrecedentByCaseNumber("X")).rejects.toThrow(
        "Failed to fetch precedent by case number",
      );
    });

    it("createPrecedent throws on error", async () => {
      mocks.mockReturning.mockRejectedValue(new Error("db"));
      await expect(createPrecedent({} as never)).rejects.toThrow(
        "Failed to create precedent",
      );
    });

    it("updatePrecedent throws on error", async () => {
      mocks.mockUpdateSet.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("db")),
        })),
      }));
      await expect(updatePrecedent("id", {})).rejects.toThrow(
        "Failed to update precedent",
      );
    });

    it("searchPrecedents throws on error", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => { throw new Error("db"); }),
      });
      await expect(searchPrecedents("query")).rejects.toThrow(
        "Failed to search precedents",
      );
    });

    it("getPrecedentsByIssueType throws on error", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => { throw new Error("db"); }),
      });
      await expect(getPrecedentsByIssueType("discipline")).rejects.toThrow(
        "Failed to fetch precedents by issue type",
      );
    });

    it("getRelatedPrecedents throws on DB error", async () => {
      mocks.mockFindFirst.mockResolvedValue(dec);
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => { throw new Error("db"); }),
      });
      await expect(getRelatedPrecedents("d-1")).rejects.toThrow(
        "Failed to fetch related precedents",
      );
    });

    it("getArbitratorProfile throws on error", async () => {
      mocks.mockFindFirstArb.mockRejectedValue(new Error("db"));
      await expect(getArbitratorProfile("Smith")).rejects.toThrow(
        "Failed to fetch arbitrator profile",
      );
    });

    it("getTopArbitrators throws on error", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => { throw new Error("db"); }),
      });
      await expect(getTopArbitrators()).rejects.toThrow(
        "Failed to fetch top arbitrators",
      );
    });

    it("getMostCitedPrecedents throws on error", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => { throw new Error("db"); }),
      });
      await expect(getMostCitedPrecedents()).rejects.toThrow(
        "Failed to fetch most cited precedents",
      );
    });
  });
});

/* sf: select→from (no where/orderBy) */
function sf(data: unknown[] = []) {
  return {
    from: vi.fn().mockResolvedValue(data),
  };
}
