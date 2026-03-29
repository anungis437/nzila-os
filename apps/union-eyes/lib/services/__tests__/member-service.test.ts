/**
 * Member Service — Unit Tests
 *
 * Covers all 16 exported functions with correct drizzle mock chains.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted mocks ──────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => {
  const mockFindFirst = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  return {
    mockDb: {
      query: { organizationMembers: { findFirst: mockFindFirst } },
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
    mockFindFirst,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema", () => ({
  organizationMembers: {
    id: "id", organizationId: "organizationId", userId: "userId",
    membershipNumber: "membershipNumber", status: "status", role: "role",
    department: "department", firstName: "firstName", lastName: "lastName",
    email: "email", phone: "phone", createdAt: "createdAt", updatedAt: "updatedAt",
    deletedAt: "deletedAt", joinedAt: "joinedAt",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: unknown[]) => ({ _type: "and", a })),
  or: vi.fn((...a: unknown[]) => ({ _type: "or", a })),
  gte: vi.fn((_c, v) => ({ _type: "gte", v })),
  lte: vi.fn((_c, v) => ({ _type: "lte", v })),
  desc: vi.fn((c) => ({ _type: "desc", c })),
  asc: vi.fn((c) => ({ _type: "asc", c })),
  like: vi.fn((_c, v) => ({ _type: "like", v })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  inArray: vi.fn((_c, v) => ({ _type: "inArray", v })),
  count: vi.fn(() => "count-call"),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ── helpers ────────────────────────────────────────────────────────────── */

/** select → from → where (terminal) */
function sfw(data: unknown) {
  const where = vi.fn().mockResolvedValue(data);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
}

/** select → from → where → orderBy → limit → offset (terminal) */
function sfwolo(data: unknown) {
  const offset = vi.fn().mockResolvedValue(data);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

/** insert → values → returning (terminal) */
function ivr(data: unknown) {
  const returning = vi.fn().mockResolvedValue(data);
  const values = vi.fn().mockReturnValue({ returning });
  return { values, returning };
}

/** update → set → where → returning (terminal) */
function uswr(data: unknown) {
  const returning = vi.fn().mockResolvedValue(data);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where, returning };
}

/** update → set → where (terminal, no returning) */
function usw() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

/** delete → where (terminal) */
function dw() {
  const where = vi.fn().mockResolvedValue(undefined);
  return { where };
}

/* ── imports ────────────────────────────────────────────────────────────── */

import {
  getMemberById, getMemberByUserId, getMemberByMembershipNumber,
  listMembers, createMember, updateMember, deleteMember,
  permanentlyDeleteMember, bulkImportMembers,
  bulkUpdateMemberStatus, bulkUpdateMemberRole,
  searchMembers, getMemberStatistics, mergeMembers,
  calculateSeniority, getMembersByDepartment, getMembersByRole,
} from "../member-service";

/* ── tests ──────────────────────────────────────────────────────────────── */

describe("member-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── findFirst-based lookups ─────────────────────────────────────────
  describe("getMemberById", () => {
    it("returns member when found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ id: "m-1" });
      expect(await getMemberById("m-1")).toEqual({ id: "m-1" });
    });
    it("returns null when not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      expect(await getMemberById("x")).toBeNull();
    });
    it("throws on error", async () => {
      mocks.mockFindFirst.mockRejectedValueOnce(new Error("DB"));
      await expect(getMemberById("x")).rejects.toThrow("Failed to fetch member");
    });
  });

  describe("getMemberByUserId", () => {
    it("returns member", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ id: "m-1", userId: "u1" });
      expect(await getMemberByUserId("u1", "org-1")).toEqual({ id: "m-1", userId: "u1" });
    });
    it("returns null when not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      expect(await getMemberByUserId("u1", "org-1")).toBeNull();
    });
  });

  describe("getMemberByMembershipNumber", () => {
    it("returns member", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ id: "m-1", membershipNumber: "MEM-001" });
      expect(await getMemberByMembershipNumber("MEM-001", "org-1")).toEqual({ id: "m-1", membershipNumber: "MEM-001" });
    });
    it("returns null when not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      expect(await getMemberByMembershipNumber("X", "org-1")).toBeNull();
    });
  });

  // ── listMembers ─────────────────────────────────────────────────────
  describe("listMembers", () => {
    it("returns paginated members with count", async () => {
      const members = [{ id: "m-1" }, { id: "m-2" }];
      let n = 0;
      mocks.mockSelect.mockImplementation(() => {
        n++;
        if (n === 1) return { from: sfw([{ count: 2 }]).from };
        return { from: sfwolo(members).from };
      });
      const result = await listMembers();
      expect(result.members).toEqual(members);
      expect(result.total).toBe(2);
    });
    it("throws on error", async () => {
      mocks.mockSelect.mockImplementation(() => {
        throw new Error("DB");
      });
      await expect(listMembers()).rejects.toThrow();
    });

    it("sorts by createdAt by default when sortBy is unrecognized (Batch 35)", async () => {
      const members = [{ id: "m-1" }];
      let n = 0;
      mocks.mockSelect.mockImplementation(() => {
        n++;
        if (n === 1) return { from: sfw([{ count: 1 }]).from };
        return { from: sfwolo(members).from };
      });
      const result = await listMembers({}, { sortBy: "unknown_field" });
      expect(result.members).toEqual(members);
    });

    it("sorts by hireDate when specified (Batch 35)", async () => {
      const members = [{ id: "m-1" }];
      let n = 0;
      mocks.mockSelect.mockImplementation(() => {
        n++;
        if (n === 1) return { from: sfw([{ count: 1 }]).from };
        return { from: sfwolo(members).from };
      });
      const result = await listMembers({}, { sortBy: "hireDate" });
      expect(result.members).toEqual(members);
    });
  });

  // ── CRUD ────────────────────────────────────────────────────────────
  describe("createMember", () => {
    it("inserts and returns member", async () => {
      const member = { id: "m-new", firstName: "Jane" };
      const chain = ivr([member]);
      mocks.mockInsert.mockReturnValueOnce({ values: chain.values });
      expect(await createMember({ organizationId: "org-1", firstName: "Jane" } as never)).toEqual(member);
    });
    it("throws on insert error", async () => {
      const chain = ivr([]);
      chain.returning.mockRejectedValueOnce(new Error("dup"));
      mocks.mockInsert.mockReturnValueOnce({ values: chain.values });
      await expect(createMember({} as never)).rejects.toThrow();
    });
  });

  describe("updateMember", () => {
    it("returns updated member", async () => {
      const updated = { id: "m-1", lastName: "New" };
      const chain = uswr([updated]);
      mocks.mockUpdate.mockReturnValueOnce({ set: chain.set });
      expect(await updateMember("m-1", { lastName: "New" } as never)).toEqual(updated);
    });
    it("returns null when not found", async () => {
      const chain = uswr([]);
      mocks.mockUpdate.mockReturnValueOnce({ set: chain.set });
      expect(await updateMember("x", {} as never)).toBeNull();
    });
  });

  describe("deleteMember (soft delete)", () => {
    it("returns true on success", async () => {
      const chain = uswr([{ id: "m-1" }]);
      mocks.mockUpdate.mockReturnValueOnce({ set: chain.set });
      expect(await deleteMember("m-1")).toBe(true);
    });
  });

  describe("permanentlyDeleteMember", () => {
    it("returns true", async () => {
      const chain = dw();
      mocks.mockDelete.mockReturnValueOnce({ where: chain.where });
      expect(await permanentlyDeleteMember("m-1")).toBe(true);
    });
  });

  // ── bulk operations ─────────────────────────────────────────────────
  describe("bulkImportMembers", () => {
    it("imports multiple members", async () => {
      const chain = ivr([{ id: "m-1" }]);
      mocks.mockInsert.mockReturnValue({ values: chain.values });
      chain.returning.mockResolvedValue([{ id: "m-1" }]);
      const result = await bulkImportMembers([
        { organizationId: "o1", firstName: "A" } as never,
        { organizationId: "o1", firstName: "B" } as never,
      ]);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it("captures error message during import (Batch 35)", async () => {
      mocks.mockInsert.mockImplementation(() => {
        throw new Error("DB constraint");
      });
      const result = await bulkImportMembers([
        { organizationId: "o1", firstName: "A" } as never,
      ]);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].error).toContain("member");
    });
  });

  describe("bulkUpdateMemberStatus", () => {
    it("updates status for member IDs", async () => {
      const chain = usw();
      mocks.mockUpdate.mockReturnValueOnce({ set: chain.set });
      const result = await bulkUpdateMemberStatus(["m-1", "m-2"], "active");
      expect(result.success).toBe(true);
    });
    it("returns failure on error", async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error("fail"); });
      const result = await bulkUpdateMemberStatus(["m-1"], "active");
      expect(result.success).toBe(false);
    });
  });

  describe("bulkUpdateMemberRole", () => {
    it("updates role for member IDs", async () => {
      const chain = usw();
      mocks.mockUpdate.mockReturnValueOnce({ set: chain.set });
      const result = await bulkUpdateMemberRole(["m-1"], "steward");
      expect(result.success).toBe(true);
    });
  });

  // ── search and statistics ───────────────────────────────────────────
  describe("searchMembers", () => {
    it("returns matching members", async () => {
      const members = [{ id: "m-1", firstName: "Jane" }];
      let n = 0;
      mocks.mockSelect.mockImplementation(() => {
        n++;
        if (n === 1) return { from: sfw([{ count: 1 }]).from };
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(members),
              }),
            }),
          }),
        };
      });
      const result = await searchMembers("org-1", "Jane");
      expect(result.members).toEqual(members);
    });

    it("searches without searchQuery (Batch 35)", async () => {
      const members = [{ id: "m-1" }];
      let n = 0;
      mocks.mockSelect.mockImplementation(() => {
        n++;
        if (n === 1) return { from: sfw([{ count: 1 }]).from };
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(members),
              }),
            }),
          }),
        };
      });
      const result = await searchMembers("org-1");
      expect(result.members).toEqual(members);
    });
  });

  describe("getMemberStatistics", () => {
    it("returns statistics with aggregation", async () => {
      const allMembers = [
        { id: "m-1", status: "active", role: "member", department: "HR" },
        { id: "m-2", status: "active", role: "steward", department: "IT" },
      ];
      const c = sfw(allMembers);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      const result = await getMemberStatistics("org-1");
      expect(result.total).toBe(2);
    });
  });

  // ── merge and seniority ─────────────────────────────────────────────
  describe("mergeMembers", () => {
    it("merges duplicate into primary", async () => {
      const primary = { id: "m-1", firstName: "Jane", email: "j@x.com" };
      const dup = { id: "m-2", firstName: "Jane", email: "j@y.com" };
      // getMemberById calls (findFirst)
      mocks.mockFindFirst
        .mockResolvedValueOnce(primary)
        .mockResolvedValueOnce(dup);
      // updateMember
      const updateChain = uswr([{ ...primary, email: "j@y.com" }]);
      mocks.mockUpdate.mockReturnValueOnce({ set: updateChain.set });
      // deleteMember (soft)
      const deleteChain = uswr([{ id: "m-2" }]);
      mocks.mockUpdate.mockReturnValueOnce({ set: deleteChain.set });

      const result = await mergeMembers("m-1", "m-2", "duplicate");
      expect(result.id).toBe("m-1");
    });
  });

  describe("calculateSeniority", () => {
    it("calculates seniority string", async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 3);
      mocks.mockFindFirst.mockResolvedValueOnce({ id: "m-1", unionJoinDate: pastDate });
      const result = await calculateSeniority("m-1");
      expect(result).toContain("year");
    });
    it("returns N/A when member not found", async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(undefined);
      const result = await calculateSeniority("x");
      expect(result).toBe("N/A");
    });
  });

  // ── role/department queries ─────────────────────────────────────────
  describe("getMembersByDepartment", () => {
    it("returns members in department", async () => {
      const members = [{ id: "m-1", department: "HR" }];
      const c = sfw(members);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      expect(await getMembersByDepartment("org-1", "HR")).toEqual(members);
    });
  });

  describe("getMembersByRole", () => {
    it("returns members with role", async () => {
      const members = [{ id: "m-1", role: "steward" }];
      const c = sfw(members);
      mocks.mockSelect.mockReturnValueOnce({ from: c.from });
      expect(await getMembersByRole("org-1", "steward")).toEqual(members);
    });
  });
});
