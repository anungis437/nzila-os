import { describe, it, expect } from "vitest";
import {
  runEmployerExecutionComplianceChecks,
  summarizeRuleResolutionForCompliance,
} from "../../services/employer-execution/compliance-engine";
import type { RuleResolutionResult } from "../../services/employer-execution/types";

type Ctx = Parameters<typeof runEmployerExecutionComplianceChecks>[0];

function cleanContext(overrides: Partial<Ctx> = {}): Ctx {
  return {
    missingClassificationCount: 0,
    missingEmploymentLinkageCount: 0,
    hasActiveRuleVersion: true,
    ruleVersionExpired: false,
    remittanceGenerated: true,
    officialApprovalAttempted: false,
    payrollRunApproved: true,
    adjustmentWithoutApprovalCount: 0,
    replayMismatchCount: 0,
    suspiciousVarianceCount: 0,
    ...overrides,
  };
}

describe("runEmployerExecutionComplianceChecks", () => {
  it("returns a single compliance_clear info event when nothing is wrong", () => {
    const events = runEmployerExecutionComplianceChecks(cleanContext());
    expect(events).toHaveLength(1);
    expect(events[0].eventCode).toBe("compliance_clear");
    expect(events[0].severity).toBe("info");
    expect(events[0].blocking).toBe(false);
  });

  it("flags missing classification as a non-blocking error", () => {
    const events = runEmployerExecutionComplianceChecks(
      cleanContext({ missingClassificationCount: 3 }),
    );
    const ev = events.find((e) => e.eventCode === "missing_classification")!;
    expect(ev.severity).toBe("error");
    expect(ev.blocking).toBe(false);
    expect(ev.details).toEqual({ count: 3 });
  });

  it("flags missing employment linkage as critical and blocking", () => {
    const events = runEmployerExecutionComplianceChecks(
      cleanContext({ missingEmploymentLinkageCount: 2 }),
    );
    const ev = events.find((e) => e.eventCode === "missing_employment_linkage")!;
    expect(ev.severity).toBe("critical");
    expect(ev.blocking).toBe(true);
  });

  it("flags missing and expired rule versions", () => {
    const events = runEmployerExecutionComplianceChecks(
      cleanContext({ hasActiveRuleVersion: false, ruleVersionExpired: true }),
    );
    expect(events.some((e) => e.eventCode === "missing_or_expired_cba_rule_version")).toBe(true);
    expect(events.some((e) => e.eventCode === "expired_rule_version")).toBe(true);
  });

  it("flags approval attempted without approved run", () => {
    const events = runEmployerExecutionComplianceChecks(
      cleanContext({ officialApprovalAttempted: true, payrollRunApproved: false }),
    );
    expect(events.some((e) => e.eventCode === "payroll_run_without_approval")).toBe(true);
  });

  it("warns when approval attempted but remittance not generated", () => {
    const events = runEmployerExecutionComplianceChecks(
      cleanContext({ officialApprovalAttempted: true, remittanceGenerated: false }),
    );
    const ev = events.find((e) => e.eventCode === "remittance_due_soon_not_generated")!;
    expect(ev.severity).toBe("warning");
    expect(ev.blocking).toBe(false);
  });

  it("flags replay variance, adjustment-without-approval, and suspicious variance", () => {
    const events = runEmployerExecutionComplianceChecks(
      cleanContext({
        replayMismatchCount: 4,
        adjustmentWithoutApprovalCount: 1,
        suspiciousVarianceCount: 5,
      }),
    );
    expect(events.find((e) => e.eventCode === "replay_variance_detected")!.details).toEqual({
      mismatchCount: 4,
    });
    expect(events.some((e) => e.eventCode === "adjustment_without_approval")).toBe(true);
    expect(events.find((e) => e.eventCode === "suspicious_variance_threshold")!.details).toEqual({
      count: 5,
    });
    // multiple violations -> no compliance_clear event
    expect(events.some((e) => e.eventCode === "compliance_clear")).toBe(false);
  });
});

describe("summarizeRuleResolutionForCompliance", () => {
  it("summarizes the resolved rule version, source hash, and trace step count", () => {
    const result = {
      ruleVersionId: "rv-1",
      ruleVersionCode: "RV-1",
      sourceHash: "abc123",
      trace: [
        { step: "resolve", outcome: "ok" },
        { step: "flatten", outcome: "ok" },
      ],
      rules: { version: {}, items: [] },
      executableRules: [],
      flattenedValues: {} as RuleResolutionResult["flattenedValues"],
    } as RuleResolutionResult;
    expect(summarizeRuleResolutionForCompliance(result)).toEqual({
      resolvedRuleVersion: "RV-1",
      sourceHash: "abc123",
      traceSteps: 2,
    });
  });
});
