/**
 * Clause Intelligence — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();

  return {
    mockDb: { select: mockSelect, update: mockUpdate },
    mockSelect,
    mockUpdate,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema/domains/agreements/clauses", () => ({
  cbaClause: {
    id: "id", cbaId: "cbaId", clauseNumber: "clauseNumber",
    articleNumber: "articleNumber", title: "title", content: "content",
    organizationId: "organizationId",
  },
}));
vi.mock("@/db/schema/domains/agreements/clause-embeddings", () => ({
  clauseEmbeddings: { clauseId: "clauseId", embeddingVector: "embeddingVector" },
}));
vi.mock("@/db/schema/domains/agreements/collective-agreements", () => ({
  collectiveAgreements: { id: "id", title: "title", organizationId: "organizationId" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: any[]) => ({ _type: "and", a })),
  ilike: vi.fn((_c, v) => ({ _type: "ilike", v })),
  or: vi.fn((...a: any[]) => ({ _type: "or", a })),
  sql: vi.fn(),
}));
vi.mock("@/db/schema/domains/claims/grievances", () => ({
  grievances: { id: "id", cbaId: "cbaId", cbaArticle: "cbaArticle", cbaSection: "cbaSection" },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  listContracts, listClauses, findRelevantClauses, linkClauseToGrievance,
} from "../clause-intelligence";

/* ── Helpers: drizzle-style mock chains ────────────────────────────────── */

/** select → from → where (terminal) */
function chain_sfw(data: any) {
  const where = vi.fn().mockResolvedValue(data);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
}

/** select → from → where → limit (terminal) */
function chain_sfwl(data: any) {
  const limit = vi.fn().mockResolvedValue(data);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, limit };
}

/** select → from (terminal thenable — no .where()) */
function chain_sf(data: any) {
  const thenable = {
    then: (resolve: (v: any) => void, reject?: (e: any) => void) =>
      Promise.resolve(data).then(resolve, reject),
  };
  const from = vi.fn().mockReturnValue(thenable);
  return { from };
}

describe("clause-intelligence", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── listContracts ───────────────────────────────────────────────────────
  describe("listContracts", () => {
    it("returns contracts for org", async () => {
      const data = [{ id: "cba-1", title: "Master Agreement" }];
      const c = chain_sfw(data);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      const result = await listContracts("org-1");
      expect(result).toEqual(data);
    });

    it("returns empty array for no matches", async () => {
      const c = chain_sfw([]);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      const result = await listContracts("org-1");
      expect(result).toEqual([]);
    });
  });

  // ── listClauses ─────────────────────────────────────────────────────────
  describe("listClauses", () => {
    it("returns clauses for a CBA", async () => {
      const data = [{ id: "cl-1", title: "Wages" }];
      const c = chain_sfw(data);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      const result = await listClauses("cba-1");
      expect(result).toEqual(data);
    });

    it("returns empty when CBA has no clauses", async () => {
      const c = chain_sfw([]);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      const result = await listClauses("cba-1");
      expect(result).toEqual([]);
    });
  });

  // ── findRelevantClauses ─────────────────────────────────────────────────
  describe("findRelevantClauses", () => {
    it("uses keyword fallback when no embedding given", async () => {
      const clauseRows = [
        { id: "cl-1", clauseNumber: "5.1", title: "Overtime Pay", content: "Overtime rates apply.", cbaId: "cba-1" },
      ];
      const contractRows = [{ title: "Main CBA" }];

      let callN = 0;
      mocks.mockSelect.mockImplementation(() => {
        callN++;
        if (callN === 1) return { from: chain_sfwl(clauseRows).from };
        return { from: chain_sfw(contractRows).from };
      });

      const result = await findRelevantClauses("org-1", "overtime dispute about wages");
      expect(result.length).toBe(1);
      expect(result[0].clauseId).toBe("cl-1");
      expect(result[0].contractName).toBe("Main CBA");
      expect(result[0].similarity).toBe(0.5);
    });

    it("returns empty when no keywords exceed length threshold", async () => {
      const result = await findRelevantClauses("org-1", "a b c");
      expect(result).toEqual([]);
    });

    it("uses vector similarity when embeddings provided", async () => {
      const embeddings = [
        { clauseId: "cl-1", embeddingVector: JSON.stringify([0.9, 0.1, 0.0]) },
      ];
      const clause = { id: "cl-1", clauseNumber: "5.1", title: "Overtime", content: "Body", cbaId: "cba-1" };
      const contract = { title: "Main CBA" };

      let callN = 0;
      mocks.mockSelect.mockImplementation(() => {
        callN++;
        if (callN === 1) return { from: chain_sf(embeddings).from };
        if (callN === 2) return { from: chain_sfw([clause]).from };
        return { from: chain_sfw([contract]).from };
      });

      const result = await findRelevantClauses("org-1", "overtime", [1.0, 0.0, 0.0]);
      expect(result.length).toBe(1);
      expect(result[0].clauseId).toBe("cl-1");
      expect(result[0].contractName).toBe("Main CBA");
      expect(result[0].similarity).toBeGreaterThan(0);
    });

    it("returns empty when vector path yields no hits", async () => {
      mocks.mockSelect.mockImplementation(() => ({ from: chain_sf([]).from }));
      const result = await findRelevantClauses("org-1", "anything", [1.0, 0.0, 0.0]);
      expect(result).toEqual([]);
    });
  });

  // ── linkClauseToGrievance ───────────────────────────────────────────────
  describe("linkClauseToGrievance", () => {
    it("links clause to grievance and returns result", async () => {
      const clauseData = [{ cbaId: "cba-1", clauseNumber: "5.1", articleNumber: "5" }];
      const c = chain_sfw(clauseData);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });

      const updateWhere = vi.fn().mockResolvedValue(undefined);
      const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
      mocks.mockUpdate.mockReturnValueOnce({ set: updateSet });

      const result = await linkClauseToGrievance("gr-1", "cl-1");
      expect(result).toEqual({ grievanceId: "gr-1", clauseId: "cl-1", linked: true });
    });

    it("throws when clause not found", async () => {
      const c = chain_sfw([]);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      await expect(linkClauseToGrievance("gr-1", "cl-bad")).rejects.toThrow("Clause not found");
    });
  });
});
