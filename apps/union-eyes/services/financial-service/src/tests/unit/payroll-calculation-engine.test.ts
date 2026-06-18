import { describe, it, expect } from "vitest";
import { calculatePayrollRun } from "../../services/employer-execution/payroll-calculation-engine";
import type {
  ExecutableRule,
  ExecutableRuleKind,
  RuleCompositionMode,
  RuleStrategy,
  NormalizedTimesheetEntry,
  PayrollRunInput,
} from "../../services/employer-execution/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
let ruleSeq = 0;
function makeRule(
  kind: ExecutableRuleKind,
  overrides: Partial<ExecutableRule> = {},
): ExecutableRule {
  ruleSeq += 1;
  return {
    kind,
    strategy: (overrides.strategy ?? "hourly") as RuleStrategy,
    sourceRuleId: overrides.sourceRuleId ?? `src-${kind}-${ruleSeq}`,
    ruleCode: overrides.ruleCode ?? `${kind.toUpperCase()}_${ruleSeq}`,
    precedence: overrides.precedence ?? 100,
    compositionMode: (overrides.compositionMode ?? "replace") as RuleCompositionMode,
    scope: overrides.scope ?? {},
    conditions: overrides.conditions,
    action: overrides.action ?? {},
    path: overrides.path ?? [kind],
    amount: overrides.amount,
    multiplier: overrides.multiplier,
    thresholdHours: overrides.thresholdHours,
    holidayCode: overrides.holidayCode,
    targetRuleKind: overrides.targetRuleKind,
  };
}

const ALL_KINDS: ExecutableRuleKind[] = [
  "base_rate",
  "overtime",
  "double_time",
  "shift_premium",
  "travel",
  "dues",
  "benefits",
  "pension",
  "statutory_holiday",
  "regional_override",
  "classification_override",
];

/** A minimal, fully-valid rule set so calculatePayrollRun does not throw. */
function baselineRules(): ExecutableRule[] {
  return [
    makeRule("base_rate", { strategy: "hourly", amount: 30 }),
    makeRule("overtime", { strategy: "after_threshold", multiplier: 1.5 }),
    makeRule("double_time", { strategy: "after_threshold", multiplier: 2 }),
    makeRule("shift_premium", { strategy: "flat_per_hour", amount: 1 }),
    makeRule("travel", { strategy: "flat", amount: 10 }),
    makeRule("dues", { strategy: "percent_gross", amount: 0.02 }),
    makeRule("benefits", { strategy: "per_hour", amount: 0.5 }),
    makeRule("pension", { strategy: "flat", amount: 25 }),
    makeRule("statutory_holiday", { strategy: "calendar_match", multiplier: 1 }),
    makeRule("regional_override", { strategy: "augment", multiplier: 1 }),
    makeRule("classification_override", { strategy: "augment", multiplier: 1 }),
  ];
}

function makeEntry(overrides: Partial<NormalizedTimesheetEntry> = {}): NormalizedTimesheetEntry {
  return {
    rowNumber: overrides.rowNumber ?? 1,
    employeeExternalId: overrides.employeeExternalId ?? "emp-1",
    shiftDate: overrides.shiftDate ?? "2025-01-15",
    regularHours: overrides.regularHours ?? 40,
    overtimeHours: overrides.overtimeHours ?? 0,
    doubletimeHours: overrides.doubletimeHours ?? 0,
    travelHours: overrides.travelHours ?? 0,
    premiumCode: overrides.premiumCode,
    validationErrors: overrides.validationErrors ?? [],
  };
}

function makeInput(
  rules: ExecutableRule[],
  entries: NormalizedTimesheetEntry[],
  overrides: Partial<PayrollRunInput["resolvedRules"]> = {},
): PayrollRunInput {
  return {
    engineVersion: "1.0.0",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    entries,
    resolvedRules: {
      ruleVersionId: overrides.ruleVersionId ?? "rv-1",
      ruleVersionCode: overrides.ruleVersionCode ?? "RV-1",
      sourceHash: overrides.sourceHash ?? "hash-1",
      executableRules: rules,
      values: overrides.values ?? ({} as PayrollRunInput["resolvedRules"]["values"]),
      ruleResolution: overrides.ruleResolution ?? [],
      appliedRules: overrides.appliedRules ?? [],
      compositionTrace: overrides.compositionTrace,
    },
  };
}

// ---------------------------------------------------------------------------
// Required-rule validation
// ---------------------------------------------------------------------------
describe("calculatePayrollRun — required rule validation", () => {
  it("throws when a required rule kind is missing", () => {
    const rules = baselineRules().filter((r) => r.kind !== "dues");
    expect(() => calculatePayrollRun(makeInput(rules, [makeEntry()]))).toThrow(
      /Missing required executable rule: dues/,
    );
  });

  it("allows a kind to be explicitly suppressed instead of throwing", () => {
    const rules = baselineRules().filter((r) => r.kind !== "dues");
    rules.push(makeRule("dues", { compositionMode: "suppress", amount: 0 }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry()]));
    expect(result.items[0].duesAmount).toBe(0);
  });

  it("treats a disabled rule (conditions.enabled=false) as not present", () => {
    const rules = baselineRules();
    // disable the only base_rate rule -> should throw for base_rate
    rules.find((r) => r.kind === "base_rate")!.conditions = { enabled: false };
    expect(() => calculatePayrollRun(makeInput(rules, [makeEntry()]))).toThrow(
      /Missing required executable rule: base_rate/,
    );
  });

  it("falls back to the neutral value when a multiplier kind is suppressed", () => {
    const rules = baselineRules().filter((r) => r.kind !== "regional_override");
    rules.push(makeRule("regional_override", { compositionMode: "suppress" }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ regularHours: 10 })]));
    // suppressed regional_override -> neutral 1, so gross unchanged: 10*30 + 10 travel = 310
    expect(result.items[0].grossPay).toBe(310);
  });
});

// ---------------------------------------------------------------------------
// Core calculation math
// ---------------------------------------------------------------------------
describe("calculatePayrollRun — core math", () => {
  it("computes regular + overtime + double-time gross pay", () => {
    const rules = baselineRules();
    // strip premiums/travel to isolate the core: set neutral
    const entry = makeEntry({ regularHours: 40, overtimeHours: 5, doubletimeHours: 2 });
    const input = makeInput(rules, [entry]);
    const result = calculatePayrollRun(input);
    const item = result.items[0];

    // regular = 40*30 = 1200, OT = 5*30*1.5 = 225, DT = 2*30*2 = 120
    // travel flat = 10, shift premium = 0 (no premiumCode), stat = 0 (mult 1)
    // subtotal = 1200+225+120+10+0+0 = 1555, *1*1 = 1555
    expect(item.grossPay).toBe(1555);
    // dues 2% of gross = 31.10, benefits 0.5*47h = 23.5, pension flat 25
    expect(item.duesAmount).toBe(31.1);
    expect(item.benefitAmount).toBe(23.5); // (40+5+2+0) * 0.5
    expect(item.pensionAmount).toBe(25);
    expect(item.netPay).toBe(round2(1555 - 31.1 - 23.5 - 25));
  });

  it("applies shift premium only when premiumCode present", () => {
    const rules = baselineRules();
    const withCode = calculatePayrollRun(makeInput(rules, [makeEntry({ premiumCode: "NIGHT" })]));
    const without = calculatePayrollRun(makeInput(rules, [makeEntry()]));
    // flat_per_hour 1 * 40 regular hours = 40 extra
    expect(withCode.items[0].grossPay).toBeGreaterThan(without.items[0].grossPay);
  });

  it("applies a flat_per_shift shift premium", () => {
    const rules = baselineRules().filter((r) => r.kind !== "shift_premium");
    rules.push(makeRule("shift_premium", { strategy: "flat_per_shift", amount: 50 }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ regularHours: 10, premiumCode: "WEEKEND" })]));
    // gross = 10*30 + travel 10 + flat_per_shift 50 = 360
    expect(result.items[0].grossPay).toBe(360);
  });

  it("applies statutory holiday premium (multiplier - 1) above 1", () => {
    const rules = baselineRules();
    rules.find((r) => r.kind === "statutory_holiday")!.multiplier = 1.5;
    const result = calculatePayrollRun(makeInput(rules, [makeEntry()]));
    // base regular = 1200; stat adds 1200*(1.5-1)=600; +travel 10 => 1810
    expect(result.items[0].grossPay).toBe(1810);
  });

  it("scales gross by regional and classification overrides", () => {
    const rules = baselineRules();
    rules.find((r) => r.kind === "regional_override")!.multiplier = 1.1;
    rules.find((r) => r.kind === "classification_override")!.multiplier = 1.2;
    const result = calculatePayrollRun(makeInput(rules, [makeEntry()]));
    // (1200 + 10 travel) * 1.1 * 1.2 = 1597.2
    expect(result.items[0].grossPay).toBe(round2((1200 + 10) * 1.1 * 1.2));
  });
});

// ---------------------------------------------------------------------------
// Deduction strategies
// ---------------------------------------------------------------------------
describe("calculatePayrollRun — deduction strategies", () => {
  it("supports percent_gross, per_hour, and flat deductions", () => {
    const rules = baselineRules();
    // dues percent_gross 0.02, benefits per_hour 0.5, pension flat 25 (already baseline)
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ regularHours: 10 })]));
    const item = result.items[0];
    // gross = 10*30 + 10 travel = 310; dues = 310*0.02 = 6.2
    expect(item.duesAmount).toBe(6.2);
    expect(item.benefitAmount).toBe(5); // 10h * 0.5
    expect(item.pensionAmount).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Composition modes
// ---------------------------------------------------------------------------
describe("calculatePayrollRun — rule composition", () => {
  it("augment/stack rules add their values together", () => {
    const rules = baselineRules().filter((r) => r.kind !== "base_rate");
    rules.push(makeRule("base_rate", { amount: 20, precedence: 1, compositionMode: "replace" }));
    rules.push(makeRule("base_rate", { amount: 5, precedence: 2, compositionMode: "augment" }));
    rules.push(makeRule("base_rate", { amount: 5, precedence: 3, compositionMode: "stack" }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ regularHours: 10, travelHours: 0 })]));
    // effective base rate = 20 + 5 + 5 = 30; regular = 10*30 = 300; +travel 10 => 310
    expect(result.items[0].grossPay).toBe(310);
  });

  it("replace rule resets the active rule set for its kind", () => {
    const rules = baselineRules().filter((r) => r.kind !== "base_rate");
    rules.push(makeRule("base_rate", { amount: 10, precedence: 1, compositionMode: "replace" }));
    rules.push(makeRule("base_rate", { amount: 50, precedence: 2, compositionMode: "replace" }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ regularHours: 10 })]));
    // last replace wins -> base 50; regular 500 + travel 10 = 510
    expect(result.items[0].grossPay).toBe(510);
  });
});

// ---------------------------------------------------------------------------
// Travel & evaluation graph
// ---------------------------------------------------------------------------
describe("calculatePayrollRun — travel strategies and trace", () => {
  it("handles per_km (no add), flat, and percentage travel strategies", () => {
    const rules = baselineRules().filter((r) => r.kind !== "travel");
    rules.push(makeRule("travel", { strategy: "per_km", amount: 0.5, precedence: 1, compositionMode: "stack" }));
    rules.push(makeRule("travel", { strategy: "flat", amount: 10, precedence: 2, compositionMode: "stack" }));
    rules.push(makeRule("travel", { strategy: "hourly", amount: 0.25, precedence: 3, compositionMode: "stack" }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ regularHours: 10, travelHours: 4 })]));
    // travel: per_km adds 0, flat adds 10, hourly adds 4*30*0.25 = 30 => 40
    // gross = 10*30 + 40 = 340
    expect(result.items[0].grossPay).toBe(340);
  });

  it("produces a deterministic trace, traceHash, snapshotHash and evaluation graph", () => {
    const rules = baselineRules();
    const input = makeInput(rules, [makeEntry()]);
    const a = calculatePayrollRun(input);
    const b = calculatePayrollRun(input);
    expect(a.traceHash).toBe(b.traceHash);
    expect(a.snapshotHash).toBe(b.snapshotHash);
    expect(a.items[0].trace.calc_trace.evaluation_graph.nodes.length).toBeGreaterThan(0);
    expect(a.items[0].trace.calc_trace.evaluation_graph.appliedPath.length).toBeGreaterThan(0);
  });

  it("marks disabled rules as skipped in the evaluation graph", () => {
    const rules = baselineRules();
    // add an extra disabled dues rule (kind already satisfied)
    rules.push(makeRule("dues", { compositionMode: "stack", amount: 0.01, conditions: { enabled: false } }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry()]));
    const nodes = result.items[0].trace.calc_trace.evaluation_graph.nodes;
    expect(nodes.some((n) => n.decision === "skipped")).toBe(true);
  });

  it("marks prior applied rules as superseded when a replace rule follows", () => {
    const rules = baselineRules().filter((r) => r.kind !== "overtime");
    rules.push(makeRule("overtime", { multiplier: 1.5, precedence: 1, compositionMode: "augment" }));
    rules.push(makeRule("overtime", { multiplier: 2, precedence: 2, compositionMode: "replace" }));
    const result = calculatePayrollRun(makeInput(rules, [makeEntry({ overtimeHours: 5 })]));
    const nodes = result.items[0].trace.calc_trace.evaluation_graph.nodes;
    expect(nodes.some((n) => n.decision === "superseded")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Totals aggregation
// ---------------------------------------------------------------------------
describe("calculatePayrollRun — totals", () => {
  it("aggregates totals across multiple employees", () => {
    const rules = baselineRules();
    const entries = [
      makeEntry({ employeeExternalId: "emp-1", regularHours: 40 }),
      makeEntry({ employeeExternalId: "emp-2", regularHours: 20 }),
    ];
    const result = calculatePayrollRun(makeInput(rules, entries));
    expect(result.items).toHaveLength(2);
    const sumGross = round2(result.items[0].grossPay + result.items[1].grossPay);
    expect(result.totals.gross).toBe(sumGross);
    expect(result.trace.itemCount).toBe(2);
  });

  it("handles an empty entry list with zeroed totals", () => {
    const rules = baselineRules();
    const result = calculatePayrollRun(makeInput(rules, []));
    expect(result.items).toHaveLength(0);
    expect(result.totals).toEqual({ gross: 0, net: 0, dues: 0, benefits: 0, pension: 0 });
  });
});

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
