/**
 * Claims Service — Unit Tests
 * Exercises REAL production code with only true external deps mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockWhere = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockOrderBy = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: mockOffset }) });
  const mockFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }),
      }),
    }),
  });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
  });
  const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

  return {
    mockDb: {
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
      update: vi.fn(),
      query: {
        claims: { findFirst: vi.fn() },
      },
    },
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockLimit,
    mockOffset,
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema", () => ({
  claims: {
    organizationId: "organizationId",
    status: "status",
    priority: "priority",
    claimType: "claimType",
    description: "description",
    createdAt: "createdAt",
    claimId: "claimId",
  },
  claimUpdates: {
    claimId: "claimId",
    createdAt: "createdAt",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ _type: "eq", val })),
  and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
  desc: vi.fn((col) => ({ _type: "desc", col })),
  sql: Object.assign(vi.fn(), {
    join: vi.fn(),
    raw: vi.fn(),
  }),
  like: vi.fn((_col, val) => ({ _type: "like", val })),
}));

// ── Import SUT ───────────────────────────────────────────────────────────────
import { listClaims, getClaimById, listClaimUpdates } from "../claims-service";

describe("claims-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listClaims ───────────────────────────────────────────────────────────
  describe("listClaims", () => {
    it("returns paginated claims with default pagination", async () => {
      const mockRows = [{ claimId: "c1" }];
      // First select() call → count query
      const countFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      });
      // Second select() call → data query
      const dataOffset = vi.fn().mockResolvedValue(mockRows);
      const dataLimit = vi.fn().mockReturnValue({ offset: dataOffset });
      const dataOrderBy = vi.fn().mockReturnValue({ limit: dataLimit });
      const dataWhere = vi.fn().mockReturnValue({ orderBy: dataOrderBy });
      const dataFrom = vi.fn().mockReturnValue({ where: dataWhere });

      let callCount = 0;
      mocks.mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: countFrom };
        return { from: dataFrom };
      });

      const result = await listClaims();
      expect(result).toEqual({ claims: mockRows, total: 1, page: 1, limit: 20 });
    });

    it("applies all filters when provided", async () => {
      const countFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });
      const dataFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      let callCount = 0;
      mocks.mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: countFrom };
        return { from: dataFrom };
      });

      const result = await listClaims(
        {
          organizationId: "org-1",
          status: "open",
          priority: "high",
          claimType: "grievance",
          search: "test",
        },
        { page: 2, limit: 10 }
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it("handles no filters (empty conditions)", async () => {
      const countFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      });
      const dataFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([{ claimId: "c1" }]),
            }),
          }),
        }),
      });
      let callCount = 0;
      mocks.mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { from: countFrom };
        return { from: dataFrom };
      });

      const result = await listClaims({});
      expect(result.total).toBe(5);
    });
  });

  // ── getClaimById ─────────────────────────────────────────────────────────
  describe("getClaimById", () => {
    it("returns a claim when found", async () => {
      const claim = { claimId: "c1", description: "Test" };
      mocks.mockDb.query.claims.findFirst.mockResolvedValue(claim);

      const result = await getClaimById("c1");
      expect(result).toEqual(claim);
    });

    it("returns undefined when not found", async () => {
      mocks.mockDb.query.claims.findFirst.mockResolvedValue(undefined);

      const result = await getClaimById("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  // ── listClaimUpdates ─────────────────────────────────────────────────────
  describe("listClaimUpdates", () => {
    it("returns updates for a claim ordered by createdAt desc", async () => {
      const updates = [{ updateId: "u1" }, { updateId: "u2" }];
      const mockOrderBy = vi.fn().mockResolvedValue(updates);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mocks.mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await listClaimUpdates("c1");
      expect(result).toEqual(updates);
    });
  });
});
