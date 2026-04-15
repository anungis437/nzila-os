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
    resolvedRules: input.resolvedRules,
    entries: input.entries,
  };

  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

  const items = input.entries.map((entry) => {
    const rules = input.resolvedRules.values;
    const regularBase = entry.regularHours * rules.baseRate;
    const overtimeBase = entry.overtimeHours * rules.baseRate * rules.overtimeMultiplier;
    const doubleTimeBase = entry.doubletimeHours * rules.baseRate * rules.doubleTimeMultiplier;
    const travelPremium = entry.travelHours * rules.baseRate * rules.travelPremiumRate;
    const shiftPremium = entry.premiumCode ? regularBase * rules.shiftPremiumRate : 0;
    const statutoryHolidayAmount = (regularBase + overtimeBase + doubleTimeBase) * (rules.statutoryHolidayMultiplier - 1);

    const grossPay = round2(
      (regularBase + overtimeBase + doubleTimeBase + travelPremium + shiftPremium + statutoryHolidayAmount) *
        rules.regionalOverride *
        rules.classificationOverride,
    );

    const duesAmount = round2(grossPay * rules.duesRate);
    const benefitAmount = round2(grossPay * rules.benefitRate);
    const pensionAmount = round2(grossPay * rules.pensionRate);
    const netPay = round2(grossPay - duesAmount - benefitAmount - pensionAmount);

    return {
      employeeExternalId: entry.employeeExternalId,
      grossPay,
      netPay,
      duesAmount,
      benefitAmount,
      pensionAmount,
      trace: {
        calc_trace: {
          rule_resolution: input.resolvedRules.ruleResolution,
          applied_rules: input.resolvedRules.appliedRules,
          intermediate_steps: [
            { step: "regular_base", value: round2(regularBase) },
            { step: "overtime", value: round2(overtimeBase), multiplier: rules.overtimeMultiplier },
            { step: "double_time", value: round2(doubleTimeBase), multiplier: rules.doubleTimeMultiplier },
            { step: "travel", value: round2(travelPremium), rate: rules.travelPremiumRate },
            { step: "shift_premium", value: round2(shiftPremium), rate: rules.shiftPremiumRate },
            { step: "statutory_holiday", value: round2(statutoryHolidayAmount), multiplier: rules.statutoryHolidayMultiplier },
            { step: "regional_override", value: rules.regionalOverride },
            { step: "classification_override", value: rules.classificationOverride },
          ],
          final_values: {
            grossPay,
            duesAmount,
            benefitAmount,
            pensionAmount,
            netPay,
          },
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
      "calculation",
      "compliance_checks",
      "calc_trace_persistence",
    ],
    snapshotHash,
    engineVersion: input.engineVersion,
    ruleVersionId: input.resolvedRules.ruleVersionId,
    ruleVersionCode: input.resolvedRules.ruleVersionCode,
    sourceHash: input.resolvedRules.sourceHash,
    ruleInputs: input.resolvedRules.values,
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
