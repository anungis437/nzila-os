import type { RuleResolutionResult } from "./types";

type ComplianceContext = {
  missingClassificationCount: number;
  missingEmploymentLinkageCount: number;
  hasActiveRuleVersion: boolean;
  remittanceGenerated: boolean;
  officialApprovalAttempted: boolean;
  replayMismatchCount: number;
};

export function runEmployerExecutionComplianceChecks(context: ComplianceContext) {
  const events: Array<{
    eventCode: string;
    severity: "warning" | "high" | "critical";
    blocking: boolean;
    summary: string;
    details?: Record<string, unknown>;
  }> = [];

  if (context.missingClassificationCount > 0) {
    events.push({
      eventCode: "missing_classification",
      severity: "high",
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
      severity: "high",
      blocking: false,
      summary: "Replay variance detected between original and replayed payroll outcomes",
      details: { mismatchCount: context.replayMismatchCount },
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
