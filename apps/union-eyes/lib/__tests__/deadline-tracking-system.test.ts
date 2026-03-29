/**
 * Deadline Tracking System — Unit Tests
 *
 * Covers all 9 exported functions + DEFAULT_DEADLINE_RULES constant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockFindFirstClaims: vi.fn(),
  mockFindFirstDeadlines: vi.fn(),
  mockFindManyDeadlines: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateWhere: vi.fn(),
}));

vi.mock("@/db/db", () => ({
  db: {
    query: {
      claims: { findFirst: mocks.mockFindFirstClaims },
      grievanceDeadlines: {
        findFirst: mocks.mockFindFirstDeadlines,
        findMany: mocks.mockFindManyDeadlines,
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.mockUpdateWhere,
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  grievanceDeadlines: {
    id: "id",
    grievanceId: "grievanceId",
    deadlineType: "deadlineType",
    dueDate: "dueDate",
    status: "status",
    notes: "notes",
  },
  claims: { claimId: "claimId", organizationId: "organizationId" },
  notifications: {
    relatedEntityId: "relatedEntityId",
    type: "type",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  asc: vi.fn((a: unknown) => a),
  lte: vi.fn((...a: unknown[]) => a),
}));

vi.mock("date-fns", () => ({
  addDays: vi.fn((d: Date, n: number) => new Date(d.getTime() + n * 86400000)),
  addBusinessDays: vi.fn((d: Date, n: number) => new Date(d.getTime() + n * 86400000)),
  differenceInDays: vi.fn((_a: Date, _b: Date) => 5),
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  DEFAULT_DEADLINE_RULES,
  createDeadline,
  createGrievanceStepDeadlines,
  completeDeadline,
  requestDeadlineExtension,
  approveDeadlineExtension,
  getUpcomingDeadlines,
  getOverdueDeadlines,
  getGrievanceDeadlines,
  escalateMissedDeadlines,
} from "../deadline-tracking-system";

/* ── tests ──────────────────────────────────────────────────────────── */

describe("deadline-tracking-system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFindFirstClaims.mockResolvedValue(undefined);
    mocks.mockFindFirstDeadlines.mockResolvedValue(undefined);
    mocks.mockFindManyDeadlines.mockResolvedValue([]);
    mocks.mockInsertReturning.mockResolvedValue([{ id: "dl-1" }]);
    mocks.mockUpdateWhere.mockResolvedValue([]);
  });

  // ── DEFAULT_DEADLINE_RULES ───────────────────────────────────────
  describe("DEFAULT_DEADLINE_RULES", () => {
    it("has at least 7 rules", () => {
      expect(DEFAULT_DEADLINE_RULES.length).toBeGreaterThanOrEqual(7);
    });

    it("includes filing_deadline at 30 business days", () => {
      const rule = DEFAULT_DEADLINE_RULES.find((r) => r.type === "filing_deadline");
      expect(rule).toBeDefined();
      expect(rule!.businessDays).toBe(30);
      expect(rule!.priority).toBe("critical");
    });

    it("includes step_1_response at 10 business days", () => {
      const rule = DEFAULT_DEADLINE_RULES.find((r) => r.type === "step_1_response");
      expect(rule).toBeDefined();
      expect(rule!.businessDays).toBe(10);
    });

    it("each rule has a non-empty reminderSchedule", () => {
      for (const rule of DEFAULT_DEADLINE_RULES) {
        expect(rule.reminderSchedule.length).toBeGreaterThan(0);
      }
    });
  });

  // ── createDeadline ────────────────────────────────────────────────
  describe("createDeadline", () => {
    it("returns error if claim not found", async () => {
      const r = await createDeadline("c-1", "org-1", "filing_deadline");
      expect(r.success).toBe(false);
      expect(r.error).toContain("Claim not found");
    });

    it("returns error if no rule and no customDays", async () => {
      mocks.mockFindFirstClaims.mockResolvedValueOnce({ claimId: "c-1" });
      const r = await createDeadline("c-1", "org-1", "custom");
      expect(r.success).toBe(false);
      expect(r.error).toContain("No rule found");
    });

    it("creates deadline with matching rule (business days)", async () => {
      mocks.mockFindFirstClaims.mockResolvedValueOnce({ claimId: "c-1" });
      mocks.mockInsertReturning.mockResolvedValueOnce([{ id: "dl-1" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders

      const r = await createDeadline("c-1", "org-1", "filing_deadline");
      expect(r.success).toBe(true);
      expect(r.deadlineId).toBe("dl-1");
      expect(r.dueDate).toBeInstanceOf(Date);
    });

    it("creates deadline with customDays and calendar mode", async () => {
      mocks.mockFindFirstClaims.mockResolvedValueOnce({ claimId: "c-1" });
      mocks.mockInsertReturning.mockResolvedValueOnce([{ id: "dl-2" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-2" });

      const r = await createDeadline("c-1", "org-1", "custom", {
        customDays: 14,
        useBusinessDays: false,
      });
      expect(r.success).toBe(true);
      expect(r.deadlineId).toBe("dl-2");
    });

    it("handles db error gracefully", async () => {
      mocks.mockFindFirstClaims.mockRejectedValueOnce(new Error("DB error"));
      const r = await createDeadline("c-1", "org-1", "filing_deadline");
      expect(r.success).toBe(false);
      expect(r.error).toBe("DB error");
    });
  });

  // ── createGrievanceStepDeadlines ──────────────────────────────────
  describe("createGrievanceStepDeadlines", () => {
    it("creates step deadlines when claim exists", async () => {
      mocks.mockFindFirstClaims.mockResolvedValue({ claimId: "c-1" });
      mocks.mockInsertReturning.mockResolvedValue([{ id: "dl-new" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-new" });

      const r = await createGrievanceStepDeadlines("c-1", "org-1", new Date(), new Date());
      expect(r.success).toBe(true);
      expect(r.deadlineIds.length).toBeGreaterThanOrEqual(1);
    });

    it("returns success with empty IDs when createDeadline fails internally", async () => {
      // createDeadline catches errors internally, so createGrievanceStepDeadlines
      // still returns success: true but with empty deadlineIds
      mocks.mockFindFirstClaims.mockResolvedValue(undefined);
      const r = await createGrievanceStepDeadlines("c-1", "org-1", new Date(), new Date());
      expect(r.success).toBe(true);
      expect(r.deadlineIds).toEqual([]);
    });
  });

  // ── completeDeadline ──────────────────────────────────────────────
  describe("completeDeadline", () => {
    it("completes successfully", async () => {
      const r = await completeDeadline("dl-1", "org-1", "user-1", "Done");
      expect(r.success).toBe(true);
    });

    it("handles error", async () => {
      mocks.mockUpdateWhere.mockRejectedValueOnce(new Error("update failed"));
      const r = await completeDeadline("dl-1", "org-1", "user-1");
      expect(r.success).toBe(false);
    });
  });

  // ── requestDeadlineExtension ──────────────────────────────────────
  describe("requestDeadlineExtension", () => {
    it("returns error if deadline not found", async () => {
      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Need more time",
        requiresApproval: false,
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain("Deadline not found");
    });

    it("applies extension immediately when no approval required", async () => {
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({ id: "dl-1", reminderDays: [7, 3, 1] })
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders
      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Need more time",
        requiresApproval: false,
      });
      expect(r.success).toBe(true);
    });

    it("saves note when approval required", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1" });
      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Need more time",
        requiresApproval: true,
      });
      expect(r.success).toBe(true);
    });
  });

  // ── approveDeadlineExtension ──────────────────────────────────────
  describe("approveDeadlineExtension", () => {
    it("returns error if deadline not found", async () => {
      const r = await approveDeadlineExtension("dl-1", "admin-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("Deadline not found");
    });

    it("returns error if no pending extension", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({
        id: "dl-1",
        notes: "Some other note",
      });
      const r = await approveDeadlineExtension("dl-1", "admin-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("No pending extension");
    });

    it("approves pending extension", async () => {
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({
          id: "dl-1",
          notes: "Extension requested by user-1: Need more time.",
          newDeadline: new Date(),
          reminderDays: [7, 3, 1],
        })
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders
      const r = await approveDeadlineExtension("dl-1", "admin-1");
      expect(r.success).toBe(true);
    });
  });

  // ── getUpcomingDeadlines ──────────────────────────────────────────
  describe("getUpcomingDeadlines", () => {
    it("returns mapped alerts", async () => {
      mocks.mockFindManyDeadlines.mockResolvedValueOnce([
        {
          id: "dl-1",
          grievanceId: "c-1",
          deadlineType: "filing_deadline",
          dueDate: new Date(Date.now() + 5 * 86400000),
          description: "File grievance",
        },
      ]);
      const alerts = await getUpcomingDeadlines("org-1");
      expect(alerts).toHaveLength(1);
      expect(alerts[0].deadlineId).toBe("dl-1");
      expect(alerts[0].status).toBe("upcoming");
    });

    it("returns empty on error", async () => {
      mocks.mockFindManyDeadlines.mockRejectedValueOnce(new Error("fail"));
      expect(await getUpcomingDeadlines("org-1")).toEqual([]);
    });
  });

  // ── getOverdueDeadlines ───────────────────────────────────────────
  describe("getOverdueDeadlines", () => {
    it("returns mapped alerts", async () => {
      mocks.mockFindManyDeadlines.mockResolvedValueOnce([
        {
          id: "dl-2",
          grievanceId: "c-2",
          deadlineType: "step_1_response",
          dueDate: new Date(Date.now() - 86400000),
          description: "Response due",
        },
      ]);
      const alerts = await getOverdueDeadlines("org-1");
      expect(alerts).toHaveLength(1);
    });

    it("returns empty on error", async () => {
      mocks.mockFindManyDeadlines.mockRejectedValueOnce(new Error("fail"));
      expect(await getOverdueDeadlines("org-1")).toEqual([]);
    });
  });

  // ── getGrievanceDeadlines ─────────────────────────────────────────
  describe("getGrievanceDeadlines", () => {
    it("returns deadlines for claim", async () => {
      mocks.mockFindManyDeadlines.mockResolvedValueOnce([{ id: "dl-1", grievanceId: "c-1" }]);
      const deadlines = await getGrievanceDeadlines("c-1", "org-1");
      expect(deadlines).toHaveLength(1);
    });

    it("returns empty on error", async () => {
      mocks.mockFindManyDeadlines.mockRejectedValueOnce(new Error("fail"));
      expect(await getGrievanceDeadlines("c-1", "org-1")).toEqual([]);
    });
  });

  // ── escalateMissedDeadlines ───────────────────────────────────────
  describe("escalateMissedDeadlines", () => {
    it("escalates overdue deadlines and returns count", async () => {
      mocks.mockFindManyDeadlines.mockResolvedValueOnce([
        {
          id: "dl-1",
          grievanceId: "c-1",
          deadlineType: "filing_deadline",
          dueDate: new Date(Date.now() - 86400000),
          description: "Late",
        },
      ]);
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-1" }); // sendEscalationNotification
      const count = await escalateMissedDeadlines("org-1");
      expect(count).toBe(1);
    });

    it("returns 0 on error", async () => {
      mocks.mockFindManyDeadlines.mockRejectedValueOnce(new Error("fail"));
      expect(await escalateMissedDeadlines("org-1")).toBe(0);
    });
  });
});
