/**
 * Unit Tests — CAPE Audit Events
 *
 * Tests CAPE_AUDIT_EVENTS constants and emitCapeAuditEvent helper.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/audit-logger", () => ({
  auditLog: (...args: any[]) => mockAuditLog(...args),
  AuditSeverity: {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
  },
}));

// Import after mocks
import {
  CAPE_AUDIT_EVENTS,
  emitCapeAuditEvent,
} from "@/lib/audit/cape-audit-events";

// ─── CAPE_AUDIT_EVENTS ─────────────────────────────────────────────────────

describe("CAPE_AUDIT_EVENTS", () => {
  it("defines all expected event types", () => {
    const expected = [
      "GRIEVANCE_DRAFT_SAVED",
      "GRIEVANCE_SUBMITTED",
      "EMPLOYER_CONTACT_ADDED",
      "EMPLOYER_CONTACT_UPDATED",
      "EMPLOYER_CONTACT_DELETED",
      "EMPLOYER_COMMUNICATION_LOGGED",
      "EMPLOYER_COMMUNICATION_SENT",
      "LEADERSHIP_REPORT_VIEWED",
      "LEADERSHIP_REPORT_EXPORTED",
      "PILOT_CHECKLIST_ITEM_COMPLETED",
      "PILOT_CHECKLIST_COMPLETED",
      "PILOT_DEMO_DATA_SEEDED",
      "PILOT_DEMO_DATA_PURGED",
    ];
    for (const key of expected) {
      expect(CAPE_AUDIT_EVENTS).toHaveProperty(key);
    }
  });

  it("uses dot-separated event names", () => {
    for (const value of Object.values(CAPE_AUDIT_EVENTS)) {
      expect(value).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it("has unique event values", () => {
    const values = Object.values(CAPE_AUDIT_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ─── emitCapeAuditEvent ─────────────────────────────────────────────────────

describe("emitCapeAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls auditLog with MEDIUM severity by default", async () => {
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.GRIEVANCE_SUBMITTED,
      userId: "user_1",
      organizationId: "org_1",
      resource: "grievances",
      resourceId: "grv_1",
    });

    expect(mockAuditLog).toHaveBeenCalledOnce();
    const arg = mockAuditLog.mock.calls[0][0];
    expect(arg.eventType).toBe("grievance.submitted");
    expect(arg.severity).toBe("medium");
    expect(arg.userId).toBe("user_1");
    expect(arg.organizationId).toBe("org_1");
    expect(arg.resource).toBe("grievances");
    expect(arg.resourceId).toBe("grv_1");
    expect(arg.outcome).toBe("success");
  });

  it("extracts action from eventType", async () => {
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.EMPLOYER_CONTACT_ADDED,
    });

    const arg = mockAuditLog.mock.calls[0][0];
    expect(arg.action).toBe("contact_added");
  });

  it("passes details through to auditLog", async () => {
    const details = { grievanceNumber: "GRV-123", type: "individual" };
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.GRIEVANCE_SUBMITTED,
      details,
    });

    const arg = mockAuditLog.mock.calls[0][0];
    expect(arg.details).toEqual(details);
  });

  it("allows severity override", async () => {
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.PILOT_DEMO_DATA_PURGED,
      // @ts-expect-error — testing raw string override
      severity: "high",
    });

    const arg = mockAuditLog.mock.calls[0][0];
    expect(arg.severity).toBe("high");
  });

  it("handles missing optional parameters", async () => {
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.LEADERSHIP_REPORT_VIEWED,
    });

    expect(mockAuditLog).toHaveBeenCalledOnce();
    const arg = mockAuditLog.mock.calls[0][0];
    expect(arg.userId).toBeUndefined();
    expect(arg.organizationId).toBeUndefined();
    expect(arg.resourceId).toBeUndefined();
  });
});
