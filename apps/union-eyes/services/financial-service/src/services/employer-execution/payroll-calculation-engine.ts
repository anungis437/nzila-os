import { createHash } from "crypto";
import type { PayrollRunInput, PayrollRunResult } from "./types";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePayrollRun(input: PayrollRunInput): PayrollRunResult {
  const snapshot = {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    engineVersion: input.engineVersion,
    baseRate: input.baseRate,
    duesRate: input.duesRate,
    benefitRate: input.benefitRate,
    pensionRate: input.pensionRate,
    entries: input.entries,
  };

  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

  const items = input.entries.map((entry) => {
    const normalizedHours = entry.regularHours + entry.overtimeHours * 1.5 + entry.doubletimeHours * 2;
    const basePay = normalizedHours * input.baseRate;
    const premiumPay = entry.travelHours * input.baseRate * 0.5;
    const grossPay = round2(basePay + premiumPay);

    const duesAmount = round2(grossPay * input.duesRate);
    const benefitAmount = round2(grossPay * input.benefitRate);
    const pensionAmount = round2(grossPay * input.pensionRate);
    const netPay = round2(grossPay - duesAmount - benefitAmount - pensionAmount);

    return {
      employeeExternalId: entry.employeeExternalId,
      grossPay,
      netPay,
      duesAmount,
      benefitAmount,
      pensionAmount,
      trace: {
        stages: {
          input_snapshot: { snapshotHash },
          hour_normalization: { regular: entry.regularHours, overtime: entry.overtimeHours, doubletime: entry.doubletimeHours },
          base_rate_resolution: { baseRate: input.baseRate },
          overtime_doubletime_logic: { normalizedHours },
          premium_travel_logic: { travelHours: entry.travelHours, premiumPay },
          dues_benefits_pension_logic: {
            duesRate: input.duesRate,
            benefitRate: input.benefitRate,
            pensionRate: input.pensionRate,
          },
          remittance_grouping: { group: "default" },
        },
      },
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

  const trace = {
    stage_order: [
      "input_snapshot",
      "rule_resolution",
      "hour_normalization",
      "base_rate_resolution",
      "overtime_doubletime_logic",
      "premium_travel_logic",
      "dues_benefits_pension_logic",
      "remittance_grouping",
      "compliance_checks",
      "calc_trace_persistence",
    ],
    snapshotHash,
    itemCount: items.length,
    totals,
  };

  const traceHash = createHash("sha256").update(JSON.stringify(trace)).digest("hex");

  return {
    totals: {
      gross: round2(totals.gross),
      net: round2(totals.net),
      dues: round2(totals.dues),
      benefits: round2(totals.benefits),
      pension: round2(totals.pension),
    },
    items,
    trace,
    traceHash,
    snapshotHash,
  };
}
