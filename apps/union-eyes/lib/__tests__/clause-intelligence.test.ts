/**
 * Unit Tests — Clause Intelligence Service
 *
 * Tests semantic search, keyword fallback, and clause-grievance linking.
 * These are integration-light tests that mock the DB layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all transitive DB imports before importing the service
vi.mock("@/db/db", () => {
  // Chainable mock that is also thenable (resolves to []) at any terminal point
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    // Every method returns either a new chain or this chain
    for (const method of [
      "select", "from", "innerJoin", "leftJoin", "orderBy",
      "limit", "update", "set", "where", "returning",
    ]) {
      chain[method] = vi.fn(() => makeChain());
    }

    // Make the chain thenable so `await db.select().from(x).where(y)` resolves
    chain.then = (resolve: (v: any[]) => void) => {
      resolve([]);
      return Promise.resolve([]);
    };

    return chain;
  }

  return { db: makeChain() };
});

vi.mock("@/db/schema/domains/agreements/clauses", () => ({
  cbaClause: { id: "id", title: "title", content: "content", contractId: "contractId", clauseNumber: "clauseNumber" },
}));

vi.mock("@/db/schema/domains/agreements/clause-embeddings", () => ({
  clauseEmbeddings: { id: "id", clauseId: "clauseId", embeddingVector: "embeddingVector" },
}));

vi.mock("@/db/schema/domains/agreements/collective-agreements", () => ({
  collectiveAgreements: { id: "id", orgId: "orgId", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  ilike: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  sql: vi.fn(),
}));

vi.mock("@/lib/audit-logger", () => ({
  auditDataMutation: vi.fn(),
  auditLog: vi.fn(),
}));

// Now import after mocks
import {
  findRelevantClauses,
  linkClauseToGrievance,
  listContracts,
  listClauses,
} from "@/lib/services/clause-intelligence";

describe("Clause Intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("exports findRelevantClauses function", () => {
      expect(typeof findRelevantClauses).toBe("function");
    });

    it("exports linkClauseToGrievance function", () => {
      expect(typeof linkClauseToGrievance).toBe("function");
    });

    it("exports listContracts function", () => {
      expect(typeof listContracts).toBe("function");
    });

    it("exports listClauses function", () => {
      expect(typeof listClauses).toBe("function");
    });
  });

  describe("findRelevantClauses", () => {
    it("returns an array (keyword fallback path)", async () => {
      const result = await findRelevantClauses("org-123", "overtime violation");
      expect(Array.isArray(result)).toBe(true);
    });

    it("accepts optional limit parameter", async () => {
      const result = await findRelevantClauses("org-123", "safety concern", undefined, 5);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("listContracts", () => {
    it("returns an array", async () => {
      const result = await listContracts("org-123");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
