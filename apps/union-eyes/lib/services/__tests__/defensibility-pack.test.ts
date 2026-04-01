/**
 * Defensibility Pack — Unit Tests
 * verifyPackIntegrity & generateArbitrationSummary are PURE (no mocks needed).
 * generateDefensibilityPack needs only sla-calculator mock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  calculateCaseSlaStatus: vi.fn().mockReturnValue({
    acknowledgment: { status: "met", daysElapsed: 1, daysRemaining: 1, breachDate: null },
    firstResponse: { status: "pending", daysElapsed: 0, daysRemaining: 5, breachDate: null },
    investigation: null,
  }),
}));

vi.mock("../sla-calculator", () => ({
  calculateCaseSlaStatus: mocks.calculateCaseSlaStatus,
}));

import {
  generateDefensibilityPack,
  verifyPackIntegrity,
  generateArbitrationSummary,
  type TimelineEvent,
  type AuditEntry,
  type StateTransition,
  type DefensibilityPack,
} from "../defensibility-pack";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const _now = new Date("2026-01-15T12:00:00Z");

function makeTimeline(overrides: Partial<TimelineEvent>[] = []): TimelineEvent[] {
  const defaults: TimelineEvent[] = [
    {
      id: "e1", caseId: "case-1", timestamp: new Date("2026-01-01"),
      type: "submitted", description: "Grievance filed", actorId: "member-1",
      actorRole: "member", visibilityScope: "member",
    },
    {
      id: "e2", caseId: "case-1", timestamp: new Date("2026-01-02"),
      type: "acknowledged", description: "Acknowledged by LRO", actorId: "staff-1",
      actorRole: "staff", visibilityScope: "staff",
    },
    {
      id: "e3", caseId: "case-1", timestamp: new Date("2026-01-03"),
      type: "other", description: "System log", actorId: "system",
      actorRole: "system", visibilityScope: "system",
    },
  ];
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) }));
}

function makeAudit(): AuditEntry[] {
  return [
    {
      id: "a1", timestamp: new Date("2026-01-01"), userId: "staff-1",
      action: "view", resourceType: "case", resourceId: "case-1",
      sanitizedMetadata: {},
    },
  ];
}

function makeTransitions(): StateTransition[] {
  return [
    {
      timestamp: new Date("2026-01-01"), fromState: "new", toState: "open",
      actorRole: "member", validationPassed: true,
    },
    {
      timestamp: new Date("2026-01-02"), fromState: "open", toState: "investigation",
      actorRole: "staff", reason: "Assigned", validationPassed: true,
    },
  ];
}

const caseSummary: DefensibilityPack["caseSummary"] = {
  title: "Test Grievance",
  memberId: "member-1",
  memberName: "Jane Doe",
  currentState: "investigation",
  createdAt: new Date("2026-01-01"),
  lastUpdated: new Date("2026-01-10"),
  grievanceType: "discipline",
  priority: "high",
};

describe("defensibility-pack", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── generateDefensibilityPack ────────────────────────────────────────────
  describe("generateDefensibilityPack", () => {
    it("generates a pack with correct structure", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      expect(pack.caseId).toBe("case-1");
      expect(pack.exportVersion).toBe("1.0.0");
      expect(pack.generatedBy).toBe("system");
      expect(pack.exportMetadata.purpose).toBe("arbitration");
      expect(pack.exportMetadata.includeSensitiveData).toBe(false);
    });

    it("filters timeline by visibility scope", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      // memberVisible: member + staff scope
      expect(pack.memberVisibleTimeline).toHaveLength(2);
      // staffVisible: everything except system
      expect(pack.staffVisibleTimeline).toHaveLength(2);
    });

    it("calculates SLA compliance from timeline", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "audit",
          requestedBy: "admin-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      expect(pack.slaCompliance.length).toBeGreaterThanOrEqual(1);
      expect(pack.slaCompliance[0].standard).toBe("Acknowledgment of Receipt");
    });

    it("skips SLA calculation when timeline is empty", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        [],
        makeAudit(),
        makeTransitions(),
        {
          purpose: "compliance",
          requestedBy: "admin-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      expect(pack.slaCompliance).toHaveLength(0);
    });

    it("calculates integrity hashes", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      expect(pack.integrity.timelineHash).toBeTruthy();
      expect(pack.integrity.auditHash).toBeTruthy();
      expect(pack.integrity.stateTransitionHash).toBeTruthy();
      expect(pack.integrity.combinedHash).toBeTruthy();
    });

    it("sets includeSensitiveData when explicitly provided", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "member_request",
          requestedBy: "member-1",
          exportFormat: "pdf",
          includeSensitiveData: true,
          caseSummary,
          generatedBy: "system",
        }
      );

      expect(pack.exportMetadata.includeSensitiveData).toBe(true);
    });

    it("includes investigation SLA when available", async () => {
      mocks.calculateCaseSlaStatus.mockReturnValueOnce({
        acknowledgment: { status: "met", daysElapsed: 1, daysRemaining: 1, breachDate: null },
        firstResponse: { status: "met", daysElapsed: 3, daysRemaining: 2, breachDate: null },
        investigation: { status: "breached", daysElapsed: 20, daysRemaining: 0, breachDate: new Date("2026-01-20") },
      });

      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      expect(pack.slaCompliance).toHaveLength(3);
      const inv = pack.slaCompliance.find(s => s.standard === "Investigation Complete");
      expect(inv?.status).toBe("breached");
    });
  });

  // ── verifyPackIntegrity (PURE FUNCTION) ──────────────────────────────────
  describe("verifyPackIntegrity", () => {
    it("returns valid for an untampered pack", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      const result = verifyPackIntegrity(pack);
      expect(result.valid).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("detects timeline tampering", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      // Tamper with timeline
      pack.staffVisibleTimeline.push({
        id: "tampered",
        caseId: "case-1",
        timestamp: new Date(),
        type: "other",
        description: "Injected event",
        actorId: "hacker",
        actorRole: "admin",
        visibilityScope: "admin",
      });

      const result = verifyPackIntegrity(pack);
      expect(result.valid).toBe(false);
      expect(result.failures).toContain("Timeline integrity check failed");
      expect(result.failures).toContain("Combined integrity check failed");
    });

    it("detects audit trail tampering", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      pack.auditTrail[0].action = "delete"; // tamper

      const result = verifyPackIntegrity(pack);
      expect(result.valid).toBe(false);
      expect(result.failures).toContain("Audit trail integrity check failed");
    });

    it("detects state transition tampering", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      pack.stateTransitions[0].toState = "corrupted";

      const result = verifyPackIntegrity(pack);
      expect(result.valid).toBe(false);
      expect(result.failures).toContain("State transition integrity check failed");
    });
  });

  // ── generateArbitrationSummary (PURE FUNCTION) ───────────────────────────
  describe("generateArbitrationSummary", () => {
    it("produces a formatted text summary", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      const summary = generateArbitrationSummary(pack);

      expect(summary).toContain("GRIEVANCE CASE SUMMARY");
      expect(summary).toContain("Case ID: case-1");
      expect(summary).toContain("Title: Test Grievance");
      expect(summary).toContain("Member: Jane Doe");
      expect(summary).toContain("Priority: high");
      expect(summary).toContain("SLA COMPLIANCE");
      expect(summary).toContain("WORKFLOW PROGRESSION");
      expect(summary).toContain("MEMBER-VISIBLE TIMELINE");
      expect(summary).toContain("INTEGRITY VERIFICATION");
      expect(summary).toContain("EXPORT INFORMATION");
    });

    it("includes state transition reasons when present", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      const summary = generateArbitrationSummary(pack);
      expect(summary).toContain("Assigned");
    });

    it("shows SLA status for each standard", async () => {
      const pack = await generateDefensibilityPack(
        "case-1",
        makeTimeline(),
        makeAudit(),
        makeTransitions(),
        {
          purpose: "arbitration",
          requestedBy: "officer-1",
          exportFormat: "json",
          caseSummary,
          generatedBy: "system",
        }
      );

      const summary = generateArbitrationSummary(pack);
      expect(summary).toContain("MET");
    });
  });
});
