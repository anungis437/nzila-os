import { createHash } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type RuleItemInput = {
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
  values: {
    baseRate: number;
    overtimeMultiplier: number;
    doubleTimeMultiplier: number;
    shiftPremiumRate: number;
    travelPremiumRate: number;
    duesRate: number;
    benefitRate: number;
    pensionRate: number;
    statutoryHolidayMultiplier: number;
    regionalOverride: number;
    classificationOverride: number;
  };
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

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickActionNumber(actionJson: Record<string, unknown> | undefined): number | null {
  if (!actionJson) return null;
  const keys = ["rate", "multiplier", "value", "amount", "percent"];
  for (const key of keys) {
    const parsed = toNumber(actionJson[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pickRuleFromJson(rulesJson: Record<string, unknown> | undefined, keys: string[], fallback: number): number {
  for (const key of keys) {
    const parsed = toNumber(rulesJson?.[key]);
    if (parsed !== null) return parsed;
  }
  return fallback;
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
  const defaults = {
    baseRate: pickRuleFromJson(input.rulesJson, ["base_rate", "baseRate", "hourly_rate"], 0),
    overtimeMultiplier: pickRuleFromJson(input.rulesJson, ["overtime", "overtime_multiplier"], 1.5),
    doubleTimeMultiplier: pickRuleFromJson(input.rulesJson, ["double_time", "doubletime_multiplier"], 2),
    shiftPremiumRate: pickRuleFromJson(input.rulesJson, ["shift_premium", "shiftPremium"], 0),
    travelPremiumRate: pickRuleFromJson(input.rulesJson, ["travel", "travel_premium"], 0.5),
    duesRate: pickRuleFromJson(input.rulesJson, ["dues", "dues_rate"], 0),
    benefitRate: pickRuleFromJson(input.rulesJson, ["benefits", "benefit", "benefit_rate"], 0),
    pensionRate: pickRuleFromJson(input.rulesJson, ["pension", "pension_rate"], 0),
    statutoryHolidayMultiplier: pickRuleFromJson(input.rulesJson, ["statutory_holiday", "holiday_multiplier"], 1),
    regionalOverride: pickRuleFromJson(input.rulesJson, ["regional_override", "regionalOverride"], 1),
    classificationOverride: pickRuleFromJson(input.rulesJson, ["classification_override", "classificationOverride"], 1),
  };

  const resolved = { ...defaults };
  const ruleResolution: Array<Record<string, unknown>> = [
    {
      source: "rules_json_defaults",
      values: defaults,
      workDate: input.workDate,
      classificationCode: input.classificationCode,
      regionCode: input.regionCode,
    },
  ];
  const appliedRules: Array<Record<string, unknown>> = [];

  const sortedItems = [...(input.ruleItems ?? [])].sort((a, b) => (a.precedence ?? 0) - (b.precedence ?? 0));
  for (const item of sortedItems) {
    const value = pickActionNumber(item.actionJson);
    if (value === null) continue;

    const normalizedCode = (item.ruleCode ?? "").toLowerCase();
    const normalizedType = (item.itemType ?? "").toLowerCase();
    const bucket = `${normalizedType}:${normalizedCode}`;
    let appliedField: keyof typeof resolved | null = null;

    if (normalizedType === "base_rate" || normalizedCode.includes("base_rate")) appliedField = "baseRate";
    else if (normalizedType === "overtime" || normalizedCode.includes("overtime")) appliedField = "overtimeMultiplier";
    else if (normalizedType === "doubletime" || normalizedCode.includes("double_time")) appliedField = "doubleTimeMultiplier";
    else if (normalizedType === "premium" || normalizedCode.includes("shift_premium")) appliedField = "shiftPremiumRate";
    else if (normalizedType === "travel" || normalizedCode.includes("travel")) appliedField = "travelPremiumRate";
    else if (normalizedType === "dues" || normalizedCode.includes("dues")) appliedField = "duesRate";
    else if (normalizedType === "benefit" || normalizedCode.includes("benefit")) appliedField = "benefitRate";
    else if (normalizedType === "pension" || normalizedCode.includes("pension")) appliedField = "pensionRate";
    else if (normalizedCode.includes("statutory_holiday")) appliedField = "statutoryHolidayMultiplier";
    else if (normalizedCode.includes("regional_override")) appliedField = "regionalOverride";
    else if (normalizedCode.includes("classification_override")) appliedField = "classificationOverride";

    if (!appliedField) continue;

    const previous = resolved[appliedField];
    resolved[appliedField] = value;
    appliedRules.push({
      ruleCode: item.ruleCode,
      itemType: item.itemType,
      precedence: item.precedence,
      bucket,
      appliedField,
      previous,
      next: value,
    });
  }

  ruleResolution.push({
    source: "rule_items",
    count: sortedItems.length,
    overridesApplied: appliedRules.length,
  });

  return {
    ruleVersionId: input.ruleVersionId,
    ruleVersionCode: input.ruleVersionCode,
    sourceHash: input.sourceHash,
    values: resolved,
    ruleResolution,
    appliedRules,
  };
}

export function calculatePayroll(
  entries: CsvEntry[],
  resolvedRules: ResolvedPayrollRules,
  options: { engineVersion: string; periodStart: string; periodEnd: string },
) {
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.rowNumber !== b.rowNumber) return a.rowNumber - b.rowNumber;
    if (a.employeeExternalId !== b.employeeExternalId) return a.employeeExternalId.localeCompare(b.employeeExternalId);
    return a.shiftDate.localeCompare(b.shiftDate);
  });

  const snapshot = {
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    engineVersion: options.engineVersion,
    ruleVersionId: resolvedRules.ruleVersionId,
    ruleVersionCode: resolvedRules.ruleVersionCode,
    sourceHash: resolvedRules.sourceHash,
    ruleInputs: resolvedRules.values,
    entries: sortedEntries,
  };
  const snapshotHash = sha256(JSON.stringify(snapshot));

  const items = sortedEntries.map((entry) => {
    const regularBase = entry.regularHours * resolvedRules.values.baseRate;
    const overtimeBase = entry.overtimeHours * resolvedRules.values.baseRate * resolvedRules.values.overtimeMultiplier;
    const doubleTimeBase = entry.doubletimeHours * resolvedRules.values.baseRate * resolvedRules.values.doubleTimeMultiplier;
    const travelPremium = entry.travelHours * resolvedRules.values.baseRate * resolvedRules.values.travelPremiumRate;
    const shiftPremium = entry.premiumCode ? regularBase * resolvedRules.values.shiftPremiumRate : 0;

    const statutoryHolidayAmount =
      (regularBase + overtimeBase + doubleTimeBase) *
      (resolvedRules.values.statutoryHolidayMultiplier - 1);

    const grossPreOverride = regularBase + overtimeBase + doubleTimeBase + travelPremium + shiftPremium + statutoryHolidayAmount;
    const overrideFactor = resolvedRules.values.regionalOverride * resolvedRules.values.classificationOverride;
    const grossPay = round2(grossPreOverride * overrideFactor);

    const duesAmount = round2(grossPay * resolvedRules.values.duesRate);
    const benefitAmount = round2(grossPay * resolvedRules.values.benefitRate);
    const pensionAmount = round2(grossPay * resolvedRules.values.pensionRate);
    const netPay = round2(grossPay - duesAmount - benefitAmount - pensionAmount);

    const calcTrace = {
      rule_resolution: resolvedRules.ruleResolution,
      applied_rules: resolvedRules.appliedRules,
      intermediate_steps: [
        { step: "regular_base", value: round2(regularBase) },
        { step: "overtime", value: round2(overtimeBase), multiplier: resolvedRules.values.overtimeMultiplier },
        { step: "double_time", value: round2(doubleTimeBase), multiplier: resolvedRules.values.doubleTimeMultiplier },
        { step: "travel", value: round2(travelPremium), rate: resolvedRules.values.travelPremiumRate },
        { step: "shift_premium", value: round2(shiftPremium), rate: resolvedRules.values.shiftPremiumRate },
        { step: "statutory_holiday", value: round2(statutoryHolidayAmount), multiplier: resolvedRules.values.statutoryHolidayMultiplier },
        { step: "regional_override", value: resolvedRules.values.regionalOverride },
        { step: "classification_override", value: resolvedRules.values.classificationOverride },
      ],
      final_values: {
        grossPay,
        duesAmount,
        benefitAmount,
        pensionAmount,
        netPay,
      },
    };

    return {
      employeeExternalId: entry.employeeExternalId,
      grossPay,
      netPay,
      duesAmount,
      benefitAmount,
      pensionAmount,
      remittanceGroupKey: "default",
      trace: calcTrace,
      traceHash: sha256(JSON.stringify(calcTrace)),
    };
  });

  const totals = items.reduce(
    (acc, item) => {
      acc.gross += item.grossPay;
      acc.net += item.netPay;
      acc.dues += item.duesAmount;
      acc.benefits += item.benefitAmount;
      acc.pension += item.pensionAmount;
      return acc;
    },
    { gross: 0, net: 0, dues: 0, benefits: 0, pension: 0 },
  );

  const calcTrace = {
    stage_order: ["input_snapshot", "rule_resolution", "calculation", "compliance_checks", "calc_trace_persistence"],
    engineVersion: options.engineVersion,
    ruleVersionId: resolvedRules.ruleVersionId,
    ruleVersionCode: resolvedRules.ruleVersionCode,
    sourceHash: resolvedRules.sourceHash,
    ruleInputs: resolvedRules.values,
    snapshotHash,
    totals,
    itemCount: items.length,
  };

  return {
    items,
    totals,
    calcTrace,
    calcTraceHash: sha256(JSON.stringify(calcTrace)),
    snapshotHash,
  };
}

export type ReplayDifference = {
  field: string;
  original: unknown;
  replay: unknown;
  reason: string;
};

export function buildReplayDiff(original: Record<string, unknown>, replayed: Record<string, unknown>, reasonHint: string) {
  const keys = new Set([...Object.keys(original), ...Object.keys(replayed)]);
  const differences: ReplayDifference[] = [];

  for (const field of keys) {
    if (JSON.stringify(original[field]) !== JSON.stringify(replayed[field])) {
      differences.push({
        field,
        original: original[field],
        replay: replayed[field],
        reason: reasonHint,
      });
    }
  }

  return {
    differences,
    changed: differences.length > 0,
    summary:
      differences.length > 0
        ? `Replay changed ${differences.length} field(s): ${differences.map((d) => d.field).join(", ")}`
        : "Replay matched original output",
  };
}

export function createEvidencePack(input: {
  entityType: "payroll_run" | "remittance_run";
  runRefId: string;
  organizationId: string;
  createdBy?: string | null;
  artifacts: Array<{ artifactType: "summary" | "evidence_manifest" | "evidence_seal" | "payroll_snapshot" | "payroll_trace" | "remittance_csv" | "remittance_json"; artifactName: string; payload: Record<string, unknown> }>;
  metadata: Record<string, unknown>;
}) {
  const manifest = {
    entityType: input.entityType,
    runRefId: input.runRefId,
    metadata: input.metadata,
    artifacts: input.artifacts.map((a) => ({
      artifactType: a.artifactType,
      artifactName: a.artifactName,
      artifactHash: sha256(JSON.stringify(a.payload)),
    })),
    generatedAt: new Date().toISOString(),
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
  highOpenCount: number;
  acknowledgedHighCount: number;
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
    if (input.highOpenCount > 0 && input.acknowledgedHighCount !== input.highOpenCount) {
      throw new Error("All high-severity compliance events must be acknowledged before approval");
    }
    return;
  }

  if (input.action === "seal") {
    if (input.status !== "approved") {
      throw new Error("Only approved payroll runs can be sealed");
    }
  }
}
