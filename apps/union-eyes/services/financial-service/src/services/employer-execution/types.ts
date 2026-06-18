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

export type RuleCompositionMode = "replace" | "augment" | "stack" | "suppress";

export type RuleScope = {
  employerId?: string | null;
  bargainingUnitId?: string | null;
  worksiteId?: string | null;
  regionCode?: string | null;
  classificationCode?: string | null;
};

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

export type ExecutableRuleKind =
  | "base_rate"
  | "overtime"
  | "double_time"
  | "shift_premium"
  | "travel"
  | "dues"
  | "benefits"
  | "pension"
  | "statutory_holiday"
  | "regional_override"
  | "classification_override";

export type ExecutableRule = {
  kind: ExecutableRuleKind;
  strategy: RuleStrategy;
  sourceRuleId: string;
  ruleCode: string;
  precedence: number;
  compositionMode: RuleCompositionMode;
  scope: RuleScope;
  conditions?: Record<string, unknown>;
  action: Record<string, unknown>;
  path: string[];
  amount?: number;
  multiplier?: number;
  thresholdHours?: number;
  holidayCode?: string;
  targetRuleKind?: string;
};

export type RuleEvaluationNode = {
  nodeId: string;
  payrollRunId: string;
  employeeExternalId: string;
  ruleKind: string;
  ruleCode: string;
  sourceRuleId: string;
  strategy: string;
  precedence: number;
  conditionResult: "true" | "false" | "not_applicable";
  decision: "considered" | "skipped" | "superseded" | "applied";
  decisionReason: string;
  parentNodeId?: string | null;
  supersededByNodeId?: string | null;
  compositionMode: RuleCompositionMode;
  path: string[];
  evaluationOrder: number;
  inputSnapshotHash: string;
  createdAt: string;
};

export type EvaluationGraphDiffEntry = {
  employeeExternalId: string;
  nodeId?: string;
  changeType:
    | "node_added"
    | "node_removed"
    | "condition_changed"
    | "decision_changed"
    | "supersession_changed"
    | "applied_path_changed"
    | "value_changed";
  original?: Record<string, unknown>;
  replay?: Record<string, unknown>;
  causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
  causeDetail: string;
};

export type EvidenceChainLink = {
  linkId: string;
  organizationId: string;
  entityType: "payroll_run" | "remittance_run" | "replay" | "approval" | "adjustment_run";
  targetEntityId: string;
  parentLinkId?: string | null;
  parentSealHash?: string | null;
  manifestHash: string;
  sealHash: string;
  chainDepth: number;
  createdAt: string;
};

export type EvidenceChainVerification = {
  valid: boolean;
  checkedLinks: number;
  brokenAt?: string;
  issues: string[];
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
    compositionTrace?: Array<Record<string, unknown>>;
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
  graphDifferences: EvaluationGraphDiffEntry[];
  summary: string;
};

export type ReplayDiffEntry = {
  scope: "run" | "employee_item" | "remittance_item";
  subjectId: string;
  field: string;
  originalValue: any;
  replayValue: any;
  causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
  causeDetail: string;
  originalRulePath?: string[];
  replayRulePath?: string[];
};
