/**
 * Dispatch Engine — Unit Tests
 * calculateDispatchPriority is a PURE function (no DB) — tested directly.
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
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: unknown[]) => ({ _type: "and", a })),
  asc: vi.fn((c) => ({ _type: "asc", c })),
  desc: vi.fn((c) => ({ _type: "desc", c })),
}));

import {
  calculateDispatchPriority,
  createDispatchRequest,
  listDispatchQueue,
  loadDispatchRules,
  rankCandidates,
  assignWorkersToDispatch,
  type MemberCandidate,
} from "../dispatch-engine";

describe("dispatch-engine", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── PURE FUNCTION: calculateDispatchPriority ─────────────────────────────
  describe("calculateDispatchPriority", () => {
    const baseCandidate: MemberCandidate = {
      memberId: "m1",
      skills: ["welding", "electrical"],
      seniorityYears: 5,
      available: true,
    };

    it("scores seniority rule correctly", () => {
      const rules = [{ ruleType: "seniority" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      // 5 years * 5 * 1 = 25
      expect(score).toBe(25);
    });

    it("scores seniority with weight", () => {
      const rules = [{ ruleType: "seniority" as const, ruleDefinition: {}, priority: 3 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      // 5 * 5 * 3 = 75
      expect(score).toBe(75);
    });

    it("scores availability rule – available", () => {
      const rules = [{ ruleType: "availability" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      // 30 * 1 = 30
      expect(score).toBe(30);
    });

    it("scores availability rule – not available", () => {
      const rules = [{ ruleType: "availability" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(
        { ...baseCandidate, available: false },
        [],
        rules
      );
      expect(score).toBe(0);
    });

    it("scores skills_match with full match", () => {
      const rules = [{ ruleType: "skills_match" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(
        baseCandidate,
        ["welding", "electrical"],
        rules
      );
      // ratio 1.0 * 40 * 1 = 40
      expect(score).toBe(40);
    });

    it("scores skills_match with partial match", () => {
      const rules = [{ ruleType: "skills_match" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(baseCandidate, ["welding", "plumbing"], rules);
      // 1/2 * 40 = 20
      expect(score).toBe(20);
    });

    it("scores skills_match with no required skills → ratio 1", () => {
      const rules = [{ ruleType: "skills_match" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      // ratio=1 → 40
      expect(score).toBe(40);
    });

    it("scores skills_match case-insensitively", () => {
      const rules = [{ ruleType: "skills_match" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(baseCandidate, ["WELDING"], rules);
      // 1/1 * 40 = 40
      expect(score).toBe(40);
    });

    it("scores rotation rule – flat 10 * weight", () => {
      const rules = [{ ruleType: "rotation" as const, ruleDefinition: {}, priority: 2 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      expect(score).toBe(20);
    });

    it("scores geographic_proximity rule – flat 5 * weight", () => {
      const rules = [{ ruleType: "geographic_proximity" as const, ruleDefinition: {}, priority: 1 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      expect(score).toBe(5);
    });

    it("combines multiple rules", () => {
      const rules = [
        { ruleType: "seniority" as const, ruleDefinition: {}, priority: 1 },
        { ruleType: "availability" as const, ruleDefinition: {}, priority: 1 },
        { ruleType: "skills_match" as const, ruleDefinition: {}, priority: 1 },
      ];
      const score = calculateDispatchPriority(
        baseCandidate,
        ["welding"],
        rules
      );
      // seniority: 25, availability: 30, skills: 1/1*40=40 → 95
      expect(score).toBe(95);
    });

    it("returns 0 when score would be negative (clamp)", () => {
      // With no rules, score stays 0
      const score = calculateDispatchPriority(baseCandidate, [], []);
      expect(score).toBe(0);
    });

    it("uses priority 1 when priority is 0 (falsy)", () => {
      const rules = [{ ruleType: "seniority" as const, ruleDefinition: {}, priority: 0 }];
      const score = calculateDispatchPriority(baseCandidate, [], rules);
      // priority defaults to 1 when 0 (falsy): 5*5*1 = 25
      expect(score).toBe(25);
    });
  });

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
    it("returns open requests for an org sorted by requestedDate", async () => {
      const rows = [{ id: "r1", orgId: "org-1", status: "open" }];
      mocks.mockOrderBy.mockResolvedValueOnce(rows);
      const result = await listDispatchQueue("org-1");
      expect(result).toEqual(rows);
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
    it("scores and sorts candidates by score desc", async () => {
      // First select → dispatch request
      const requestWhere = vi.fn().mockResolvedValue([
        { id: "req-1", orgId: "org-1", requiredSkills: ["welding"], requestedWorkers: 1 },
      ]);
      const requestFrom = vi.fn().mockReturnValue({ where: requestWhere });

      // Second select → dispatch rules
      const rulesOrderBy = vi.fn().mockResolvedValue([
        { ruleType: "seniority", ruleDefinition: {}, priority: 1 },
      ]);
      const rulesWhere = vi.fn().mockReturnValue({ orderBy: rulesOrderBy });
      const rulesFrom = vi.fn().mockReturnValue({ where: rulesWhere });

      let callCount = 0;
      mocks.mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: requestFrom };
        return { from: rulesFrom };
      });

      const candidates: MemberCandidate[] = [
        { memberId: "m1", skills: ["welding"], seniorityYears: 2, available: true },
        { memberId: "m2", skills: ["welding"], seniorityYears: 10, available: true },
      ];

      const ranked = await rankCandidates("org-1", "req-1", candidates);
      expect(ranked[0].memberId).toBe("m2"); // higher seniority
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });

    it("throws when request not found", async () => {
      const requestWhere = vi.fn().mockResolvedValue([]);
      const requestFrom = vi.fn().mockReturnValue({ where: requestWhere });
      mocks.mockDb.select.mockReturnValue({ from: requestFrom });

      await expect(
        rankCandidates("org-1", "nonexistent", [])
      ).rejects.toThrow("Dispatch request not found.");
    });
  });

  // ── assignWorkersToDispatch ──────────────────────────────────────────────
  describe("assignWorkersToDispatch", () => {
    it("inserts assignments and updates request status", async () => {
      const assignments = [
        { requestId: "r1", memberId: "m1", status: "offered" },
        { requestId: "r1", memberId: "m2", status: "offered" },
      ];
      mocks.mockReturning.mockResolvedValueOnce(assignments);

      // select for request fetch
      const requestWhere = vi.fn().mockResolvedValue([
        { id: "r1", requestedWorkers: 2 },
      ]);
      const requestFrom = vi.fn().mockReturnValue({ where: requestWhere });
      mocks.mockDb.select.mockReturnValue({ from: requestFrom });

      const setWhere = vi.fn().mockResolvedValue(undefined);
      const setFn = vi.fn().mockReturnValue({ where: setWhere });
      mocks.mockDb.update.mockReturnValue({ set: setFn });

      const result = await assignWorkersToDispatch("r1", ["m1", "m2"]);
      expect(result).toEqual(assignments);
    });

    it("sets partially_filled when fewer workers than requested", async () => {
      mocks.mockReturning.mockResolvedValueOnce([{ requestId: "r1", memberId: "m1" }]);
      const requestWhere = vi.fn().mockResolvedValue([
        { id: "r1", requestedWorkers: 5 },
      ]);
      const requestFrom = vi.fn().mockReturnValue({ where: requestWhere });
      mocks.mockDb.select.mockReturnValue({ from: requestFrom });

      const setWhere = vi.fn().mockResolvedValue(undefined);
      const setFn = vi.fn().mockReturnValue({ where: setWhere });
      mocks.mockDb.update.mockReturnValue({ set: setFn });

      await assignWorkersToDispatch("r1", ["m1"]);
      expect(setFn).toHaveBeenCalledWith(expect.objectContaining({ status: "partially_filled" }));
    });
  });
});
