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

function requiredRule<TKind extends ExecutableRule["kind"]>(
  rules: ExecutableRule[],
  kind: TKind,
): Extract<ExecutableRule, { kind: TKind }> {
  const rule = lastRuleByKind(rules, kind) as Extract<ExecutableRule, { kind: TKind }> | null;
  if (!rule) {
    throw new Error(`Missing required executable rule: ${kind}`);
  }
  return rule;
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

  const baseRateRule = requiredRule(executableRules, "base_rate");
  const overtimeRule = requiredRule(executableRules, "overtime");
  const doubleTimeRule = requiredRule(executableRules, "double_time");
  const shiftPremiumRule = requiredRule(executableRules, "shift_premium");
  const travelRule = requiredRule(executableRules, "travel");
  const duesRule = requiredRule(executableRules, "dues");
  const benefitsRule = requiredRule(executableRules, "benefits");
  const pensionRule = requiredRule(executableRules, "pension");
  const statutoryHolidayRule = requiredRule(executableRules, "statutory_holiday");
  const regionalOverrideRule = requiredRule(executableRules, "regional_override");
  const classificationOverrideRule = requiredRule(executableRules, "classification_override");

  const items = input.entries.map((entry) => {
    const baseRate = baseRateRule.amount;
    const overtimeMultiplier = overtimeRule.multiplier;
    const doubleMultiplier = doubleTimeRule.multiplier;

    const regularBase = entry.regularHours * baseRate;
    const overtimeBase = entry.overtimeHours * baseRate * overtimeMultiplier;
    const doubleTimeBase = entry.doubletimeHours * baseRate * doubleMultiplier;

    const travelPremium =
      travelRule.strategy === "flat"
        ? travelRule.amount
        : travelRule.strategy === "per_km"
          ? 0
          : entry.travelHours * baseRate * travelRule.amount;

    const shiftPremium =
      entry.premiumCode
        ? shiftPremiumRule.strategy === "flat_per_shift"
          ? shiftPremiumRule.amount
          : entry.regularHours * shiftPremiumRule.amount
        : 0;

    const statutoryHolidayAmount =
      (regularBase + overtimeBase + doubleTimeBase) * (statutoryHolidayRule.multiplier - 1);

    const regionalOverride = regionalOverrideRule.amount;
    const classificationOverride = classificationOverrideRule.amount;

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
            strategy: travelRule.strategy,
            amount: travelRule.amount,
          },
          {
            step: "shift_premium",
            value: round2(shiftPremium),
            strategy: shiftPremiumRule.strategy,
            amount: shiftPremiumRule.amount,
          },
          {
            step: "statutory_holiday",
            value: round2(statutoryHolidayAmount),
            multiplier: statutoryHolidayRule.multiplier,
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
