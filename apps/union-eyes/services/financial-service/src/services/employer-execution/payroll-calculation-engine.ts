import { createHash } from "crypto";
import type { ExecutableRule, PayrollRunInput, PayrollRunResult } from "./types";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lastRuleByKind(rules: ExecutableRule[], kind: ExecutableRule["kind"]): ExecutableRule | null {
  for (let i = rules.length - 1; i >= 0; i -= 1) {
    if (rules[i].kind === kind) return rules[i];
  }
  return null;
}

function deductionAmount(
  grossPay: number,
  totalHours: number,
  rule: Extract<ExecutableRule, { kind: "dues" | "benefits" | "pension" }> | null,
): number {
  if (!rule) return 0;
  if (rule.strategy === "percent_gross") return round2(grossPay * rule.amount);
  if (rule.strategy === "per_hour") return round2(totalHours * rule.amount);
  return round2(rule.amount);
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
  const executableRules = [...(input.resolvedRules.executableRules ?? [])];

  const baseRateRule = lastRuleByKind(executableRules, "base_rate") as Extract<
    ExecutableRule,
    { kind: "base_rate" }
  > | null;
  const overtimeRule = lastRuleByKind(executableRules, "overtime") as Extract<
    ExecutableRule,
    { kind: "overtime" }
  > | null;
  const doubleTimeRule = lastRuleByKind(executableRules, "double_time") as Extract<
    ExecutableRule,
    { kind: "double_time" }
  > | null;
  const shiftPremiumRule = lastRuleByKind(executableRules, "shift_premium") as Extract<
    ExecutableRule,
    { kind: "shift_premium" }
  > | null;
  const travelRule = lastRuleByKind(executableRules, "travel") as Extract<
    ExecutableRule,
    { kind: "travel" }
  > | null;
  const duesRule = lastRuleByKind(executableRules, "dues") as Extract<
    ExecutableRule,
    { kind: "dues" }
  > | null;
  const benefitsRule = lastRuleByKind(executableRules, "benefits") as Extract<
    ExecutableRule,
    { kind: "benefits" }
  > | null;
  const pensionRule = lastRuleByKind(executableRules, "pension") as Extract<
    ExecutableRule,
    { kind: "pension" }
  > | null;
  const regionalOverrideRule = lastRuleByKind(executableRules, "regional_override") as Extract<
    ExecutableRule,
    { kind: "regional_override" }
  > | null;
  const classificationOverrideRule = lastRuleByKind(executableRules, "classification_override") as Extract<
    ExecutableRule,
    { kind: "classification_override" }
  > | null;

  const items = input.entries.map((entry) => {
    const baseRate = baseRateRule?.amount ?? input.resolvedRules.values.baseRate;
    const overtimeMultiplier = overtimeRule?.multiplier ?? input.resolvedRules.values.overtimeMultiplier;
    const doubleMultiplier = doubleTimeRule?.multiplier ?? input.resolvedRules.values.doubleTimeMultiplier;

    const regularBase = entry.regularHours * baseRate;
    const overtimeBase = entry.overtimeHours * baseRate * overtimeMultiplier;
    const doubleTimeBase = entry.doubletimeHours * baseRate * doubleMultiplier;

    const travelPremium =
      travelRule?.strategy === "flat"
        ? travelRule.amount
        : travelRule?.strategy === "per_km"
          ? 0
          : entry.travelHours * baseRate * (travelRule?.amount ?? input.resolvedRules.values.travelPremiumRate);

    const shiftPremium =
      shiftPremiumRule && entry.premiumCode
        ? shiftPremiumRule.strategy === "flat_per_shift"
          ? shiftPremiumRule.amount
          : entry.regularHours * shiftPremiumRule.amount
        : 0;

    const statutoryHolidayAmount =
      (regularBase + overtimeBase + doubleTimeBase) * (input.resolvedRules.values.statutoryHolidayMultiplier - 1);

    const regionalOverride = regionalOverrideRule?.amount ?? input.resolvedRules.values.regionalOverride;
    const classificationOverride =
      classificationOverrideRule?.amount ?? input.resolvedRules.values.classificationOverride;

    const grossPay = round2(
      (regularBase + overtimeBase + doubleTimeBase + travelPremium + shiftPremium + statutoryHolidayAmount) *
        regionalOverride *
        classificationOverride,
    );

    const totalHours = entry.regularHours + entry.overtimeHours + entry.doubletimeHours + entry.travelHours;
    const duesAmount = deductionAmount(grossPay, totalHours, duesRule);
    const benefitAmount = deductionAmount(grossPay, totalHours, benefitsRule);
    const pensionAmount = deductionAmount(grossPay, totalHours, pensionRule);
    const netPay = round2(grossPay - duesAmount - benefitAmount - pensionAmount);

    const trace = {
      calc_trace: {
        rule_resolution: input.resolvedRules.ruleResolution,
        applied_rules: executableRules.map((rule) => ({
          kind: rule.kind,
          strategy: rule.strategy,
          sourceRuleId: rule.sourceRuleId,
          path: rule.path,
        })),
        applied_rule_path: {
          base_rate: baseRateRule?.path,
          overtime: overtimeRule?.path,
          double_time: doubleTimeRule?.path,
          shift_premium: shiftPremiumRule?.path,
          travel: travelRule?.path,
          dues: duesRule?.path,
          benefits: benefitsRule?.path,
          pension: pensionRule?.path,
          regional_override: regionalOverrideRule?.path,
          classification_override: classificationOverrideRule?.path,
        },
        intermediate_steps: [
          { step: "regular_base", value: round2(regularBase) },
          { step: "overtime", value: round2(overtimeBase), multiplier: overtimeMultiplier },
          { step: "double_time", value: round2(doubleTimeBase), multiplier: doubleMultiplier },
          {
            step: "travel",
            value: round2(travelPremium),
            strategy: travelRule?.strategy ?? "hourly",
            amount: travelRule?.amount ?? input.resolvedRules.values.travelPremiumRate,
          },
          {
            step: "shift_premium",
            value: round2(shiftPremium),
            strategy: shiftPremiumRule?.strategy ?? "flat_per_hour",
            amount: shiftPremiumRule?.amount ?? input.resolvedRules.values.shiftPremiumRate,
          },
          {
            step: "statutory_holiday",
            value: round2(statutoryHolidayAmount),
            multiplier: input.resolvedRules.values.statutoryHolidayMultiplier,
          },
          { step: "regional_override", value: regionalOverride },
          { step: "classification_override", value: classificationOverride },
          { step: "dues", strategy: duesRule?.strategy ?? "percent_gross", value: duesAmount },
          { step: "benefits", strategy: benefitsRule?.strategy ?? "percent_gross", value: benefitAmount },
          { step: "pension", strategy: pensionRule?.strategy ?? "percent_gross", value: pensionAmount },
        ],
        final_values: {
          grossPay,
          duesAmount,
          benefitAmount,
          pensionAmount,
          netPay,
        },
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
      traceHash: createHash("sha256").update(JSON.stringify(trace)).digest("hex"),
      trace,
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
    stage_order: ["input_snapshot", "rule_resolution", "calculation", "compliance_checks", "calc_trace_persistence"],
    snapshotHash,
    engineVersion: input.engineVersion,
    ruleVersionId: input.resolvedRules.ruleVersionId,
    ruleVersionCode: input.resolvedRules.ruleVersionCode,
    sourceHash: input.resolvedRules.sourceHash,
    ruleInputs: input.resolvedRules.executableRules,
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
