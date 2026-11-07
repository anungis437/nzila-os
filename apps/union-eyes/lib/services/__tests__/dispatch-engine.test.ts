/**
 * Dispatch Engine — Unit Tests
 * DB-backed functions mock @/db/db.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([{ id: "a1" }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return {
    mockDb: { select: mockSelect, insert: mockInsert, update: mockUpdate, query: {} },
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockInsert,
    mockValues,
    mockReturning,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema/domains/dispatch/dispatch", () => ({
  dispatchRequests: {
    id: "id",
    orgId: "orgId",
    status: "status",
    requestedDate: "requestedDate",
    requiredSkills: "requiredSkills",
    requestedWorkers: "requestedWorkers",
  },
  dispatchAssignments: {
    requestId: "requestId",
    memberId: "memberId",
    status: "status",
  },
  dispatchRules: {
    orgId: "orgId",
    priority: "priority",
  },
}));
vi.mock("@/db/schema-organizations", () => ({ organizationMembers: { id: "id", organizationId: "organizationId", status: "status", name: "name", seniority: "seniority" } }));
vi.mock("drizzle-orm", () => ({
  inArray: vi.fn((c, v) => ({ _type: "inArray", c, v })),
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: any[]) => ({ _type: "and", a })),
  asc: vi.fn((c) => ({ _type: "asc", c })),
  desc: vi.fn((c) => ({ _type: "desc", c })),
}));

import {
  createDispatchRequest,
  listDispatchQueue,
  loadDispatchRules,
  rankCandidates,
} from "../dispatch-engine";

describe("dispatch-engine", () => {
  beforeEach(() => vi.clearAllMocks());

  // The point-scoring tests that stood here asserted the invented scores themselves (rotation flat 10, proximity flat 5, a full skills
  // match when none was required). Rule application is now tested in lib/__tests__/dispatch-engine.test.ts
  // (DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED).

  // ── createDispatchRequest ────────────────────────────────────────────────
  describe("createDispatchRequest", () => {
    it("inserts and returns the new dispatch request", async () => {
      const data = { orgId: "org-1", requestedWorkers: 3, status: "open" as const };
      mocks.mockReturning.mockResolvedValueOnce([{ id: "r1", ...data }]);
      const result = await createDispatchRequest(data as never);
      expect(result).toEqual({ id: "r1", ...data });
    });
  });

  // ── listDispatchQueue ────────────────────────────────────────────────────
  describe("listDispatchQueue", () => {
    it("returns the requests that still need workers, open and partially filled, sorted by requestedDate", async () => {
      const rows = [
        { id: "r1", orgId: "org-1", status: "open" },
        { id: "r2", orgId: "org-1", status: "partially_filled" },
      ];
      mocks.mockOrderBy.mockResolvedValueOnce(rows);
      const result = await listDispatchQueue("org-1");
      expect(result).toEqual(rows);
      const condition = mocks.mockWhere.mock.calls.at(-1)?.[0] as { a: unknown[] };
      expect(condition.a).toContainEqual({ _type: "inArray", c: "status", v: ["open", "partially_filled"] });
    });
  });

  // ── loadDispatchRules ────────────────────────────────────────────────────
  describe("loadDispatchRules", () => {
    it("returns rules sorted by priority desc", async () => {
      const rules = [
        { orgId: "org-1", ruleType: "seniority", priority: 2 },
        { orgId: "org-1", ruleType: "availability", priority: 1 },
      ];
      mocks.mockOrderBy.mockResolvedValueOnce(rules);
      const result = await loadDispatchRules("org-1");
      expect(result).toEqual(rules);
    });
  });

  // ── rankCandidates ───────────────────────────────────────────────────────
  describe("rankCandidates", () => {
    function chainSelects(requestRows: unknown[], ruleRows: unknown[], memberRows: unknown[]) {
      let call = 0;
      mocks.mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return { from: () => ({ where: vi.fn().mockResolvedValue(requestRows) }) };
        if (call === 2) return { from: () => ({ where: () => ({ orderBy: vi.fn().mockResolvedValue(ruleRows) }) }) };
        return { from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue(memberRows) }) }) };
      });
    }

    it("ranks the organization's active members by recorded seniority (DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED)", async () => {
      chainSelects(
        [{ id: "req-1", orgId: "org-1", requiredSkills: ["welding"], requestedWorkers: 1 }],
        [{ ruleType: "seniority", ruleDefinition: {}, priority: 1 }],
        [{ id: "m1", name: "A", seniority: 2 }, { id: "m2", name: "B", seniority: 10 }],
      );
      const ranking = await rankCandidates("org-1", "req-1");
      expect(ranking.status).toBe("ranked");
      expect(ranking.candidates.map((c) => c.memberId)).toEqual(["m2", "m1"]);
      // Nothing records skills or availability: candidates carry null, never an assumed value.
      expect(ranking.candidates[0]).toMatchObject({ skills: null, available: null });
    });

    it("is unranked when the configured rules need data nothing records", async () => {
      chainSelects(
        [{ id: "req-1", orgId: "org-1", requiredSkills: null, requestedWorkers: 1 }],
        [{ ruleType: "availability", ruleDefinition: {}, priority: 1 }],
        [{ id: "m1", name: "A", seniority: 5 }],
      );
      const ranking = await rankCandidates("org-1", "req-1");
      expect(ranking.status).toBe("unranked");
      expect(ranking.candidates[0].rank).toBeNull();
    });

    it("throws when request not found", async () => {
      chainSelects([], [], []);
      await expect(rankCandidates("org-1", "nonexistent")).rejects.toThrow("Dispatch request not found.");
    });
  });

  // ── assignWorkersToDispatch ──────────────────────────────────────────────
  // The assignment (request ownership and state, active membership, duplicates, capacity, the row lock and the filled status) is proven
  // against real SQL in app/api/__tests__/dispatch-assignment.pglite.test.ts. The three tests that stood here asserted the same
  // behaviour through chained mocks that cannot express those queries, and were replaced by it.
});
