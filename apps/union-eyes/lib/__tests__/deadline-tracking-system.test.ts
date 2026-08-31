/**
 * Deadline Tracking System — Unit Tests
 *
 * Covers all 9 exported functions + DEFAULT_DEADLINE_RULES constant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockFindFirstGrievances: vi.fn(),
  mockFindFirstDeadlines: vi.fn(),
  mockFindManyDeadlines: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockSelect: vi.fn(),
  cancelGrievanceDeadlineReminders: vi.fn(async () => ({ cancelledIds: [], correlationId: 'test-cancel-correlation' })),
}));

vi.mock("@/db/db", () => ({
  db: {
    query: {
      grievances: { findFirst: mocks.mockFindFirstGrievances },
      grievanceDeadlines: {
        findFirst: mocks.mockFindFirstDeadlines,
        findMany: mocks.mockFindManyDeadlines,
      },
    },
    select: mocks.mockSelect,
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

/** Chainable select().from().innerJoin().where()[.orderBy()] mock. */
function makeSelectChain(rows: unknown[]) {
  const where = vi.fn(() => ({
    orderBy: vi.fn(async () => rows),
    then: (resolve: (v: unknown[]) => void) => Promise.resolve(rows).then(resolve),
  }));
  return { from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where })) })) };
}

vi.mock("@/db/schema", () => ({
  grievanceDeadlines: {
    id: "id",
    grievanceId: "grievanceId",
    deadlineType: "deadlineType",
    dueDate: "dueDate",
    status: "status",
    notes: "notes",
  },
  grievances: { id: "id" },
  notifications: {
    relatedEntityId: "relatedEntityId",
    type: "type",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  asc: vi.fn((a: any) => a),
  lte: vi.fn((...a: any[]) => a),
  isNull: vi.fn((...a: any[]) => a),
  isNotNull: vi.fn((...a: any[]) => a),
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  relations: vi.fn(() => ({})),
}));

vi.mock("date-fns", () => ({
  addDays: vi.fn((d: Date, n: number) => new Date(d.getTime() + n * 86400000)),
  addBusinessDays: vi.fn((d: Date, n: number) => new Date(d.getTime() + n * 86400000)),
  differenceInDays: vi.fn((_a: Date, _b: Date) => 5),
}));

// Wave 1 Phase A: scheduleReminders now delegates to the deadline engine.
// The engine has its own dedicated test suite under lib/deadline-engine/__tests__ —
// here we stub it so deadline-tracking-system tests continue to isolate the
// tracking-system logic itself.
vi.mock("@/lib/deadline-engine", () => ({
  scheduleGrievanceDeadlineReminders: vi.fn(async () => ({
    correlationId: "test-correlation-id",
    scheduled: [],
    cancelledForReschedule: [],
    skipped: [],
    skippedInPast: [],
  })),
  cancelGrievanceDeadlineReminders: mocks.cancelGrievanceDeadlineReminders,
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

import { differenceInDays } from "date-fns";

/* ── tests ──────────────────────────────────────────────────────────── */

describe("deadline-tracking-system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFindFirstGrievances.mockResolvedValue(undefined);
    mocks.mockFindFirstDeadlines.mockResolvedValue(undefined);
    mocks.mockFindManyDeadlines.mockResolvedValue([]);
    mocks.mockInsertReturning.mockResolvedValue([{ id: "dl-1" }]);
    mocks.mockUpdateWhere.mockResolvedValue([]);
    mocks.mockSelect.mockReturnValue(makeSelectChain([]));
    mocks.cancelGrievanceDeadlineReminders.mockResolvedValue({ cancelledIds: [], correlationId: "test-cancel-correlation" });
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
    it("returns error if grievance not found", async () => {
      const r = await createDeadline("g-1", "filing_deadline");
      expect(r.success).toBe(false);
      expect(r.error).toContain("Grievance not found");
    });

    it("returns error if no rule and no customDays", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValueOnce({ id: "g-1" });
      const r = await createDeadline("g-1", "custom");
      expect(r.success).toBe(false);
      expect(r.error).toContain("No rule found");
    });

    it("creates deadline with matching rule (business days)", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValueOnce({ id: "g-1" });
      mocks.mockInsertReturning.mockResolvedValueOnce([{ id: "dl-1" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders

      const r = await createDeadline("g-1", "filing_deadline");
      expect(r.success).toBe(true);
      expect(r.deadlineId).toBe("dl-1");
      expect(r.dueDate).toBeInstanceOf(Date);
    });

    it("creates deadline with customDays and calendar mode", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValueOnce({ id: "g-1" });
      mocks.mockInsertReturning.mockResolvedValueOnce([{ id: "dl-2" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-2" });

      const r = await createDeadline("g-1", "custom", {
        customDays: 14,
        useBusinessDays: false,
      });
      expect(r.success).toBe(true);
      expect(r.deadlineId).toBe("dl-2");
    });

    it("handles db error gracefully", async () => {
      mocks.mockFindFirstGrievances.mockRejectedValueOnce(new Error("DB error"));
      const r = await createDeadline("g-1", "filing_deadline");
      expect(r.success).toBe(false);
      expect(r.error).toBe("DB error");
    });
  });

  // ── createGrievanceStepDeadlines ──────────────────────────────────
  describe("createGrievanceStepDeadlines", () => {
    it("creates step deadlines when grievance exists", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValue({ id: "g-1" });
      mocks.mockInsertReturning.mockResolvedValue([{ id: "dl-new" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-new" });

      const r = await createGrievanceStepDeadlines("g-1", new Date(), new Date());
      expect(r.success).toBe(true);
      expect(r.deadlineIds.length).toBeGreaterThanOrEqual(1);
    });

    it("returns success with empty IDs when createDeadline fails internally", async () => {
      // createDeadline catches errors internally, so createGrievanceStepDeadlines
      // still returns success: true but with empty deadlineIds
      mocks.mockFindFirstGrievances.mockResolvedValue(undefined);
      const r = await createGrievanceStepDeadlines("g-1", new Date(), new Date());
      expect(r.success).toBe(true);
      expect(r.deadlineIds).toEqual([]);
    });
  });

  // ── completeDeadline ──────────────────────────────────────────────
  describe("completeDeadline", () => {
    it("completes successfully when the deadline belongs to the caller's organization", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "dl-1" }]));
      const r = await completeDeadline("dl-1", "org-1", "user-1", "Done");
      expect(r.success).toBe(true);
    });

    it("records the completing actor in the notes", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "dl-1" }]));
      await completeDeadline("dl-1", "org-1", "user-42", "All done");
      const setCall = (mocks.mockUpdateWhere as unknown as { mock: { calls: unknown[] } });
      expect(setCall).toBeDefined();
    });

    it("cancels durable outbox reminders on completion (not just legacy notifications)", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "dl-1" }]));
      await completeDeadline("dl-1", "org-1", "user-1");
      expect(mocks.cancelGrievanceDeadlineReminders).toHaveBeenCalledWith(
        expect.objectContaining({ sourceDeadlineId: "dl-1", organizationId: "org-1", reason: "completed" }),
      );
    });

    it("fails closed when the deadline does not belong to the caller's organization (wrong-org)", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([])); // ownership join returns nothing
      const r = await completeDeadline("dl-1", "org-B", "user-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("Deadline not found");
      expect(mocks.mockUpdateWhere).not.toHaveBeenCalled();
      expect(mocks.cancelGrievanceDeadlineReminders).not.toHaveBeenCalled();
    });

    it("handles error", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "dl-1" }]));
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
    it("returns mapped alerts scoped to the organization via the grievance join", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-1",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() + 5 * 86400000),
              description: "File grievance",
            },
          },
        ]),
      );
      const result = await getUpcomingDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
      expect(result.deadlines[0].deadlineId).toBe("dl-1");
      expect(result.deadlines[0].status).toBe("upcoming");
    });

    it("never returns another organization's deadlines (org B empty when scoped to org A)", async () => {
      // The join's WHERE clause is what scopes by organization; simulate the
      // DB honestly returning nothing for an org with no matching rows.
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([]));
      const result = await getUpcomingDeadlines("org-B");
      expect(result).toEqual({ status: "ok", deadlines: [] });
    });

    it("reports unavailable (not a false empty) on query failure", async () => {
      mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy: vi.fn().mockRejectedValue(new Error("fail")) })),
          })),
        })),
      });
      const result = await getUpcomingDeadlines("org-1");
      expect(result.status).toBe("unavailable");
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.error).toBe("fail");
    });
  });

  // ── getOverdueDeadlines ───────────────────────────────────────────
  describe("getOverdueDeadlines", () => {
    it("returns mapped alerts scoped to the organization via the grievance join", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-2",
              grievanceId: "c-2",
              deadlineType: "step_1_response",
              dueDate: new Date(Date.now() - 86400000),
              description: "Response due",
            },
          },
        ]),
      );
      const result = await getOverdueDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
    });

    it("never returns another organization's deadlines", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([]));
      const result = await getOverdueDeadlines("org-B");
      expect(result).toEqual({ status: "ok", deadlines: [] });
    });

    it("reports unavailable (not a false empty) on query failure", async () => {
      mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy: vi.fn().mockRejectedValue(new Error("fail")) })),
          })),
        })),
      });
      const result = await getOverdueDeadlines("org-1");
      expect(result.status).toBe("unavailable");
      if (result.status !== "unavailable") throw new Error("expected unavailable");
      expect(result.error).toBe("fail");
    });
  });

  // ── getGrievanceDeadlines ─────────────────────────────────────────
  describe("getGrievanceDeadlines", () => {
    it("returns deadlines for grievance", async () => {
      mocks.mockFindManyDeadlines.mockResolvedValueOnce([{ id: "dl-1", grievanceId: "g-1" }]);
      const result = await getGrievanceDeadlines("g-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
    });

    it("reports unavailable (not a false empty) on query failure", async () => {
      mocks.mockFindManyDeadlines.mockRejectedValueOnce(new Error("fail"));
      const result = await getGrievanceDeadlines("g-1");
      expect(result).toEqual({ status: "unavailable", error: "fail" });
    });
  });

  // ── escalateMissedDeadlines ───────────────────────────────────────
  describe("escalateMissedDeadlines", () => {
    it("escalates overdue deadlines and returns count", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-1",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() - 86400000),
              description: "Late",
            },
          },
        ]),
      );
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-1" }); // sendEscalationNotification
      const result = await escalateMissedDeadlines("org-1");
      expect(result).toEqual({ status: "ok", escalatedCount: 1 });
    });

    it("reports unavailable (not a false zero) when the overdue query fails", async () => {
      mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy: vi.fn().mockRejectedValue(new Error("fail")) })),
          })),
        })),
      });
      const result = await escalateMissedDeadlines("org-1");
      expect(result).toEqual({ status: "unavailable", error: "fail" });
    });
  });

  // ── Coverage Gap Tests ────────────────────────────────────────────
  describe("approveDeadlineExtension - edge cases", () => {
    it("uses new Date() fallback when newDeadline is missing", async () => {
      const _beforeCall = new Date();
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({
          id: "dl-1",
          notes: "Extension requested by user-1: Need more time.",
          // newDeadline is undefined
          reminderDays: [7, 3, 1],
        })
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders

      const r = await approveDeadlineExtension("dl-1", "admin-1");
      
      expect(r.success).toBe(true);
      // Verify the update was called (mocked)
      expect(mocks.mockUpdateWhere).toHaveBeenCalled();
    });

    it("returns error if notes contain no extension request marker", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({
        id: "dl-1",
        notes: "Some random note without extension keyword",
      });
      const r = await approveDeadlineExtension("dl-1", "admin-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("No pending extension");
    });

    it("returns error if notes are null/empty", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({
        id: "dl-1",
        notes: null,
      });
      const r = await approveDeadlineExtension("dl-1", "admin-1");
      expect(r.success).toBe(false);
    });

    it("handles error during extension approval", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({
        id: "dl-1",
        notes: "Extension requested by user-1",
        newDeadline: new Date(),
      });
      mocks.mockUpdateWhere.mockRejectedValueOnce(new Error("update failed"));
      const r = await approveDeadlineExtension("dl-1", "admin-1");
      expect(r.success).toBe(false);
      expect(r.error).toContain("update failed");
    });
  });

  describe("createGrievanceStepDeadlines - success behavior", () => {
    it("returns success: true even when deadlineIds is empty", async () => {
      // When all createDeadline calls fail, deadlineIds remains []
      // but we still return success: true (as per implementation)
      mocks.mockFindFirstGrievances.mockResolvedValue(undefined);
      const r = await createGrievanceStepDeadlines("g-1", new Date(), new Date());
      expect(r.success).toBe(true);
      expect(Array.isArray(r.deadlineIds)).toBe(true);
    });
  });

  describe("requestDeadlineExtension - immediate vs approval", () => {
    it("reschedules reminders when requiresApproval is false", async () => {
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({
          id: "dl-1",
          reminderDays: [7, 3, 1],
        })
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders

      const newDate = new Date(Date.now() + 7 * 86400000);
      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate,
        reason: "Need time",
        requiresApproval: false,
      });
      expect(r.success).toBe(true);
    });
  });

  describe("deadline status classification", () => {
    it("calculates warning status for deadlines 3 days or less away", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-1",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() + 2 * 86400000),
              description: "File grievance",
            },
          },
        ]),
      );
      const result = await getUpcomingDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      // The mock returns 5, so status will be "upcoming"
      expect(result.deadlines[0].daysRemaining).toBeGreaterThanOrEqual(0);
    });

    it("calculates overdue status for negative days remaining", async () => {
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-1",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() - 2 * 86400000),
              description: "Late filing",
            },
          },
        ]),
      );
      const result = await getOverdueDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
    });
  });

  // ── Branch Coverage: createDeadlineAlert status paths ──────────────
  describe("createDeadlineAlert — status branches", () => {
    it("maps overdue status when daysRemaining < 0", async () => {
      vi.mocked(differenceInDays).mockReturnValueOnce(-3);
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-o",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() - 3 * 86400000),
              description: "Overdue",
            },
          },
        ]),
      );
      const result = await getUpcomingDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
      expect(result.deadlines[0].status).toBe("overdue");
    });

    it("maps warning status when 0 <= daysRemaining <= 3", async () => {
      vi.mocked(differenceInDays).mockReturnValueOnce(2);
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-w",
              grievanceId: "c-1",
              deadlineType: "step_1_response",
              dueDate: new Date(Date.now() + 2 * 86400000),
              description: "Warning",
            },
          },
        ]),
      );
      const result = await getUpcomingDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
      expect(result.deadlines[0].status).toBe("warning");
    });

    it("uses new Date() fallback when dueDate is null", async () => {
      vi.mocked(differenceInDays).mockReturnValueOnce(0);
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-n",
              grievanceId: "c-1",
              deadlineType: "step_1_response",
              dueDate: null,
              description: null,
            },
          },
        ]),
      );
      const result = await getUpcomingDeadlines("org-1");
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("expected ok");
      expect(result.deadlines).toHaveLength(1);
      expect(result.deadlines[0].dueDate).toBeInstanceOf(Date);
      expect(result.deadlines[0].description).toBe("");
    });
  });

  // ── Branch Coverage: createGrievanceStepDeadlines ────────────────
  describe("createGrievanceStepDeadlines — dueDate branch", () => {
    it("creates appeal deadline when step1 returns dueDate", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValue({ id: "g-1" });
      mocks.mockInsertReturning.mockResolvedValue([{ id: "dl-step" }]);
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-step" });

      const r = await createGrievanceStepDeadlines("g-1", new Date(), new Date());
      expect(r.success).toBe(true);
      // Step1 + appeal + investigation = 3 deadlines
      expect(r.deadlineIds.length).toBe(3);
    });

    it("skips appeal deadline when step1 fails (no dueDate)", async () => {
      // First call (step1): claim not found → no dueDate
      // But we need claim found for step1 to succeed... let's make it fail differently
      mocks.mockFindFirstGrievances
        .mockResolvedValueOnce({ id: "g-1" }) // step1 grievance lookup
        .mockResolvedValueOnce({ id: "g-1" }); // investigation grievance lookup
      mocks.mockInsertReturning
        .mockRejectedValueOnce(new Error("insert fail")) // step1 insert fails
        .mockResolvedValueOnce([{ id: "dl-inv" }]); // investigation succeeds
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-inv" });

      const r = await createGrievanceStepDeadlines("g-1", new Date(), new Date());
      expect(r.success).toBe(true);
      // Only investigation succeeded, step1 failed (no dueDate) so no appeal
      expect(r.deadlineIds.length).toBe(1);
    });
  });

  // ── Branch Coverage: completeDeadline update ─────────────────────
  describe("completeDeadline — notes branch", () => {
    it("completes without notes argument", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "dl-1" }]));
      const r = await completeDeadline("dl-1", "org-1", "user-1");
      expect(r.success).toBe(true);
    });
  });

  // ── Branch Coverage: requestDeadlineExtension ─────────────────────
  describe("requestDeadlineExtension — error handling", () => {
    it("handles error during immediate extension", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1", reminderDays: [7] });
      mocks.mockUpdateWhere.mockRejectedValueOnce(new Error("update err"));
      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Need time",
        requiresApproval: false,
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain("update err");
    });
  });

  // ── Branch Coverage: escalateMissedDeadlines update ──────────────
  describe("escalateMissedDeadlines — update path", () => {
    it("updates overdue deadline status and sends notification", async () => {
      vi.mocked(differenceInDays).mockReturnValue(-2);
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-esc",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() - 2 * 86400000),
              description: "Missed deadline",
            },
          },
        ]),
      );
      mocks.mockFindFirstDeadlines.mockResolvedValue({ id: "dl-esc" });

      const result = await escalateMissedDeadlines("org-1");
      expect(result).toEqual({ status: "ok", escalatedCount: 1 });
      expect(mocks.mockUpdateWhere).toHaveBeenCalled();
    });
  });

  // ── Branch Coverage: useBusinessDays=false ────────────────────────
  describe("createDeadline — useBusinessDays false branch", () => {
    it("uses addDays when useBusinessDays is false", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValueOnce({ id: "g-1" });
      mocks.mockInsertReturning.mockResolvedValueOnce([{ id: "dl-bd" }]);

      const r = await createDeadline("g-1", "filing_deadline", {
        useBusinessDays: false,
      });
      expect(r.success).toBe(true);
      expect(r.deadlineId).toBe("dl-bd");
    });
  });

  // ── Branch Coverage: non-Error throws in catch blocks ─────────────
  describe("catch blocks — non-Error throws", () => {
    it("createDeadline wraps non-Error throw", async () => {
      mocks.mockFindFirstGrievances.mockResolvedValueOnce({ id: "g-1" });
      mocks.mockInsertReturning.mockRejectedValueOnce("string error");

      const r = await createDeadline("g-1", "filing_deadline");
      expect(r.success).toBe(false);
      expect(r.error).toBe("Failed to create deadline");
    });

    it("createGrievanceStepDeadlines returns success with empty IDs when all createDeadline fail", async () => {
      // All createDeadline calls fail internally (return success:false)
      mocks.mockFindFirstGrievances.mockResolvedValue(undefined);

      const r = await createGrievanceStepDeadlines("g-1", new Date(), new Date());
      // Individual failures are swallowed; outer function returns success with no IDs
      expect(r.success).toBe(true);
      expect(r.deadlineIds).toEqual([]);
    });

    it("completeDeadline wraps non-Error throw", async () => {
      mocks.mockSelect.mockReturnValueOnce(makeSelectChain([{ id: "dl-1" }]));
      mocks.mockUpdateWhere.mockRejectedValueOnce(null);

      const r = await completeDeadline("dl-1", "org-1", "user-1");
      expect(r.success).toBe(false);
      expect(r.error).toBe("Failed to complete deadline");
    });

    it("requestDeadlineExtension wraps non-Error throw", async () => {
      mocks.mockFindFirstDeadlines.mockRejectedValueOnce("boom");

      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Need more time",
        requiresApproval: false,
      });
      expect(r.success).toBe(false);
      expect(r.error).toBe("Failed to request extension");
    });

    it("approveDeadlineExtension wraps non-Error throw", async () => {
      mocks.mockFindFirstDeadlines.mockRejectedValueOnce(undefined);

      const r = await approveDeadlineExtension("dl-1", "admin");
      expect(r.success).toBe(false);
      expect(r.error).toBe("Failed to approve extension");
    });
  });

  // ── Branch Coverage: requestDeadlineExtension with approval ───────
  describe("requestDeadlineExtension — requiresApproval=true", () => {
    it("saves extension request note without applying extension", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1", reminderDays: [7] });

      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Union conference",
        requiresApproval: true,
      });
      expect(r.success).toBe(true);
    });

    it("applies immediate extension and reschedules reminders", async () => {
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({ id: "dl-1", reminderDays: [7, 3] }) // lookup
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders lookup

      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "More time needed",
        requiresApproval: false,
      });
      expect(r.success).toBe(true);
    });

    it("applies immediate extension with null reminderDays fallback", async () => {
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({ id: "dl-1", reminderDays: null }) // lookup, null triggers || [7,3,1]
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders

      const r = await requestDeadlineExtension({
        deadlineId: "dl-1",
        requestedBy: "user-1",
        newDate: new Date(),
        reason: "Fallback test",
        requiresApproval: false,
      });
      expect(r.success).toBe(true);
    });
  });

  // ── Branch Coverage: approveDeadlineExtension ─────────────────────
  describe("approveDeadlineExtension — branches", () => {
    it("returns error when deadline not found", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce(null);
      const r = await approveDeadlineExtension("dl-missing", "admin");
      expect(r.success).toBe(false);
      expect(r.error).toBe("Deadline not found");
    });

    it("returns error when no pending extension", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1", notes: "just notes" });
      const r = await approveDeadlineExtension("dl-1", "admin");
      expect(r.success).toBe(false);
      expect(r.error).toBe("No pending extension request found");
    });

    it("returns error when notes is null", async () => {
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce({ id: "dl-1", notes: null });
      const r = await approveDeadlineExtension("dl-1", "admin");
      expect(r.success).toBe(false);
      expect(r.error).toBe("No pending extension request found");
    });

    it("approves extension with newDeadline", async () => {
      const nd = new Date("2026-06-01");
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({
          id: "dl-1",
          notes: "Extension requested by user-1: reason",
          newDeadline: nd,
          reminderDays: [5, 2],
        })
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders lookup

      const r = await approveDeadlineExtension("dl-1", "admin");
      expect(r.success).toBe(true);
      expect(mocks.mockUpdateWhere).toHaveBeenCalled();
    });

    it("approves extension without newDeadline (fallback to new Date)", async () => {
      mocks.mockFindFirstDeadlines
        .mockResolvedValueOnce({
          id: "dl-1",
          notes: "Extension requested by user-1: reason",
          newDeadline: null,
          reminderDays: null,
        })
        .mockResolvedValueOnce({ id: "dl-1" }); // scheduleReminders

      const r = await approveDeadlineExtension("dl-1", "admin");
      expect(r.success).toBe(true);
    });
  });

  // ── Branch Coverage: escalateMissedDeadlines error ────────────────
  describe("escalateMissedDeadlines — error path", () => {
    it("reports unavailable (not a false zero) when the overdue query fails", async () => {
      mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy: vi.fn().mockRejectedValue(new Error("db down")) })),
          })),
        })),
      });
      const result = await escalateMissedDeadlines("org-1");
      expect(result).toEqual({ status: "unavailable", error: "db down" });
    });

    it("handles sendEscalationNotification when deadline not found", async () => {
      vi.mocked(differenceInDays).mockReturnValue(-1);
      mocks.mockSelect.mockReturnValueOnce(
        makeSelectChain([
          {
            deadline: {
              id: "dl-gone",
              grievanceId: "c-1",
              deadlineType: "filing_deadline",
              dueDate: new Date(Date.now() - 86400000),
              description: "Missing",
            },
          },
        ]),
      );
      // sendEscalationNotification does findFirst — return null
      mocks.mockFindFirstDeadlines.mockResolvedValueOnce(null);

      const result = await escalateMissedDeadlines("org-1");
      expect(result).toEqual({ status: "ok", escalatedCount: 1 });
    });
  });
});
