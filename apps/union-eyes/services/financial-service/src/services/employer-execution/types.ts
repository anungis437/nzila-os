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
  rules: Record<string, unknown>;
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
  baseRate: number;
  duesRate: number;
  benefitRate: number;
  pensionRate: number;
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
  fieldsChanged: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  summary: string;
};
