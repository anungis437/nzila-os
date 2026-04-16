import { createHash } from "crypto";
import {
  buildExecutableRules,
  calculatePayrollRun,
  diffEvaluationGraph,
  replayDiff,
  type EvidenceChainLink,
  type ExecutableRule,
  type FlattenedRuleValues,
  type ReplayDiff,
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
  compositionTrace: Array<Record<string, unknown>>;
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

  const compositionTrace = trace.filter((step) => step.step === "rule_item_composed");

  return {
    ruleVersionId: input.ruleVersionId,
    ruleVersionCode: input.ruleVersionCode,
    sourceHash: input.sourceHash,
    executableRules,
    values: flattenedValues,
    ruleResolution,
    compositionTrace,
    appliedRules: executableRules.map((rule) => ({
      kind: rule.kind,
      strategy: rule.strategy,
      sourceRuleId: rule.sourceRuleId,
      ruleCode: rule.ruleCode,
      compositionMode: rule.compositionMode,
      precedence: rule.precedence,
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

export type ReplayGraphDifference = ReplayDiff["graphDifferences"][number];

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

export function buildEvaluationGraphDiff(input: {
  employeeExternalId: string;
  originalTrace: unknown;
  replayTrace: unknown;
  causeDetail: string;
}) {
  return diffEvaluationGraph(input);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createEvidenceChainLink(input: {
  organizationId: string;
  entityType: EvidenceChainLink["entityType"];
  targetEntityId: string;
  manifestHash: string;
  sealHash: string;
  parent?: Pick<EvidenceChainLink, "linkId" | "sealHash" | "chainDepth"> | null;
}): EvidenceChainLink {
  return {
    linkId: sha256(`${input.entityType}:${input.targetEntityId}:${input.manifestHash}`),
    organizationId: input.organizationId,
    entityType: input.entityType,
    targetEntityId: input.targetEntityId,
    parentLinkId: input.parent?.linkId ?? null,
    parentSealHash: input.parent?.sealHash ?? null,
    manifestHash: input.manifestHash,
    sealHash: input.sealHash,
    chainDepth: (input.parent?.chainDepth ?? 0) + 1,
    createdAt: nowIso(),
  };
}

export function verifyEvidenceChainFromLinks(chain: EvidenceChainLink[]): {
  valid: boolean;
  checkedLinks: number;
  brokenAt?: string;
  issues: string[];
} {
  if (chain.length === 0) {
    return { valid: false, checkedLinks: 0, issues: ["No evidence chain links found"] };
  }

  const byId = new Map(chain.map((link) => [link.linkId, link]));
  const issues: string[] = [];
  let checkedLinks = 0;
  let brokenAt: string | undefined;

  for (const link of chain) {
    checkedLinks += 1;
    if (!link.parentLinkId) continue;
    const parent = byId.get(link.parentLinkId);
    if (!parent) {
      brokenAt = link.linkId;
      issues.push(`Missing parent link ${link.parentLinkId} for ${link.linkId}`);
      continue;
    }
    if (link.parentSealHash !== parent.sealHash) {
      brokenAt = link.linkId;
      issues.push(`Parent seal mismatch for ${link.linkId}`);
    }
    if (link.chainDepth !== parent.chainDepth + 1) {
      brokenAt = link.linkId;
      issues.push(`Invalid chain depth transition for ${link.linkId}`);
    }
  }

  return {
    valid: issues.length === 0,
    checkedLinks,
    brokenAt,
    issues,
  };
}

export function createEvidencePack(input: {
  entityType: "payroll_run" | "remittance_run" | "replay" | "approval" | "adjustment_run";
  runRefId: string;
  organizationId: string;
  createdBy?: string | null;
  artifacts: Array<{
    artifactType:
      | "summary"
      | "evidence_manifest"
      | "evidence_seal"
      | "replay_diff"
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
  const chainLink = createEvidenceChainLink({
    organizationId: input.organizationId,
    entityType: input.entityType,
    targetEntityId: input.runRefId,
    manifestHash,
    sealHash: seal,
    parent:
      typeof input.metadata.parentLink === "object" && input.metadata.parentLink !== null
        ? (input.metadata.parentLink as Pick<EvidenceChainLink, "linkId" | "sealHash" | "chainDepth">)
        : null,
  });

  return {
    manifest,
    manifestHash,
    seal,
    chainLink,
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
