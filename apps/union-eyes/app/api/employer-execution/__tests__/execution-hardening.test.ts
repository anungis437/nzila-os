import { describe, expect, it } from "vitest";
import {
  buildReplayDiff,
  calculatePayroll,
  enforcePayrollLifecycleTransition,
  resolvePayrollRules,
} from "../_lib";

const sampleEntries = [
  {
    rowNumber: 1,
    employeeExternalId: "EMP-001",
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
    employeeExternalId: "EMP-002",
    shiftDate: "2026-04-01",
    regularHours: 8,
    overtimeHours: 0,
    doubletimeHours: 0,
    travelHours: 0,
    validationErrors: [],
  },
];

describe("Employer Execution hardening helpers", () => {
  it("is deterministic for the same input and rule set", () => {
    const resolvedRules = resolvePayrollRules({
      ruleVersionId: "v1",
      ruleVersionCode: "2026-04A",
      sourceHash: "hash-v1",
      rulesJson: {
        base_rate: 52,
        overtime: 1.5,
        double_time: 2,
        shift_premium: 0.1,
        travel: 0.5,
        dues: 0.02,
        benefits: 0.03,
        pension: 0.04,
      },
      ruleItems: [],
      workDate: "2026-04-01",
    });

    const first = calculatePayroll(sampleEntries, resolvedRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    const second = calculatePayroll(sampleEntries, resolvedRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    expect(first.totals).toEqual(second.totals);
    expect(first.calcTraceHash).toBe(second.calcTraceHash);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.items).toEqual(second.items);
  });

  it("changes output when rule version inputs change", () => {
    const baseRules = resolvePayrollRules({
      ruleVersionId: "v1",
      ruleVersionCode: "2026-04A",
      sourceHash: "hash-v1",
      rulesJson: {
        base_rate: 52,
        dues: 0.02,
        benefits: 0.03,
        pension: 0.04,
      },
      ruleItems: [],
    });

    const overriddenRules = resolvePayrollRules({
      ruleVersionId: "v2",
      ruleVersionCode: "2026-04B",
      sourceHash: "hash-v2",
      rulesJson: {
        base_rate: 52,
        dues: 0.025,
        benefits: 0.03,
        pension: 0.04,
      },
      ruleItems: [],
    });

    const original = calculatePayroll(sampleEntries, baseRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });
    const replay = calculatePayroll(sampleEntries, overriddenRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    expect(replay.totals.dues).not.toBe(original.totals.dues);
  });

  it("enforces lifecycle FSM transitions", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "draft",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        highOpenCount: 0,
        acknowledgedHighCount: 0,
      }),
    ).toThrow("Official run can only be approved from calculated status");

    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "seal",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        highOpenCount: 0,
        acknowledgedHighCount: 0,
      }),
    ).toThrow("Only approved payroll runs can be sealed");
  });

  it("builds replay diffs with deterministic field-level reasons", () => {
    const noDiff = buildReplayDiff({ totalDues: 100 }, { totalDues: 100 }, "exact replay mismatch");
    expect(noDiff.changed).toBe(false);
    expect(noDiff.differences).toHaveLength(0);

    const withDiff = buildReplayDiff({ dues_amount: 120.5 }, { dues_amount: 125.75 }, "rule change: dues rate override");
    expect(withDiff.changed).toBe(true);
    expect(withDiff.differences[0]).toEqual({
      field: "dues_amount",
      original: 120.5,
      replay: 125.75,
      reason: "rule change: dues rate override",
    });
  });

  it("blocks approval when compliance gates are not satisfied", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 1,
        highOpenCount: 0,
        acknowledgedHighCount: 0,
      }),
    ).toThrow("Cannot approve official payroll run while critical compliance events are unresolved");

    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        highOpenCount: 2,
        acknowledgedHighCount: 1,
      }),
    ).toThrow("All high-severity compliance events must be acknowledged before approval");

    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        highOpenCount: 2,
        acknowledgedHighCount: 2,
      }),
    ).not.toThrow();
  });
});
