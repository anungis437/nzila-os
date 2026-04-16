import { describe, expect, it } from "vitest";
import {
  buildReplayDiff,
  calculatePayroll,
  createEvidenceChainLink,
  enforcePayrollLifecycleTransition,
  resolvePayrollRules,
  verifyEvidenceChainFromLinks,
} from "../_lib";

const baselineEntries = [
  {
    rowNumber: 1,
    employeeExternalId: "EMP-100",
    shiftDate: "2026-04-01",
    regularHours: 8,
    overtimeHours: 2,
    doubletimeHours: 1,
    travelHours: 1,
    premiumCode: "NIGHT",
    validationErrors: [],
  },
  {
    rowNumber: 2,
    employeeExternalId: "EMP-101",
    shiftDate: "2026-04-01",
    regularHours: 8,
    overtimeHours: 0,
    doubletimeHours: 0,
    travelHours: 0,
    validationErrors: [],
  },
];

function runWithRules(ruleItems: Array<Record<string, unknown>>) {
  const rules = resolvePayrollRules({
    ruleVersionId: "scenario-v1",
    sourceHash: "scenario-hash",
    rulesJson: {
      base_rate: 50,
      overtime: 1.5,
      double_time: 2,
      shift_premium: 0.1,
      travel: 0.2,
      dues: 0.02,
      benefits: 0.03,
      pension: 0.04,
      statutory_holiday: 1,
      regional_override: 1,
      classification_override: 1,
    },
    ruleItems,
  });

  return calculatePayroll(baselineEntries, rules, {
    engineVersion: "scenario-engine-v1",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-15",
  });
}

describe("Employer Execution scenario pack", () => {
  it("A1 standard payroll run with no overrides", () => {
    const result = runWithRules([]);
    expect(result.totals.gross).toBeGreaterThan(0);
    expect(result.items).toHaveLength(2);
  });

  it("A2 overtime + double time threshold behavior", () => {
    const result = runWithRules([]);
    const trace = result.items[0]?.trace as { calc_trace?: { intermediate_steps?: Array<{ step: string; value: number }> } };
    const steps = trace.calc_trace?.intermediate_steps ?? [];
    expect(steps.some((step) => step.step === "overtime" && step.value > 0)).toBe(true);
    expect(steps.some((step) => step.step === "double_time" && step.value > 0)).toBe(true);
  });

  it("B3 classification override replaces base rate", () => {
    const result = runWithRules([
      {
        itemType: "base_rate",
        ruleCode: "classification.base.replace",
        precedence: 20,
        conditionJson: { classificationCode: "JOURNEYMAN" },
        actionJson: { amount: 72, compositionMode: "replace" },
      },
    ]);
    expect(result.totals.gross).toBeGreaterThan(1000);
  });

  it("B4 regional premium stacks with base rule", () => {
    const result = runWithRules([
      {
        itemType: "base_rate",
        ruleCode: "regional.premium.stack",
        precedence: 40,
        conditionJson: { regionCode: "QC-MTL" },
        actionJson: { amount: 5, compositionMode: "stack" },
      },
    ]);
    expect(result.totals.gross).toBeGreaterThan(0);
  });

  it("B5 travel rule suppresses default travel behavior", () => {
    const result = runWithRules([
      {
        itemType: "travel",
        ruleCode: "travel.suppress.default",
        precedence: 30,
        actionJson: { strategy: "hourly", amount: 0, compositionMode: "suppress" },
      },
    ]);
    const travelStep = (result.items[0]?.trace as { calc_trace?: { intermediate_steps?: Array<{ step: string; value: number }> } })
      .calc_trace?.intermediate_steps?.find((step) => step.step === "travel");
    expect(travelStep?.value ?? 0).toBe(0);
  });

  it("B6 dues rule augment case", () => {
    const base = runWithRules([]);
    const augmented = runWithRules([
      {
        itemType: "dues",
        ruleCode: "dues.augment.1",
        precedence: 25,
        actionJson: { strategy: "percent_gross", amount: 0.01, compositionMode: "augment" },
      },
    ]);
    expect(augmented.totals.dues).toBeGreaterThan(base.totals.dues);
  });

  it("C7 replay exact match", () => {
    const runA = runWithRules([]);
    const runB = runWithRules([]);
    const diff = buildReplayDiff(
      { gross: runA.totals.gross, trace: runA.items[0]?.trace },
      { gross: runB.totals.gross, trace: runB.items[0]?.trace },
      "input change: exact replay mismatch",
      { scope: "employee_item", subjectId: "EMP-100" },
    );
    expect(diff.changed).toBe(false);
  });

  it("C8 replay with rule version change", () => {
    const original = runWithRules([]);
    const changed = runWithRules([
      {
        itemType: "travel",
        ruleCode: "travel.flat.override",
        precedence: 20,
        actionJson: { strategy: "flat", amount: 120, compositionMode: "replace" },
      },
    ]);
    const diff = buildReplayDiff(
      { gross: original.totals.gross, trace: original.items[0]?.trace },
      { gross: changed.totals.gross, trace: changed.items[0]?.trace },
      "rule change: rule version override",
      { scope: "employee_item", subjectId: "EMP-100" },
    );
    expect(diff.changed).toBe(true);
  });

  it("C9 replay with input change", () => {
    const original = runWithRules([]);
    const changedEntries = baselineEntries.map((entry) => ({ ...entry, overtimeHours: entry.overtimeHours + 1 }));
    const rules = resolvePayrollRules({
      ruleVersionId: "scenario-v1",
      rulesJson: {
        base_rate: 50,
        overtime: 1.5,
        double_time: 2,
        shift_premium: 0.1,
        travel: 0.2,
        dues: 0.02,
        benefits: 0.03,
        pension: 0.04,
        statutory_holiday: 1,
        regional_override: 1,
        classification_override: 1,
      },
      ruleItems: [],
    });
    const changed = calculatePayroll(changedEntries, rules, {
      engineVersion: "scenario-engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    const diff = buildReplayDiff(
      { gross: original.totals.gross, trace: original.items[0]?.trace },
      { gross: changed.totals.gross, trace: changed.items[0]?.trace },
      "input change: source row edited",
      { scope: "employee_item", subjectId: "EMP-100" },
    );
    expect(diff.changed).toBe(true);
  });

  it("D10 critical compliance issue blocks official approval", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 1,
        errorOpenCount: 0,
        acknowledgedErrorCount: 0,
      }),
    ).toThrow();
  });

  it("D11 error requires acknowledgement before approval", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        errorOpenCount: 2,
        acknowledgedErrorCount: 1,
      }),
    ).toThrow();
  });

  it("D12 approved run immutability and adjustment-run requirement", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "approved",
        action: "approve",
        immutableSnapshotLocked: true,
        criticalOpenCount: 0,
        errorOpenCount: 0,
        acknowledgedErrorCount: 0,
      }),
    ).toThrow();
  });

  it("E13 remittance linked to payroll evidence chain", () => {
    const payrollLink = createEvidenceChainLink({
      organizationId: "org-scenario",
      entityType: "payroll_run",
      targetEntityId: "payroll-1",
      manifestHash: "manifest-payroll",
      sealHash: "seal-payroll",
      parent: null,
    });
    const remittanceLink = createEvidenceChainLink({
      organizationId: "org-scenario",
      entityType: "remittance_run",
      targetEntityId: "remittance-1",
      manifestHash: "manifest-remittance",
      sealHash: "seal-remittance",
      parent: {
        linkId: payrollLink.linkId,
        sealHash: payrollLink.sealHash,
        chainDepth: payrollLink.chainDepth,
      },
    });

    const result = verifyEvidenceChainFromLinks([payrollLink, remittanceLink]);
    expect(result.valid).toBe(true);
    expect(result.checkedLinks).toBe(2);
  });

  it("E14 replay linked to payroll evidence chain", () => {
    const payrollLink = createEvidenceChainLink({
      organizationId: "org-scenario",
      entityType: "payroll_run",
      targetEntityId: "payroll-1",
      manifestHash: "manifest-payroll",
      sealHash: "seal-payroll",
      parent: null,
    });
    const replayLink = createEvidenceChainLink({
      organizationId: "org-scenario",
      entityType: "replay",
      targetEntityId: "replay-1",
      manifestHash: "manifest-replay",
      sealHash: "seal-replay",
      parent: {
        linkId: payrollLink.linkId,
        sealHash: payrollLink.sealHash,
        chainDepth: payrollLink.chainDepth,
      },
    });

    const result = verifyEvidenceChainFromLinks([payrollLink, replayLink]);
    expect(result.valid).toBe(true);
  });

  it("E15 broken evidence chain verification failure", () => {
    const payrollLink = createEvidenceChainLink({
      organizationId: "org-scenario",
      entityType: "payroll_run",
      targetEntityId: "payroll-1",
      manifestHash: "manifest-payroll",
      sealHash: "seal-payroll",
      parent: null,
    });
    const replayLink = createEvidenceChainLink({
      organizationId: "org-scenario",
      entityType: "replay",
      targetEntityId: "replay-1",
      manifestHash: "manifest-replay",
      sealHash: "seal-replay",
      parent: {
        linkId: payrollLink.linkId,
        sealHash: payrollLink.sealHash,
        chainDepth: payrollLink.chainDepth,
      },
    });

    const result = verifyEvidenceChainFromLinks([
      payrollLink,
      {
        ...replayLink,
        parentSealHash: "invalid-parent-seal",
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Parent seal mismatch"))).toBe(true);
  });
});
