export type RuleResolutionContext = {
  organizationId: string;
  employerId?: string | null;
  worksiteId?: string | null;
  bargainingUnitId?: string | null;
  jobClassificationCode?: string | null;
  workDate: string;
};

export type RuleResolutionResult = {
  ruleVersionId: string;
  ruleVersionCode: string;
  sourceHash: string;
  trace: Array<{
    step: string;
    outcome: string;
    details?: Record<string, unknown>;
  }>;
  rules: {
    version: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
  };
  executableRules: ExecutableRule[];
  flattenedValues: FlattenedRuleValues;
};

export type ComplianceSeverity = "info" | "warning" | "error" | "critical";

export type RuleStrategy =
  | "hourly"
  | "daily_threshold"
  | "after_threshold"
  | "flat_per_hour"
  | "flat_per_shift"
  | "flat"
  | "per_km"
  | "percent_gross"
  | "per_hour"
  | "calendar_match"
  | "replace"
  | "augment";

export type ExecutableRule =
  | {
      kind: "base_rate";
      strategy: "hourly";
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "overtime";
      strategy: "daily_threshold";
      thresholdHours: number;
      multiplier: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "double_time";
      strategy: "after_threshold";
      thresholdHours: number;
      multiplier: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "shift_premium";
      strategy: "flat_per_hour" | "flat_per_shift";
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "travel";
      strategy: "flat" | "per_km" | "hourly";
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "dues";
      strategy: "percent_gross" | "per_hour" | "flat";
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "benefits";
      strategy: "per_hour" | "percent_gross" | "flat";
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "pension";
      strategy: "per_hour" | "percent_gross" | "flat";
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "statutory_holiday";
      strategy: "calendar_match";
      holidayCode: string;
      multiplier: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "regional_override";
      strategy: "replace" | "augment";
      targetRuleKind: string;
      amount: number;
      sourceRuleId: string;
      path: string[];
    }
  | {
      kind: "classification_override";
      strategy: "replace" | "augment";
      targetRuleKind: string;
      amount: number;
      sourceRuleId: string;
      path: string[];
    };

export type FlattenedRuleValues = {
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

export type NormalizedTimesheetEntry = {
  rowNumber: number;
  employeeExternalId: string;
  shiftDate: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  travelHours: number;
  premiumCode?: string;
  validationErrors: string[];
};

export type PayrollRunInput = {
  engineVersion: string;
  periodStart: string;
  periodEnd: string;
  entries: NormalizedTimesheetEntry[];
  resolvedRules: {
    ruleVersionId?: string;
    ruleVersionCode?: string;
    sourceHash?: string;
    executableRules: ExecutableRule[];
    values: FlattenedRuleValues;
    ruleResolution: Array<Record<string, unknown>>;
    appliedRules: Array<Record<string, unknown>>;
  };
};

export type PayrollRunResult = {
  totals: {
    gross: number;
    net: number;
    dues: number;
    benefits: number;
    pension: number;
  };
  items: Array<{
    employeeExternalId: string;
    grossPay: number;
    netPay: number;
    duesAmount: number;
    benefitAmount: number;
    pensionAmount: number;
    remittanceGroupKey?: string;
    traceHash: string;
    trace: Record<string, unknown>;
  }>;
  trace: Record<string, unknown>;
  traceHash: string;
  snapshotHash: string;
};

export type RemittanceGenerationResult = {
  dueDate: string;
  totalDue: number;
  csvContent: string;
  jsonContent: string;
  summary: Record<string, unknown>;
  hashes: {
    csvHash: string;
    jsonHash: string;
    summaryHash: string;
  };
};

export type ReplayDiff = {
  changed: boolean;
  differences: ReplayDiffEntry[];
  summary: string;
};

export type ReplayDiffEntry = {
  scope: "run" | "employee_item" | "remittance_item";
  subjectId: string;
  field: string;
  originalValue: unknown;
  replayValue: unknown;
  causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
  causeDetail: string;
  originalRulePath?: string[];
  replayRulePath?: string[];
};
