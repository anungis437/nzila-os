import { createHash } from "crypto";
import {
  buildExecutableRules,
  calculatePayrollRun,
  replayDiff,
  type ExecutableRule,
  type FlattenedRuleValues,
  type ReplayDiffEntry,
} from "@/services/financial-service/src/services/employer-execution";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type RuleItemInput = {
  id?: string;
  itemType?: string;
  ruleCode?: string;
  precedence?: number;
  conditionJson?: Record<string, unknown>;
  actionJson?: Record<string, unknown>;
};

export type ResolvedPayrollRules = {
  ruleVersionId?: string;
  ruleVersionCode?: string;
  sourceHash?: string;
  executableRules: ExecutableRule[];
  values: FlattenedRuleValues;
  ruleResolution: Array<Record<string, unknown>>;
  appliedRules: Array<Record<string, unknown>>;
};

export type CsvEntry = {
  rowNumber: number;
  employeeExternalId: string;
  shiftDate: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  travelHours: number;
  premiumCode?: string;
  validationErrors: string[];
  classificationCode?: string;
  regionCode?: string;
};

export function normalizeCsv(csvContent: string): {
  entries: CsvEntry[];
  summary: { rows: number; valid: number; invalid: number; duplicates: number };
} {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return { entries: [], summary: { rows: 0, valid: 0, invalid: 0, duplicates: 0 } };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const data = lines.slice(1);
  const at = (row: string[], key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? row[idx]?.trim() ?? "" : "";
  };

  let valid = 0;
  let invalid = 0;
  let duplicates = 0;
  const seen = new Set<string>();

  const entries = data.map((line, idx) => {
    const row = line.split(",");
    const employeeExternalId = at(row, "employee_external_id");
    const shiftDate = at(row, "shift_date");
    const regularHours = Number(at(row, "regular_hours") || "0");
    const overtimeHours = Number(at(row, "overtime_hours") || "0");
    const doubletimeHours = Number(at(row, "doubletime_hours") || "0");
    const travelHours = Number(at(row, "travel_hours") || "0");
    const premiumCode = at(row, "premium_code") || undefined;
    const classificationCode = at(row, "classification_code") || undefined;
    const regionCode = at(row, "region_code") || undefined;

    const validationErrors: string[] = [];
    if (!employeeExternalId) validationErrors.push("missing_employee_external_id");
    if (!shiftDate) validationErrors.push("missing_shift_date");
    if ([regularHours, overtimeHours, doubletimeHours, travelHours].some((n) => Number.isNaN(n) || n < 0)) {
      validationErrors.push("invalid_hours");
    }

    const rowHash = sha256(`${employeeExternalId}|${shiftDate}|${regularHours}|${overtimeHours}|${doubletimeHours}|${travelHours}`);
    if (seen.has(rowHash)) {
      validationErrors.push("duplicate_row");
      duplicates += 1;
    }
    seen.add(rowHash);

    if (validationErrors.length) invalid += 1;
    else valid += 1;

    return {
      rowNumber: idx + 2,
      employeeExternalId,
      shiftDate,
      regularHours,
      overtimeHours,
      doubletimeHours,
      travelHours,
      premiumCode,
      classificationCode,
      regionCode,
      validationErrors,
    };
  });

  return { entries, summary: { rows: data.length, valid, invalid, duplicates } };
}

export function resolvePayrollRules(input: {
  ruleVersionId?: string;
  ruleVersionCode?: string;
  sourceHash?: string;
  rulesJson?: Record<string, unknown>;
  ruleItems?: RuleItemInput[];
  classificationCode?: string;
  regionCode?: string;
  workDate?: string;
}): ResolvedPayrollRules {
  const ruleVersionId = input.ruleVersionId ?? "unknown_rule_version";
  const { executableRules, flattenedValues, trace } = buildExecutableRules({
    ruleVersionId,
    rulesJson: input.rulesJson ?? {},
    items: (input.ruleItems ?? []).map((item) => ({
      id: item.id,
      ruleCode: item.ruleCode ?? "unknown_rule",
      itemType: item.itemType ?? "unknown",
      precedence: item.precedence ?? 0,
      conditionJson: item.conditionJson,
      actionJson: item.actionJson,
    })),
  });

  const ruleResolution: Array<Record<string, unknown>> = [
    {
      source: "service_rule_resolution",
      workDate: input.workDate,
      classificationCode: input.classificationCode,
      regionCode: input.regionCode,
      traceSteps: trace.length,
    },
    ...trace,
  ];

  return {
    ruleVersionId: input.ruleVersionId,
    ruleVersionCode: input.ruleVersionCode,
    sourceHash: input.sourceHash,
    executableRules,
    values: flattenedValues,
    ruleResolution,
    appliedRules: executableRules.map((rule) => ({
      kind: rule.kind,
      strategy: rule.strategy,
      sourceRuleId: rule.sourceRuleId,
      path: rule.path,
    })),
  };
}

export function calculatePayroll(
  entries: CsvEntry[],
  resolvedRules: ResolvedPayrollRules,
  options: { engineVersion: string; periodStart: string; periodEnd: string },
) {
  const result = calculatePayrollRun({
    engineVersion: options.engineVersion,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    entries,
    resolvedRules,
  });

  return {
    ...result,
    calcTrace: result.trace,
    calcTraceHash: result.traceHash,
  };
}

export type ReplayDifference = ReplayDiffEntry;

export function buildReplayDiff(
  original: Record<string, unknown>,
  replayed: Record<string, unknown>,
  reasonHint: string,
  options?: {
    scope?: ReplayDiffEntry["scope"];
    subjectId?: string;
    originalRulePath?: string[];
    replayRulePath?: string[];
  },
) {
  return replayDiff(original, replayed, reasonHint, options);
}

export function createEvidencePack(input: {
  entityType: "payroll_run" | "remittance_run";
  runRefId: string;
  organizationId: string;
  createdBy?: string | null;
  artifacts: Array<{
    artifactType:
      | "summary"
      | "evidence_manifest"
      | "evidence_seal"
      | "payroll_snapshot"
      | "payroll_trace"
      | "remittance_csv"
      | "remittance_json";
    artifactName: string;
    payload: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
}) {
  const normalizedArtifacts = input.artifacts.map((a) => ({
    artifactType: a.artifactType,
    artifactName: a.artifactName,
    artifactHash: sha256(JSON.stringify(a.payload)),
  }));

  const manifest = {
    entityType: input.entityType,
    runRefId: input.runRefId,
    organizationId: input.organizationId,
    generatedAt: new Date().toISOString(),
    inputRefs: input.metadata.inputRefs ?? null,
    timesheetBatchIds: input.metadata.timesheetBatchIds ?? [],
    ruleVersionIds: input.metadata.ruleVersionIds ?? [],
    engineVersion: input.metadata.engineVersion ?? null,
    status: input.metadata.status ?? null,
    statusTimestamps: input.metadata.statusTimestamps ?? {},
    approvers: input.metadata.approvers ?? [],
    calcTraceSummaryHash: input.metadata.calcTraceSummaryHash ?? null,
    artifacts: normalizedArtifacts,
    metadata: input.metadata,
  };

  const manifestHash = sha256(JSON.stringify(manifest));
  const seal = sha256(`${input.entityType}:${input.runRefId}:${manifestHash}`);

  return {
    manifest,
    manifestHash,
    seal,
  };
}

export type PayrollLifecycleStatus = "draft" | "calculated" | "approved" | "posted";
export type PayrollLifecycleAction = "approve" | "seal";

export function enforcePayrollLifecycleTransition(input: {
  status: PayrollLifecycleStatus;
  action: PayrollLifecycleAction;
  immutableSnapshotLocked: boolean;
  criticalOpenCount: number;
  errorOpenCount: number;
  acknowledgedErrorCount: number;
}) {
  if (input.immutableSnapshotLocked && input.action === "approve") {
    throw new Error("Official run is immutable after approval; create an adjustment run");
  }

  if (input.action === "approve") {
    if (input.status !== "calculated") {
      throw new Error("Official run can only be approved from calculated status");
    }
    if (input.criticalOpenCount > 0) {
      throw new Error("Cannot approve official payroll run while critical compliance events are unresolved");
    }
    if (input.errorOpenCount > 0 && input.acknowledgedErrorCount !== input.errorOpenCount) {
      throw new Error("All error-severity compliance events must be acknowledged before approval");
    }
    return;
  }

  if (input.action === "seal") {
    if (input.status !== "approved") {
      throw new Error("Only approved payroll runs can be sealed");
    }
  }
}
