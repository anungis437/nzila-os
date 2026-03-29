/**
 * Case Timeline Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([{ updateId: "u1" }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockSend = vi.fn().mockResolvedValue(undefined);

  return {
    mockDb: {
      select: mockSelect, insert: mockInsert,
      query: {
        users: { findFirst: vi.fn() },
      },
    },
    mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit,
    mockReturning, mockValues, mockInsert,
    mockSend,
    mockDetectSignals: vi.fn().mockReturnValue([]),
  };
});

vi.mock("@/db/db", () => ({ db: mocks.mockDb }));
vi.mock("@/db/schema", () => ({
  claimUpdates: { claimId: "claimId", visibilityScope: "visibilityScope", createdAt: "createdAt", updateId: "updateId", updateType: "updateType" },
  grievanceTransitions: { claimId: "claimId", visibilityScope: "visibilityScope", transitionedAt: "transitionedAt", id: "id" },
  claims: { claimId: "claimId", organizationId: "organizationId", memberId: "memberId" },
  organizationMembers: { userId: "userId", name: "name" },
  users: { userId: "userId", email: "email" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c, v) => ({ _type: "eq", v })),
  and: vi.fn((...a: unknown[]) => ({ _type: "and", a })),
  inArray: vi.fn((_c, v) => ({ _type: "inArray", v })),
  desc: vi.fn((c) => ({ _type: "desc", c })),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../lro-signals", () => ({ detectSignals: mocks.mockDetectSignals }));
vi.mock("@/lib/services/notification-service", () => ({
  NotificationService: vi.fn().mockImplementation(() => ({ send: mocks.mockSend })),
}));

import { getMemberVisibleTimeline, getLroVisibleTimeline, addCaseEvent, getVisibleScopesForRole } from "../case-timeline-service";

describe("case-timeline-service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getMemberVisibleTimeline ──────────────────────────────────────────────
  describe("getMemberVisibleTimeline", () => {
    it("returns member-scoped events sorted by timestamp desc", async () => {
      // claim select
      const claimLimit = vi.fn().mockResolvedValue([{ claimId: "c1", memberId: "m1" }]);
      const claimWhere = vi.fn().mockReturnValue({ limit: claimLimit });
      const claimFrom = vi.fn().mockReturnValue({ where: claimWhere });

      // updates select
      const updatesOrderBy = vi.fn().mockResolvedValue([
        { updateId: "u1", createdAt: new Date("2026-01-02"), message: "Ack", createdBy: "staff-1", visibilityScope: "member", metadata: {} },
        { updateId: "u2", createdAt: new Date("2026-01-01"), message: "Filed", createdBy: "m1", visibilityScope: "member", metadata: {} },
      ]);
      const updatesWhere = vi.fn().mockReturnValue({ orderBy: updatesOrderBy });
      const updatesFrom = vi.fn().mockReturnValue({ where: updatesWhere });

      let n = 0;
      mocks.mockDb.select.mockImplementation(() => {
        n++;
        return n === 1 ? { from: claimFrom } : { from: updatesFrom };
      });

      const events = await getMemberVisibleTimeline("c1", "m1");
      expect(events).toHaveLength(2);
      expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(events[1].timestamp.getTime());
    });

    it("throws when claim not found", async () => {
      const claimLimit = vi.fn().mockResolvedValue([]);
      const claimWhere = vi.fn().mockReturnValue({ limit: claimLimit });
      const claimFrom = vi.fn().mockReturnValue({ where: claimWhere });
      mocks.mockDb.select.mockReturnValue({ from: claimFrom });

      await expect(getMemberVisibleTimeline("c1", "m1")).rejects.toThrow("Claim not found");
    });
  });

  // ── getLroVisibleTimeline ────────────────────────────────────────────────
  describe("getLroVisibleTimeline", () => {
    it("returns combined updates and transitions", async () => {
      // claim
      const claimLimit = vi.fn().mockResolvedValue([{ claimId: "c1", organizationId: "org-1" }]);
      const claimWhere = vi.fn().mockReturnValue({ limit: claimLimit });
      const claimFrom = vi.fn().mockReturnValue({ where: claimWhere });

      // updates
      const updatesOrderBy = vi.fn().mockResolvedValue([
        { updateId: "u1", createdAt: new Date("2026-01-02"), message: "Update", createdBy: "s1", visibilityScope: "member", metadata: {} },
      ]);
      const updatesWhere = vi.fn().mockReturnValue({ orderBy: updatesOrderBy });
      const updatesFrom = vi.fn().mockReturnValue({ where: updatesWhere });

      // transitions
      const transOrderBy = vi.fn().mockResolvedValue([
        { id: "t1", transitionedAt: new Date("2026-01-01"), reason: "Stage changed", transitionedBy: "s1", visibilityScope: "staff", fromStageId: "a", toStageId: "b", notes: null },
      ]);
      const transWhere = vi.fn().mockReturnValue({ orderBy: transOrderBy });
      const transFrom = vi.fn().mockReturnValue({ where: transWhere });

      let n = 0;
      mocks.mockDb.select.mockImplementation(() => {
        n++;
        if (n === 1) return { from: claimFrom };
        if (n === 2) return { from: updatesFrom };
        return { from: transFrom };
      });

      const events = await getLroVisibleTimeline("c1", "org-1");
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("update");
      expect(events[1].type).toBe("transition");
    });

    it("throws when claim not found", async () => {
      const claimLimit = vi.fn().mockResolvedValue([]);
      const claimWhere = vi.fn().mockReturnValue({ limit: claimLimit });
      const claimFrom = vi.fn().mockReturnValue({ where: claimWhere });
      mocks.mockDb.select.mockReturnValue({ from: claimFrom });

      await expect(getLroVisibleTimeline("c1", "org-1")).rejects.toThrow("Claim not found");
    });

    it("throws when claim does not belong to org", async () => {
      const claimLimit = vi.fn().mockResolvedValue([{ claimId: "c1", organizationId: "other-org" }]);
      const claimWhere = vi.fn().mockReturnValue({ limit: claimLimit });
      const claimFrom = vi.fn().mockReturnValue({ where: claimWhere });
      mocks.mockDb.select.mockReturnValue({ from: claimFrom });

      await expect(getLroVisibleTimeline("c1", "org-1")).rejects.toThrow("Claim does not belong to this organization");
    });
  });

  // ── addCaseEvent ─────────────────────────────────────────────────────────
  describe("addCaseEvent", () => {
    beforeEach(() => {
      // Setup for recomputeSignalsForCase: needs 3+ selects after insert
      const claimLimit = vi.fn().mockResolvedValue([
        { claimId: "c1", memberId: "m1", organizationId: "org-1", description: "Test", status: "open", priority: "medium", createdAt: new Date(), updatedAt: new Date(), assignedTo: null },
      ]);
      const claimWhere = vi.fn().mockReturnValue({ limit: claimLimit });
      const claimFrom = vi.fn().mockReturnValue({ where: claimWhere });

      const updatesOrderBy = vi.fn().mockResolvedValue([]);
      const updatesWhere = vi.fn().mockReturnValue({ orderBy: updatesOrderBy });
      const updatesFrom = vi.fn().mockReturnValue({ where: updatesWhere });

      const memberLimit = vi.fn().mockResolvedValue([{ name: "Jane Doe" }]);
      const memberWhere = vi.fn().mockReturnValue({ limit: memberLimit });
      const memberFrom = vi.fn().mockReturnValue({ where: memberWhere });

      let n = 0;
      mocks.mockDb.select.mockImplementation(() => {
        n++;
        if (n === 1) return { from: claimFrom };
        if (n === 2) return { from: updatesFrom };
        return { from: memberFrom };
      });
    });

    it("auto-assigns staff scope for internal events", async () => {
      const result = await addCaseEvent({
        claimId: "c1",
        updateType: "internal_note",
        message: "Internal",
        createdBy: "staff-1",
        isInternal: true,
      });
      expect(result).toBe("u1");
    });

    it("auto-assigns member scope for status_change", async () => {
      const result = await addCaseEvent({
        claimId: "c1",
        updateType: "status_change",
        message: "Status changed",
        createdBy: "staff-1",
      });
      expect(result).toBe("u1");
    });

    it("auto-assigns member scope for member_communication", async () => {
      const result = await addCaseEvent({
        claimId: "c1",
        updateType: "member_communication",
        message: "Reply to member",
        createdBy: "staff-1",
      });
      expect(result).toBe("u1");
    });

    it("auto-assigns admin scope for admin_ prefixed types", async () => {
      const result = await addCaseEvent({
        claimId: "c1",
        updateType: "admin_override",
        message: "Override",
        createdBy: "admin-1",
      });
      expect(result).toBe("u1");
    });

    it("defaults to staff scope for unknown types", async () => {
      const result = await addCaseEvent({
        claimId: "c1",
        updateType: "unknown_type",
        message: "Something",
        createdBy: "staff-1",
      });
      expect(result).toBe("u1");
    });

    it("uses explicit visibilityScope when provided", async () => {
      const result = await addCaseEvent({
        claimId: "c1",
        updateType: "custom",
        message: "Custom",
        createdBy: "staff-1",
        visibilityScope: "system",
      });
      expect(result).toBe("u1");
    });
  });

  // ── getVisibleScopesForRole (PURE FUNCTION) ──────────────────────────────
  describe("getVisibleScopesForRole", () => {
    it("member sees only member scope", () => {
      expect(getVisibleScopesForRole("member")).toEqual(["member"]);
    });

    it("steward sees member + staff", () => {
      expect(getVisibleScopesForRole("steward")).toEqual(["member", "staff"]);
    });

    it("officer sees member + staff", () => {
      expect(getVisibleScopesForRole("officer")).toEqual(["member", "staff"]);
    });

    it("staff sees member + staff", () => {
      expect(getVisibleScopesForRole("staff")).toEqual(["member", "staff"]);
    });

    it("admin sees member + staff + admin", () => {
      expect(getVisibleScopesForRole("admin")).toEqual(["member", "staff", "admin"]);
    });

    it("administrator sees member + staff + admin", () => {
      expect(getVisibleScopesForRole("administrator")).toEqual(["member", "staff", "admin"]);
    });

    it("system sees all scopes", () => {
      expect(getVisibleScopesForRole("system")).toEqual(["member", "staff", "admin", "system"]);
    });

    it("defaults to member for unknown role", () => {
      expect(getVisibleScopesForRole("unknown")).toEqual(["member"]);
    });

    it("is case-insensitive", () => {
      expect(getVisibleScopesForRole("ADMIN")).toEqual(["member", "staff", "admin"]);
      expect(getVisibleScopesForRole("Member")).toEqual(["member"]);
    });
  });
});
