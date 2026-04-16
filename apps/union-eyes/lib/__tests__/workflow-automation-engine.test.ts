import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted mocks – stable refs safe to use inside vi.mock() factories
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const grievanceWorkflowsFindFirst = vi.fn();
  const grievanceStagesFindFirst = vi.fn();
  const grievanceStagesFindMany = vi.fn();
  const grievanceTransitionsFindFirst = vi.fn();
  const claimsFindFirst = vi.fn();
  const grievanceAssignmentsFindMany = vi.fn();
  const insertReturning = vi.fn();
  const selectLimit = vi.fn();
  const notificationSend = vi.fn();
  const getNotificationService = vi.fn();

  const dbInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: insertReturning,
  };
  const dbSelectChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: selectLimit,
  };
  const dbUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'updated' }]),
  };
  const mockDb = {
    query: {
      grievanceWorkflows: { findFirst: grievanceWorkflowsFindFirst },
      grievanceStages: { findFirst: grievanceStagesFindFirst, findMany: grievanceStagesFindMany },
      grievanceTransitions: { findFirst: grievanceTransitionsFindFirst },
      claims: { findFirst: claimsFindFirst },
      grievanceAssignments: { findMany: grievanceAssignmentsFindMany },
    },
    insert: vi.fn(() => dbInsertChain),
    select: vi.fn(() => dbSelectChain),
    update: vi.fn(() => dbUpdateChain),
  };

  return {
    grievanceWorkflowsFindFirst,
    grievanceStagesFindFirst,
    grievanceStagesFindMany,
    grievanceTransitionsFindFirst,
    claimsFindFirst,
    grievanceAssignmentsFindMany,
    insertReturning,
    selectLimit,
    notificationSend,
    getNotificationService,
    validateClaimTransition: vi.fn(),
    generatePDF: vi.fn(),
    generateExcel: vi.fn(),
    documentStorageUpload: vi.fn(),
    autoAssignGrievance: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    dbInsertChain,
    dbSelectChain,
    dbUpdateChain,
    mockDb,
  };
});

// ---------------------------------------------------------------------------
// vi.mock() calls – using hoisted mocks only
// ---------------------------------------------------------------------------
vi.mock("@/db/db", () => ({ db: mocks.mockDb }));

vi.mock("drizzle-orm", () => ({
  ne: vi.fn((...args: unknown[]) => ({ _tag: "ne", args })),
  eq: vi.fn((...args: unknown[]) => ({ _tag: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _tag: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ _tag: "or", args })),
  desc: vi.fn((col: unknown) => ({ _tag: "desc", col })),
  asc: vi.fn((col: unknown) => ({ _tag: "asc", col })),
  isNull: vi.fn((col: unknown) => ({ _tag: "isNull", col })),
  lte: vi.fn((...args: unknown[]) => ({ _tag: "lte", args })),
  gte: vi.fn((...args: unknown[]) => ({ _tag: "gte", args })),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    raw: vi.fn((s: string) => s),
  }),
  relations: vi.fn(() => ({})),
}));

vi.mock("@/db/schema", () => ({
  claims: { claimId: "claimId", organizationId: "organizationId", progress: "progress" },
  claimUpdates: { claimId: "claimId", updateType: "updateType", createdAt: "createdAt", metadata: "metadata" },
  grievanceWorkflows: {
    organizationId: "organizationId",
    grievanceType: "grievanceType",
    status: "status",
    isDefault: "isDefault",
  },
  grievanceStages: {
    workflowId: "workflowId",
    orderIndex: "orderIndex",
    id: "id",
  },
  grievanceTransitions: {
    claimId: "claimId",
    transitionedAt: "transitionedAt",
    id: "id",
    organizationId: "organizationId",
    requiresApproval: "requiresApproval",
    approvedBy: "approvedBy",
    metadata: "metadata",
    notes: "notes",
    version: "version",
  },
  grievanceApprovals: {},
  grievanceAssignments: {
    claimId: "claimId",
    status: "status",
  },
}));

vi.mock("@/db/schema/domains/claims", () => ({
  grievanceDeadlines: {
    status: "status",
    dueDate: "dueDate",
    id: "id",
    grievanceId: "grievanceId",
    deadlineType: "deadlineType",
    reminderDays: "reminderDays",
    remindersSent: "remindersSent",
    updatedAt: "updatedAt",
  },
}));

vi.mock("@/db/schema/domains/claims/grievances", () => ({
  grievances: {
    id: "id",
    organizationId: "organizationId",
    grievantId: "grievantId",
    grievanceNumber: "grievanceNumber",
  },
}));

vi.mock("@/db/schema/organization-members-schema", () => ({
  organizationMembers: {
    userId: "userId",
    organizationId: "organizationId",
    role: "role",
    status: "status",
  },
}));

vi.mock("@/lib/services/claim-workflow-fsm", () => ({
  validateClaimTransition: mocks.validateClaimTransition,
}));

vi.mock("@/lib/services/notification-service", () => ({
  getNotificationService: mocks.getNotificationService,
}));

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));

vi.mock("@/lib/utils/pdf-generator", () => ({
  generatePDF: mocks.generatePDF,
}));

vi.mock("@/lib/utils/excel-generator", () => ({
  generateExcel: mocks.generateExcel,
}));

vi.mock("@/lib/services/document-storage-service", () => ({
  __esModule: true,
  default: class {
    uploadDocument = mocks.documentStorageUpload;
  },
}));

vi.mock("@/lib/services/grievance-notifications", () => ({}));

vi.mock("@/lib/case-assignment-engine", () => ({
  autoAssignGrievance: mocks.autoAssignGrievance,
}));

// ---------------------------------------------------------------------------
// Import the module under test (AFTER vi.mock calls)
// ---------------------------------------------------------------------------
import {
  initializeWorkflow,
  transitionToStage,
  approveTransition,
  rejectTransition,
  getWorkflowStatus,
  processOverdueDeadlines,
  sendDeadlineReminders,
} from "@/lib/workflow-automation-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetAllMocks() {
  vi.clearAllMocks();

  // Default happy-path for notification service
  mocks.notificationSend.mockResolvedValue(undefined);
  mocks.getNotificationService.mockReturnValue({ send: mocks.notificationSend });

  // Default happy-path for FSM validation
  mocks.validateClaimTransition.mockReturnValue({
    allowed: true,
    warnings: [],
    metadata: { slaCompliant: true, daysInState: 0 },
  });

  // Default builder chain returns
  mocks.insertReturning.mockResolvedValue([{ id: "trans-1" }]);
  mocks.selectLimit.mockResolvedValue([]);
  mocks.dbSelectChain.from.mockReturnValue(mocks.dbSelectChain);
  mocks.dbSelectChain.innerJoin.mockReturnValue(mocks.dbSelectChain);
  mocks.dbSelectChain.where.mockReturnValue(mocks.dbSelectChain);
  mocks.dbSelectChain.orderBy.mockReturnValue(mocks.dbSelectChain);
  mocks.dbInsertChain.values.mockReturnValue(mocks.dbInsertChain);
  mocks.dbUpdateChain.set.mockReturnValue(mocks.dbUpdateChain);
  mocks.dbUpdateChain.where.mockReturnValue(mocks.dbUpdateChain);
  mocks.dbUpdateChain.returning.mockResolvedValue([{ id: 'updated' }]);
}

const STAGE_FILED: Record<string, unknown> = {
  id: "stage-1",
  name: "Filed",
  stageType: "filed",
  orderIndex: 0,
  workflowId: "wf-1",
  slaDays: 5,
  notifyOnEntry: false,
  entryActions: [],
  exitActions: [],
  requireApproval: false,
  autoTransition: false,
  nextStageId: null,
  conditions: [],
};

const STAGE_INVESTIGATION: Record<string, unknown> = {
  id: "stage-2",
  name: "Investigation",
  stageType: "investigation",
  orderIndex: 1,
  workflowId: "wf-1",
  slaDays: 10,
  notifyOnEntry: false,
  entryActions: [],
  exitActions: [],
  requireApproval: false,
  autoTransition: false,
  nextStageId: null,
  conditions: [],
};

const WORKFLOW = {
  id: "wf-1",
  organizationId: "org-1",
  grievanceType: "standard",
  status: "active",
  isDefault: false,
  stages: [STAGE_FILED, STAGE_INVESTIGATION],
};

const CLAIM = {
  claimId: "claim-1",
  organizationId: "org-1",
  claimNumber: "GR-001",
  priority: "medium",
  createdAt: new Date("2025-01-01"),
  progress: 0,
};

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe("workflow-automation-engine", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // =========================================================================
  // initializeWorkflow
  // =========================================================================
  describe("initializeWorkflow", () => {
    it("returns success when matching workflow found", async () => {
      mocks.grievanceWorkflowsFindFirst.mockResolvedValue(WORKFLOW);
      mocks.grievanceStagesFindFirst.mockResolvedValue(STAGE_FILED);
      mocks.insertReturning.mockResolvedValue([{ id: "trans-init" }]);

      const result = await initializeWorkflow("claim-1", "standard", "org-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe("wf-1");
    });

    it("falls back to default workflow when type-specific not found", async () => {
      // First call returns null (no type-specific), second returns default
      mocks.grievanceWorkflowsFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...WORKFLOW, isDefault: true });
      mocks.grievanceStagesFindFirst.mockResolvedValue(STAGE_FILED);
      mocks.insertReturning.mockResolvedValue([{ id: "trans-init" }]);

      const result = await initializeWorkflow("claim-1", "custom", "org-1", "user-1");

      expect(result.success).toBe(true);
    });

    it("returns error when no workflow and no default found", async () => {
      mocks.grievanceWorkflowsFindFirst.mockResolvedValue(null);

      const result = await initializeWorkflow("claim-1", "unknown", "org-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No workflow found/);
    });

    it("returns error when workflow has no stages", async () => {
      mocks.grievanceWorkflowsFindFirst.mockResolvedValue(WORKFLOW);
      mocks.grievanceStagesFindFirst.mockResolvedValue(null); // no first stage

      const result = await initializeWorkflow("claim-1", "standard", "org-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No stages/);
    });

    it("catches and returns errors", async () => {
      mocks.grievanceWorkflowsFindFirst.mockRejectedValue(new Error("DB down"));

      const result = await initializeWorkflow("claim-1", "standard", "org-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB down");
    });
  });

  // =========================================================================
  // transitionToStage
  // =========================================================================
  describe("transitionToStage", () => {
    beforeEach(() => {
      // Standard setup: current transition, current stage, target stage, claim
      mocks.grievanceTransitionsFindFirst.mockResolvedValue({
        toStageId: "stage-1",
        toStage: STAGE_FILED,
        transitionedAt: new Date("2025-01-01"),
      });
      mocks.grievanceStagesFindFirst
        .mockResolvedValueOnce(STAGE_FILED)   // current stage lookup
        .mockResolvedValueOnce(STAGE_INVESTIGATION); // target stage lookup
      mocks.claimsFindFirst.mockResolvedValue(CLAIM);
      mocks.selectLimit.mockResolvedValue([]); // getUserRole → no result
    });

    it("succeeds when FSM allows transition", async () => {
      mocks.insertReturning.mockResolvedValue([{ id: "trans-2" }]);

      const result = await transitionToStage("claim-1", "stage-2", "org-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.transitionId).toBe("trans-2");
    });

    it("fails when FSM blocks transition", async () => {
      mocks.validateClaimTransition.mockReturnValue({
        allowed: false,
        reason: "Invalid status transition",
        requiredActions: ["Attach documentation"],
      });

      const result = await transitionToStage("claim-1", "stage-2", "org-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/FSM Validation Failed/);
    });

    it("returns error when target stage not found", async () => {
      mocks.grievanceStagesFindFirst.mockReset();
      mocks.grievanceStagesFindFirst
        .mockResolvedValueOnce(STAGE_FILED)
        .mockResolvedValueOnce(null); // target not found

      const result = await transitionToStage("claim-1", "stage-bad", "org-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Target stage not found/);
    });

    it("returns error when claim not found", async () => {
      mocks.grievanceStagesFindFirst
        .mockResolvedValueOnce(STAGE_FILED)
        .mockResolvedValueOnce(STAGE_INVESTIGATION);
      mocks.claimsFindFirst.mockResolvedValue(null);

      const result = await transitionToStage("claim-1", "stage-2", "org-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Claim not found/);
    });

    it("returns requiresApproval when stage requires approval", async () => {
      const approvalStage = { ...STAGE_INVESTIGATION, requireApproval: true };
      mocks.grievanceStagesFindFirst.mockReset();
      mocks.grievanceStagesFindFirst
        .mockResolvedValueOnce(STAGE_FILED)
        .mockResolvedValueOnce(approvalStage);
      mocks.insertReturning.mockResolvedValue([{ id: "pending-1" }]);

      const result = await transitionToStage("claim-1", "stage-2", "org-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });

    it("includes FSM warnings in result", async () => {
      mocks.validateClaimTransition.mockReturnValue({
        allowed: true,
        warnings: ["SLA may be exceeded"],
        metadata: { slaCompliant: false, daysInState: 15 },
      });
      mocks.insertReturning.mockResolvedValue([{ id: "trans-2" }]);

      const result = await transitionToStage("claim-1", "stage-2", "org-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.fsmValidation?.warnings).toContain("SLA may be exceeded");
    });
  });

  // =========================================================================
  // approveTransition
  // =========================================================================
  describe("approveTransition", () => {
    it("returns error when pending transition not found", async () => {
      mocks.grievanceTransitionsFindFirst.mockResolvedValue(null);

      const result = await approveTransition("trans-x", "org-1", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Pending transition not found/);
    });

    it("creates approval record and transitions", async () => {
      // First call: find pending transition
      mocks.grievanceTransitionsFindFirst.mockResolvedValueOnce({
        id: "trans-pending",
        claimId: "claim-1",
        toStageId: "stage-2",
        reason: "Escalation",
        notes: null,
        transitionedBy: "user-1",
        version: 1,
      });

      // After approval insert + update, transitionToStage is called internally.
      // It will call grievanceTransitions.findFirst (current transition),
      // grievanceStages.findFirst x2 (current + target), claims.findFirst, etc.
      mocks.grievanceTransitionsFindFirst.mockResolvedValueOnce({
        toStageId: "stage-1",
        toStage: STAGE_FILED,
        transitionedAt: new Date(),
      });
      mocks.grievanceStagesFindFirst
        .mockResolvedValueOnce(STAGE_FILED)
        .mockResolvedValueOnce(STAGE_INVESTIGATION);
      mocks.claimsFindFirst.mockResolvedValue(CLAIM);
      // First selectLimit call: getUserRole for approver → admin
      // Subsequent calls: getUserRole inside transitionToStage → member (default)
      mocks.selectLimit
        .mockResolvedValueOnce([{ role: 'admin' }])
        .mockResolvedValue([]);
      mocks.insertReturning.mockResolvedValue([{ id: "trans-approved" }]);

      const result = await approveTransition("trans-pending", "org-1", "admin-1");

      expect(result.success).toBe(true);
      expect(mocks.mockDb.insert).toHaveBeenCalled();
    });

    it("rejects non-admin approvers", async () => {
      mocks.grievanceTransitionsFindFirst.mockResolvedValueOnce({
        id: "trans-pending",
        claimId: "claim-1",
        toStageId: "stage-2",
        reason: "Escalation",
        notes: null,
        transitionedBy: "user-1",
        version: 1,
      });
      // getUserRole returns 'member' — insufficient permission
      mocks.selectLimit.mockResolvedValue([{ role: 'member' }]);

      const result = await approveTransition("trans-pending", "org-1", "member-user");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Insufficient permission/);
    });
  });

  // =========================================================================
  // rejectTransition
  // =========================================================================
  describe("rejectTransition", () => {
    it("creates rejection record and sends notification", async () => {
      mocks.grievanceTransitionsFindFirst.mockResolvedValue({
        id: "trans-pending",
        claimId: "claim-1",
        transitionedBy: "user-1",
      });

      const result = await rejectTransition("trans-pending", "org-1", "admin-1", "Insufficient evidence");

      expect(result.success).toBe(true);
      expect(mocks.mockDb.insert).toHaveBeenCalled();
      expect(mocks.notificationSend).toHaveBeenCalled();
    });

    it("catches errors", async () => {
      mocks.grievanceTransitionsFindFirst.mockRejectedValue(new Error("fail"));

      const result = await rejectTransition("t-1", "org-1", "u-1", "reason");

      expect(result.success).toBe(false);
      expect(result.error).toBe("fail");
    });
  });

  // =========================================================================
  // getWorkflowStatus
  // =========================================================================
  describe("getWorkflowStatus", () => {
    it("returns null when claim not found", async () => {
      mocks.claimsFindFirst.mockResolvedValue(null);

      const result = await getWorkflowStatus("claim-x", "org-1");

      expect(result).toBeNull();
    });

    it("returns empty status when no transitions exist", async () => {
      mocks.claimsFindFirst.mockResolvedValue(CLAIM);
      mocks.grievanceTransitionsFindFirst.mockResolvedValue(null);

      const result = await getWorkflowStatus("claim-1", "org-1");

      expect(result).not.toBeNull();
      expect(result!.currentStage).toBeNull();
      expect(result!.progress).toBe(0);
    });

    it("calculates progress from stage positions", async () => {
      mocks.claimsFindFirst.mockResolvedValue(CLAIM);
      mocks.grievanceTransitionsFindFirst.mockResolvedValue({
        toStageId: "stage-2",
        toStage: {
          ...STAGE_INVESTIGATION,
          workflow: { id: "wf-1" },
        },
        transitionedAt: new Date(),
      });
      // 3 stages total, current is index 1 → 1 completed out of 3
      mocks.grievanceStagesFindMany.mockResolvedValue([
        { ...STAGE_FILED, orderIndex: 0 },
        { ...STAGE_INVESTIGATION, orderIndex: 1 },
        { id: "stage-3", orderIndex: 2 },
      ]);
      // No deadlines
      mocks.dbSelectChain.where.mockReturnValue(mocks.dbSelectChain);
      mocks.dbSelectChain.orderBy.mockReturnValue([]);

      const result = await getWorkflowStatus("claim-1", "org-1");

      expect(result).not.toBeNull();
      expect(result!.stagesCompleted).toBe(1);
      expect(result!.totalStages).toBe(3);
      expect(result!.progress).toBe(33); // Math.round(1/3*100)
    });
  });

  // =========================================================================
  // processOverdueDeadlines
  // =========================================================================
  describe("processOverdueDeadlines", () => {
    it("does nothing when no overdue deadlines", async () => {
      mocks.dbSelectChain.where.mockReturnValue([]);

      await processOverdueDeadlines();

      expect(mocks.mockDb.update).not.toHaveBeenCalled();
    });

    it("escalates overdue deadlines and updates status", async () => {
      const deadline = {
        id: "dl-1",
        grievanceId: "g-1",
        deadlineType: "stage_completion",
        status: "pending",
        dueDate: new Date(Date.now() - 86400000),
      };
      mocks.dbSelectChain.where.mockReturnValue([deadline]);

      await processOverdueDeadlines();

      expect(mocks.mockDb.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // sendDeadlineReminders
  // =========================================================================
  describe("sendDeadlineReminders", () => {
    it("does nothing when no upcoming deadlines", async () => {
      mocks.dbSelectChain.where.mockReturnValue([]);

      await sendDeadlineReminders();

      expect(mocks.notificationSend).not.toHaveBeenCalled();
    });

    it("sends reminders for matching reminder days", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const row = {
        deadline: {
          id: "dl-2",
          grievanceId: "g-1",
          deadlineType: "response",
          dueDate: tomorrow,
          status: "pending",
          reminderDays: [1],
          remindersSent: null,
        },
        grievance: {
          id: "g-1",
          organizationId: "org-1",
          grievantId: "officer-1",
          grievanceNumber: "GR-001",
        },
      };
      mocks.dbSelectChain.where.mockReturnValue([row]);

      await sendDeadlineReminders();

      expect(mocks.notificationSend).toHaveBeenCalled();
    });
  });
});
