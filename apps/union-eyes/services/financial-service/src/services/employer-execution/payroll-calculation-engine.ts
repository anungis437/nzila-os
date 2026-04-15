import { createHash } from "crypto";
import type { ExecutableRule, PayrollRunInput, PayrollRunResult, RuleEvaluationNode } from "./types";

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requiredActiveRule(rules: ExecutableRule[], kind: ExecutableRule["kind"]): ExecutableRule[] {
  const composed = composeRulesForKind(rules, kind);
  if (composed.length === 0) {
    const explicitlySuppressed = rules.some(
      (rule) => rule.kind === kind && isRuleEnabled(rule) && rule.compositionMode === "suppress",
    );
    if (explicitlySuppressed) {
      return [];
    }
    throw new Error(`Missing required executable rule: ${kind}`);
  }
  return composed;
}

function isRuleEnabled(rule: ExecutableRule): boolean {
  return rule.conditions?.enabled !== false;
}

function neutralForKind(kind: ExecutableRule["kind"]): number {
  if (
    kind === "overtime" ||
    kind === "double_time" ||
    kind === "statutory_holiday" ||
    kind === "regional_override" ||
    kind === "classification_override"
  ) {
    return 1;
  }
  return 0;
}

function numericRuleValue(rule: ExecutableRule): number {
  return rule.multiplier ?? rule.amount ?? neutralForKind(rule.kind);
}

function composeRulesForKind(rules: ExecutableRule[], kind: ExecutableRule["kind"]): ExecutableRule[] {
  const ordered = rules
    .filter((rule) => rule.kind === kind && isRuleEnabled(rule))
    .sort((a, b) => a.precedence - b.precedence);

  const active: ExecutableRule[] = [];
  for (const rule of ordered) {
    if (rule.compositionMode === "replace" || rule.compositionMode === "suppress") {
      active.length = 0;
      active.push(rule);
      continue;
    }
    active.push(rule);
  }

  if (active.length === 1 && active[0].compositionMode === "suppress") {
    return [];
  }

  return active;
}

function effectiveRuleValue(kind: ExecutableRule["kind"], rules: ExecutableRule[]): number {
  const composed = composeRulesForKind(rules, kind);
  if (composed.length === 0) return neutralForKind(kind);

  let value = numericRuleValue(composed[0]);
  for (const rule of composed.slice(1)) {
    if (rule.compositionMode === "augment" || rule.compositionMode === "stack") {
      value += numericRuleValue(rule);
    } else {
      value = numericRuleValue(rule);
    }
  }
  return value;
}

function deductionAmount(
  grossPay: number,
  totalHours: number,
  ruleKind: "dues" | "benefits" | "pension",
  composedRules: ExecutableRule[],
): number {
  if (composedRules.length === 0) return 0;

  let total = 0;
  for (const rule of composedRules) {
    if (rule.strategy === "percent_gross") total += grossPay * (rule.amount ?? 0);
    else if (rule.strategy === "per_hour") total += totalHours * (rule.amount ?? 0);
    else total += rule.amount ?? 0;
  }

  return round2(total);
}

function buildEvaluationGraphNodes(input: {
  payrollRunId: string;
  employeeExternalId: string;
  rules: ExecutableRule[];
  snapshotHash: string;
}): { nodes: RuleEvaluationNode[]; appliedPath: string[] } {
  const nodes: RuleEvaluationNode[] = [];
  const activeByKind = new Map<string, string[]>();

  const ordered = [...input.rules].sort((a, b) => a.precedence - b.precedence);

  for (let index = 0; index < ordered.length; index += 1) {
    const rule = ordered[index];
    const nodeId = `${input.employeeExternalId}:${rule.kind}:${index}:${rule.sourceRuleId}`;
    const previousActive = activeByKind.get(rule.kind) ?? [];

    const node: RuleEvaluationNode = {
      nodeId,
      payrollRunId: input.payrollRunId,
      employeeExternalId: input.employeeExternalId,
      ruleKind: rule.kind,
      ruleCode: rule.ruleCode,
      sourceRuleId: rule.sourceRuleId,
      strategy: rule.strategy,
      precedence: rule.precedence,
      conditionResult: isRuleEnabled(rule) ? "true" : "false",
      decision: "considered",
      decisionReason: "Candidate rule considered",
      parentNodeId: previousActive[previousActive.length - 1] ?? null,
      supersededByNodeId: null,
      compositionMode: rule.compositionMode,
      path: rule.path,
      evaluationOrder: index + 1,
      inputSnapshotHash: input.snapshotHash,
      createdAt: "1970-01-01T00:00:00.000Z",
    };

    if (!isRuleEnabled(rule)) {
      node.decision = "skipped";
      node.decisionReason = "Condition evaluated to false";
      nodes.push(node);
      continue;
    }

    if (rule.compositionMode === "replace" || rule.compositionMode === "suppress") {
      for (const priorId of previousActive) {
        const prior = nodes.find((candidate) => candidate.nodeId === priorId);
        if (prior && prior.decision === "applied") {
          prior.decision = "superseded";
          prior.decisionReason = `Superseded by ${rule.compositionMode} rule ${rule.ruleCode}`;
          prior.supersededByNodeId = nodeId;
        }
      }
      activeByKind.set(rule.kind, [nodeId]);
      node.decision = "applied";
      node.decisionReason =
        rule.compositionMode === "replace"
          ? "Applied as authoritative replacement"
          : "Applied suppression of prior rule family";
      nodes.push(node);
      continue;
    }

    const nextActive = [...previousActive, nodeId];
    activeByKind.set(rule.kind, nextActive);
    node.decision = "applied";
    node.decisionReason =
      rule.compositionMode === "augment"
        ? "Applied as additive augmentation"
        : "Applied as stacked compatible rule";
    nodes.push(node);
  }

  const appliedPath = nodes.filter((node) => node.decision === "applied").map((node) => node.nodeId);
  return { nodes, appliedPath };
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

  const baseRateRules = requiredActiveRule(executableRules, "base_rate");
  const overtimeRules = requiredActiveRule(executableRules, "overtime");
  const doubleTimeRules = requiredActiveRule(executableRules, "double_time");
  const shiftPremiumRules = requiredActiveRule(executableRules, "shift_premium");
  const travelRules = requiredActiveRule(executableRules, "travel");
  const duesRules = requiredActiveRule(executableRules, "dues");
  const benefitsRules = requiredActiveRule(executableRules, "benefits");
  const pensionRules = requiredActiveRule(executableRules, "pension");
  const statutoryHolidayRules = requiredActiveRule(executableRules, "statutory_holiday");
  const regionalOverrideRules = requiredActiveRule(executableRules, "regional_override");
  const classificationOverrideRules = requiredActiveRule(executableRules, "classification_override");

  const baseRate = effectiveRuleValue("base_rate", executableRules);
  const overtimeMultiplier = effectiveRuleValue("overtime", executableRules);
  const doubleMultiplier = effectiveRuleValue("double_time", executableRules);
  const statutoryHolidayMultiplier = effectiveRuleValue("statutory_holiday", executableRules);
  const regionalOverride = effectiveRuleValue("regional_override", executableRules);
  const classificationOverride = effectiveRuleValue("classification_override", executableRules);

  const items = input.entries.map((entry) => {
    const regularBase = entry.regularHours * baseRate;
    const overtimeBase = entry.overtimeHours * baseRate * overtimeMultiplier;
    const doubleTimeBase = entry.doubletimeHours * baseRate * doubleMultiplier;

    const travelPremium = travelRules.reduce((sum, rule) => {
      if (rule.strategy === "flat") return sum + (rule.amount ?? 0);
      if (rule.strategy === "per_km") return sum;
      return sum + entry.travelHours * baseRate * (rule.amount ?? 0);
    }, 0);

    const shiftPremium =
      entry.premiumCode
        ? shiftPremiumRules.reduce((sum, rule) => {
            if (rule.strategy === "flat_per_shift") return sum + (rule.amount ?? 0);
            return sum + entry.regularHours * (rule.amount ?? 0);
          }, 0)
        : 0;

    const statutoryHolidayAmount = (regularBase + overtimeBase + doubleTimeBase) * (statutoryHolidayMultiplier - 1);

    const grossPay = round2(
      (regularBase + overtimeBase + doubleTimeBase + travelPremium + shiftPremium + statutoryHolidayAmount) *
        regionalOverride *
        classificationOverride,
    );

    const totalHours = entry.regularHours + entry.overtimeHours + entry.doubletimeHours + entry.travelHours;
    const duesAmount = deductionAmount(grossPay, totalHours, "dues", duesRules);
    const benefitAmount = deductionAmount(grossPay, totalHours, "benefits", benefitsRules);
    const pensionAmount = deductionAmount(grossPay, totalHours, "pension", pensionRules);
    const netPay = round2(grossPay - duesAmount - benefitAmount - pensionAmount);

    const evaluationGraph = buildEvaluationGraphNodes({
      payrollRunId: input.resolvedRules.ruleVersionId ?? "unpersisted",
      employeeExternalId: entry.employeeExternalId,
      rules: executableRules,
      snapshotHash,
    });

    const trace = {
      calc_trace: {
        rule_resolution: input.resolvedRules.ruleResolution,
        composition_trace: input.resolvedRules.compositionTrace ?? [],
        applied_rules: executableRules.map((rule) => ({
          kind: rule.kind,
          strategy: rule.strategy,
          sourceRuleId: rule.sourceRuleId,
          ruleCode: rule.ruleCode,
          compositionMode: rule.compositionMode,
          precedence: rule.precedence,
          path: rule.path,
        })),
        applied_rule_path: {
          base_rate: baseRateRules.map((rule) => rule.path),
          overtime: overtimeRules.map((rule) => rule.path),
          double_time: doubleTimeRules.map((rule) => rule.path),
          shift_premium: shiftPremiumRules.map((rule) => rule.path),
          travel: travelRules.map((rule) => rule.path),
          dues: duesRules.map((rule) => rule.path),
          benefits: benefitsRules.map((rule) => rule.path),
          pension: pensionRules.map((rule) => rule.path),
          regional_override: regionalOverrideRules.map((rule) => rule.path),
          classification_override: classificationOverrideRules.map((rule) => rule.path),
          statutory_holiday: statutoryHolidayRules.map((rule) => rule.path),
        },
        evaluation_graph: {
          nodes: evaluationGraph.nodes,
          appliedPath: evaluationGraph.appliedPath,
          graphHash: createHash("sha256").update(JSON.stringify(evaluationGraph.nodes)).digest("hex"),
        },
        intermediate_steps: [
          { step: "regular_base", value: round2(regularBase) },
          { step: "overtime", value: round2(overtimeBase), multiplier: overtimeMultiplier },
          { step: "double_time", value: round2(doubleTimeBase), multiplier: doubleMultiplier },
          {
            step: "travel",
            value: round2(travelPremium),
            strategies: travelRules.map((rule) => rule.strategy),
            composition: travelRules.map((rule) => rule.compositionMode),
          },
          {
            step: "shift_premium",
            value: round2(shiftPremium),
            strategies: shiftPremiumRules.map((rule) => rule.strategy),
            composition: shiftPremiumRules.map((rule) => rule.compositionMode),
          },
          {
            step: "statutory_holiday",
            value: round2(statutoryHolidayAmount),
            multiplier: statutoryHolidayMultiplier,
          },
          { step: "regional_override", value: regionalOverride },
          { step: "classification_override", value: classificationOverride },
          { step: "dues", strategies: duesRules.map((rule) => rule.strategy), value: duesAmount },
          { step: "benefits", strategies: benefitsRules.map((rule) => rule.strategy), value: benefitAmount },
          { step: "pension", strategies: pensionRules.map((rule) => rule.strategy), value: pensionAmount },
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
