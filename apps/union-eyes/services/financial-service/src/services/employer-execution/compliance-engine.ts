import type { RuleResolutionResult } from "./types";

type ComplianceContext = {
  missingClassificationCount: number;
  missingEmploymentLinkageCount: number;
  hasActiveRuleVersion: boolean;
  ruleVersionExpired: boolean;
  remittanceGenerated: boolean;
  officialApprovalAttempted: boolean;
  payrollRunApproved: boolean;
  adjustmentWithoutApprovalCount: number;
  replayMismatchCount: number;
  suspiciousVarianceCount: number;
};

export function runEmployerExecutionComplianceChecks(context: ComplianceContext) {
  const events: Array<{
    eventCode: string;
    severity: "info" | "warning" | "error" | "critical";
    blocking: boolean;
    summary: string;
    details?: Record<string, unknown>;
  }> = [];

  if (context.missingClassificationCount > 0) {
    events.push({
      eventCode: "missing_classification",
      severity: "error",
      blocking: true,
      summary: "Timesheet rows are missing classification mapping",
      details: { count: context.missingClassificationCount },
    });
  }

  if (context.missingEmploymentLinkageCount > 0) {
    events.push({
      eventCode: "missing_employment_linkage",
      severity: "critical",
      blocking: true,
      summary: "Timesheet rows cannot be linked to member employment records",
      details: { count: context.missingEmploymentLinkageCount },
    });
  }

  if (!context.hasActiveRuleVersion) {
    events.push({
      eventCode: "missing_or_expired_cba_rule_version",
      severity: "critical",
      blocking: true,
      summary: "No active CBA rule version was resolved for payroll calculation",
    });
  }

  if (context.ruleVersionExpired) {
    events.push({
      eventCode: "expired_rule_version",
      severity: "critical",
      blocking: true,
      summary: "Resolved CBA rule version is expired for this payroll period",
    });
  }

  if (!context.payrollRunApproved && context.officialApprovalAttempted) {
    events.push({
      eventCode: "payroll_run_without_approval",
      severity: "critical",
      blocking: true,
      summary: "Official payroll progression attempted without an approved run",
    });
  }

  if (context.officialApprovalAttempted && !context.remittanceGenerated) {
    events.push({
      eventCode: "remittance_due_soon_not_generated",
      severity: "warning",
      blocking: false,
      summary: "Official payroll run approved but remittance package has not been generated",
    });
  }

  if (context.replayMismatchCount > 0) {
    events.push({
      eventCode: "replay_variance_detected",
      severity: "error",
      blocking: false,
      summary: "Replay variance detected between original and replayed payroll outcomes",
      details: { mismatchCount: context.replayMismatchCount },
    });
  }

  if (context.adjustmentWithoutApprovalCount > 0) {
    events.push({
      eventCode: "adjustment_without_approval",
      severity: "critical",
      blocking: true,
      summary: "One or more payroll adjustments were created without approval",
      details: { count: context.adjustmentWithoutApprovalCount },
    });
  }

  if (context.suspiciousVarianceCount > 0) {
    events.push({
      eventCode: "suspicious_variance_threshold",
      severity: "error",
      blocking: false,
      summary: "Variance threshold exceeded on payroll replay or adjustment checks",
      details: { count: context.suspiciousVarianceCount },
    });
  }

  if (events.length === 0) {
    events.push({
      eventCode: "compliance_clear",
      severity: "info",
      blocking: false,
      summary: "No compliance violations detected for this execution context",
    });
  }

  return events;
}

export function summarizeRuleResolutionForCompliance(result: RuleResolutionResult) {
  return {
    resolvedRuleVersion: result.ruleVersionCode,
    sourceHash: result.sourceHash,
    traceSteps: result.trace.length,
  };
}
