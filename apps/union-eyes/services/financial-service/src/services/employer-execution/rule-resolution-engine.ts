import { sql } from "drizzle-orm";
import { db } from "../../db";
import { resolveActiveCbaRuleVersion } from "./cba-version-resolver";
import type {
  ExecutableRule,
  FlattenedRuleValues,
  RuleCompositionMode,
  RuleResolutionContext,
  RuleResolutionResult,
  RuleScope,
} from "./types";

function toNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fromRuleJson(rulesJson: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const parsed = toNumber(rulesJson[key]);
    if (parsed !== null) return parsed;
  }
  return fallback;
}

function normalizeCompositionMode(value: any, fallback: RuleCompositionMode): RuleCompositionMode {
  if (value === "replace" || value === "augment" || value === "stack" || value === "suppress") {
    return value;
  }
  return fallback;
}

function toScope(conditionJson?: Record<string, unknown>): RuleScope {
  return {
    employerId: typeof conditionJson?.employerId === "string" ? conditionJson.employerId : null,
    bargainingUnitId: typeof conditionJson?.bargainingUnitId === "string" ? conditionJson.bargainingUnitId : null,
    worksiteId: typeof conditionJson?.worksiteId === "string" ? conditionJson.worksiteId : null,
    regionCode: typeof conditionJson?.regionCode === "string" ? conditionJson.regionCode : null,
    classificationCode: typeof conditionJson?.classificationCode === "string" ? conditionJson.classificationCode : null,
  };
}

function precedenceAxisWeight(scope: RuleScope): number {
  // Deterministic precedence axis ordering required by contract execution.
  let weight = 0;
  if (scope.bargainingUnitId) weight += 100;
  if (scope.employerId) weight += 200;
  if (scope.worksiteId) weight += 300;
  if (scope.regionCode) weight += 400;
  if (scope.classificationCode) weight += 500;
  return weight;
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

function setFlattenedValue(values: FlattenedRuleValues, kind: ExecutableRule["kind"], value: number) {
  switch (kind) {
    case "base_rate":
      values.baseRate = value;
      break;
    case "overtime":
      values.overtimeMultiplier = value;
      break;
    case "double_time":
      values.doubleTimeMultiplier = value;
      break;
    case "shift_premium":
      values.shiftPremiumRate = value;
      break;
    case "travel":
      values.travelPremiumRate = value;
      break;
    case "dues":
      values.duesRate = value;
      break;
    case "benefits":
      values.benefitRate = value;
      break;
    case "pension":
      values.pensionRate = value;
      break;
    case "statutory_holiday":
      values.statutoryHolidayMultiplier = value;
      break;
    case "regional_override":
      values.regionalOverride = value;
      break;
    case "classification_override":
      values.classificationOverride = value;
      break;
  }
}

function getRuleNumericValue(rule: ExecutableRule): number {
  return rule.multiplier ?? rule.amount ?? neutralForKind(rule.kind);
}

function applyComposedValue(values: FlattenedRuleValues, rule: ExecutableRule) {
  const current = (() => {
    switch (rule.kind) {
      case "base_rate":
        return values.baseRate;
      case "overtime":
        return values.overtimeMultiplier;
      case "double_time":
        return values.doubleTimeMultiplier;
      case "shift_premium":
        return values.shiftPremiumRate;
      case "travel":
        return values.travelPremiumRate;
      case "dues":
        return values.duesRate;
      case "benefits":
        return values.benefitRate;
      case "pension":
        return values.pensionRate;
      case "statutory_holiday":
        return values.statutoryHolidayMultiplier;
      case "regional_override":
        return values.regionalOverride;
      case "classification_override":
        return values.classificationOverride;
    }
  })();

  if (rule.compositionMode === "suppress") {
    setFlattenedValue(values, rule.kind, neutralForKind(rule.kind));
    return;
  }

  if (rule.compositionMode === "replace") {
    setFlattenedValue(values, rule.kind, getRuleNumericValue(rule));
    return;
  }

  // augment + stack are additive for scalar results in flattened compatibility output.
  setFlattenedValue(values, rule.kind, current + getRuleNumericValue(rule));
}

function createBaseRule(input: {
  kind: ExecutableRule["kind"];
  strategy: ExecutableRule["strategy"];
  ruleVersionId: string;
  path: string[];
  valueField: "amount" | "multiplier";
  value: number;
  ruleCode: string;
  thresholdHours?: number;
  holidayCode?: string;
  targetRuleKind?: string;
}): ExecutableRule {
  const baseRule: ExecutableRule = {
    kind: input.kind,
    strategy: input.strategy,
    sourceRuleId: input.ruleVersionId,
    ruleCode: input.ruleCode,
    precedence: 0,
    compositionMode: "replace",
    scope: {},
    conditions: { default: true },
    action: {
      strategy: input.strategy,
      [input.valueField]: input.value,
    },
    path: input.path,
  };

  if (input.valueField === "amount") baseRule.amount = input.value;
  if (input.valueField === "multiplier") baseRule.multiplier = input.value;
  if (typeof input.thresholdHours === "number") baseRule.thresholdHours = input.thresholdHours;
  if (input.holidayCode) baseRule.holidayCode = input.holidayCode;
  if (input.targetRuleKind) baseRule.targetRuleKind = input.targetRuleKind;

  return baseRule;
}

export function buildExecutableRules(input: {
  ruleVersionId: string;
  rulesJson: Record<string, unknown>;
  items: Array<{
    id?: string;
    ruleCode: string;
    itemType: string;
    precedence: number;
    conditionJson?: Record<string, unknown>;
    actionJson?: Record<string, unknown>;
  }>;
}): { executableRules: ExecutableRule[]; flattenedValues: FlattenedRuleValues; trace: RuleResolutionResult["trace"] } {
  const executableRules: ExecutableRule[] = [];
  const trace: RuleResolutionResult["trace"] = [];

  const defaults: FlattenedRuleValues = {
    baseRate: fromRuleJson(input.rulesJson, ["base_rate", "baseRate", "hourly_rate"], 0),
    overtimeMultiplier: fromRuleJson(input.rulesJson, ["overtime", "overtime_multiplier"], 1.5),
    doubleTimeMultiplier: fromRuleJson(input.rulesJson, ["double_time", "doubletime_multiplier"], 2),
    shiftPremiumRate: fromRuleJson(input.rulesJson, ["shift_premium", "shiftPremium"], 0),
    travelPremiumRate: fromRuleJson(input.rulesJson, ["travel", "travel_premium"], 0),
    duesRate: fromRuleJson(input.rulesJson, ["dues", "dues_rate"], 0),
    benefitRate: fromRuleJson(input.rulesJson, ["benefits", "benefit", "benefit_rate"], 0),
    pensionRate: fromRuleJson(input.rulesJson, ["pension", "pension_rate"], 0),
    statutoryHolidayMultiplier: fromRuleJson(input.rulesJson, ["statutory_holiday", "holiday_multiplier"], 1),
    regionalOverride: fromRuleJson(input.rulesJson, ["regional_override", "regionalOverride"], 1),
    classificationOverride: fromRuleJson(input.rulesJson, ["classification_override", "classificationOverride"], 1),
  };

  const baseRules: ExecutableRule[] = [
    createBaseRule({
      kind: "base_rate",
      strategy: "hourly",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "base_rate"],
      valueField: "amount",
      value: defaults.baseRate,
      ruleCode: "rulesJson.base_rate",
    }),
    createBaseRule({
      kind: "overtime",
      strategy: "daily_threshold",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "overtime"],
      valueField: "multiplier",
      value: defaults.overtimeMultiplier,
      ruleCode: "rulesJson.overtime",
      thresholdHours: 8,
    }),
    createBaseRule({
      kind: "double_time",
      strategy: "after_threshold",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "double_time"],
      valueField: "multiplier",
      value: defaults.doubleTimeMultiplier,
      ruleCode: "rulesJson.double_time",
      thresholdHours: 12,
    }),
    createBaseRule({
      kind: "shift_premium",
      strategy: "flat_per_hour",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "shift_premium"],
      valueField: "amount",
      value: defaults.shiftPremiumRate,
      ruleCode: "rulesJson.shift_premium",
    }),
    createBaseRule({
      kind: "travel",
      strategy: "hourly",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "travel"],
      valueField: "amount",
      value: defaults.travelPremiumRate,
      ruleCode: "rulesJson.travel",
    }),
    createBaseRule({
      kind: "dues",
      strategy: "percent_gross",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "dues"],
      valueField: "amount",
      value: defaults.duesRate,
      ruleCode: "rulesJson.dues",
    }),
    createBaseRule({
      kind: "benefits",
      strategy: "percent_gross",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "benefits"],
      valueField: "amount",
      value: defaults.benefitRate,
      ruleCode: "rulesJson.benefits",
    }),
    createBaseRule({
      kind: "pension",
      strategy: "percent_gross",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "pension"],
      valueField: "amount",
      value: defaults.pensionRate,
      ruleCode: "rulesJson.pension",
    }),
    createBaseRule({
      kind: "statutory_holiday",
      strategy: "calendar_match",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "statutory_holiday"],
      valueField: "multiplier",
      value: defaults.statutoryHolidayMultiplier,
      ruleCode: "rulesJson.statutory_holiday",
      holidayCode: "GENERIC",
    }),
    createBaseRule({
      kind: "regional_override",
      strategy: "augment",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "regional_override"],
      valueField: "multiplier",
      value: defaults.regionalOverride,
      ruleCode: "rulesJson.regional_override",
      targetRuleKind: "gross",
    }),
    createBaseRule({
      kind: "classification_override",
      strategy: "augment",
      ruleVersionId: input.ruleVersionId,
      path: ["rulesJson", "classification_override"],
      valueField: "multiplier",
      value: defaults.classificationOverride,
      ruleCode: "rulesJson.classification_override",
      targetRuleKind: "gross",
    }),
  ];

  executableRules.push(...baseRules);

  trace.push({
    step: "rule_semantics_defaults",
    outcome: "resolved",
    details: {
      defaults,
      compositionModel: {
        operations: ["replace", "augment", "stack", "suppress"],
        precedenceAxes: [
          "global_agreement",
          "bargaining_unit",
          "employer",
          "worksite",
          "region",
          "classification",
          "date_window",
          "numeric_precedence",
        ],
      },
    },
  });

  const nextValues = { ...defaults };

  const sorted = [...input.items].sort((a, b) => a.precedence - b.precedence);
  const latestByKind = new Map<ExecutableRule["kind"], ExecutableRule>(
    baseRules.map((rule) => [rule.kind, rule]),
  );

  for (const item of sorted) {
    const itemType = (item.itemType ?? "").toLowerCase();
    const ruleCode = (item.ruleCode ?? "").toLowerCase();
    const ruleId = item.id ?? `${input.ruleVersionId}:${item.ruleCode}:${item.precedence}`;
    const action = item.actionJson ?? {};
    const conditions = item.conditionJson ?? {};
    const scope = toScope(item.conditionJson);

    const amount =
      toNumber(action.amount) ??
      toNumber(action.value) ??
      toNumber(action.rate) ??
      toNumber(action.percent) ??
      toNumber(action.multiplier) ??
      0;

    const threshold = toNumber(action.thresholdHours) ?? toNumber(action.threshold_hours) ?? 8;
    const strategy = String(action.strategy ?? "").toLowerCase();
    const compositionMode = normalizeCompositionMode(action.compositionMode, "replace");
    const path = ["ruleItems", String(item.precedence), item.ruleCode];
    const enabled = conditions.enabled !== false;

    if (!enabled) {
      trace.push({
        step: "rule_item_skipped",
        outcome: "condition_false",
        details: {
          ruleCode: item.ruleCode,
          itemType: item.itemType,
          precedence: item.precedence,
          condition: conditions,
        },
      });
      continue;
    }

    let applied: ExecutableRule | null = null;

    if (itemType === "base_rate" || ruleCode.includes("base_rate")) {
      applied = {
        kind: "base_rate",
        strategy: "hourly",
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "overtime" || ruleCode.includes("overtime")) {
      applied = {
        kind: "overtime",
        strategy: "daily_threshold",
        thresholdHours: threshold,
        multiplier: toNumber(action.multiplier) ?? amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "doubletime" || ruleCode.includes("double_time")) {
      applied = {
        kind: "double_time",
        strategy: "after_threshold",
        thresholdHours: threshold,
        multiplier: toNumber(action.multiplier) ?? amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "premium" || ruleCode.includes("shift_premium")) {
      applied = {
        kind: "shift_premium",
        strategy: strategy === "flat_per_shift" ? "flat_per_shift" : "flat_per_hour",
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "travel" || ruleCode.includes("travel")) {
      applied = {
        kind: "travel",
        strategy: strategy === "flat" || strategy === "per_km" ? strategy : "hourly",
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "dues" || ruleCode.includes("dues")) {
      applied = {
        kind: "dues",
        strategy: strategy === "per_hour" || strategy === "flat" ? strategy : "percent_gross",
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "benefit" || ruleCode.includes("benefit")) {
      applied = {
        kind: "benefits",
        strategy: strategy === "percent_gross" || strategy === "flat" ? strategy : "per_hour",
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (itemType === "pension" || ruleCode.includes("pension")) {
      applied = {
        kind: "pension",
        strategy: strategy === "percent_gross" || strategy === "flat" ? strategy : "per_hour",
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (ruleCode.includes("regional_override")) {
      applied = {
        kind: "regional_override",
        strategy: strategy === "replace" ? "replace" : "augment",
        targetRuleKind: String(action.targetRuleKind ?? "gross"),
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    } else if (ruleCode.includes("classification_override")) {
      applied = {
        kind: "classification_override",
        strategy: strategy === "replace" ? "replace" : "augment",
        targetRuleKind: String(action.targetRuleKind ?? "gross"),
        amount,
        sourceRuleId: ruleId,
        ruleCode: item.ruleCode,
        precedence: item.precedence + precedenceAxisWeight(scope),
        compositionMode,
        scope,
        conditions,
        action,
        path,
      };
    }

    if (!applied) continue;

    const previous = latestByKind.get(applied.kind);
    latestByKind.set(applied.kind, applied);
    executableRules.push(applied);
    applyComposedValue(nextValues, applied);

    trace.push({
      step: "rule_item_composed",
      outcome: "resolved",
      details: {
        ruleCode: item.ruleCode,
        kind: applied.kind,
        strategy: applied.strategy,
        compositionMode: applied.compositionMode,
        precedence: applied.precedence,
        numericPrecedence: item.precedence,
        axisWeight: precedenceAxisWeight(scope),
        scope,
        sourceRuleId: applied.sourceRuleId,
        previousSourceRuleId: previous?.sourceRuleId,
        decisionReason:
          applied.compositionMode === "replace"
            ? "replaces prior rule output"
            : applied.compositionMode === "augment"
              ? "augments prior rule output"
              : applied.compositionMode === "stack"
                ? "stacks with compatible prior output"
                : "suppresses prior rule family",
      },
    });

    if (previous && (applied.compositionMode === "replace" || applied.compositionMode === "suppress")) {
      trace.push({
        step: "rule_item_suppressed",
        outcome: "superseded",
        details: {
          kind: applied.kind,
          supersededSourceRuleId: previous.sourceRuleId,
          supersededBySourceRuleId: applied.sourceRuleId,
          compositionMode: applied.compositionMode,
        },
      });
    }
  }

  return {
    executableRules,
    flattenedValues: nextValues,
    trace,
  };
}

export async function resolveRuleSet(context: RuleResolutionContext): Promise<RuleResolutionResult> {
  const trace: RuleResolutionResult["trace"] = [];

  const activeVersion = await resolveActiveCbaRuleVersion(context);
  if (!activeVersion) {
    trace.push({
      step: "version_lookup",
      outcome: "not_found",
      details: { context },
    });
    throw new Error("No active CBA rule version found for employer execution context");
  }

  trace.push({
    step: "version_lookup",
    outcome: "resolved",
    details: {
      ruleVersionId: activeVersion.id,
      ruleVersionCode: activeVersion.ruleVersionCode,
      sourceHash: activeVersion.sourceHash,
    },
  });

  const setItems = (await db.execute(sql`
    select
      id,
      rule_code as "ruleCode",
      item_type as "itemType",
      precedence,
      condition_json as "conditionJson",
      action_json as "actionJson",
      rule_hash as "ruleHash"
    from cba_rule_set_items
    where organization_id = ${context.organizationId}
      and cba_rule_version_id = ${activeVersion.id}
    order by precedence asc
  `)) as Array<{
    id: string;
    ruleCode: string;
    itemType: string;
    precedence: number;
    conditionJson: Record<string, unknown>;
    actionJson: Record<string, unknown>;
    ruleHash: string;
  }>;

  trace.push({
    step: "rule_items_lookup",
    outcome: "resolved",
    details: { count: setItems.length },
  });

  const { executableRules, flattenedValues, trace: executableTrace } = buildExecutableRules({
    ruleVersionId: activeVersion.id,
    rulesJson: (activeVersion.rulesJson ?? {}) as Record<string, unknown>,
    items: setItems.map((item) => ({
      id: item.id,
      ruleCode: item.ruleCode,
      itemType: item.itemType,
      precedence: item.precedence,
      conditionJson: item.conditionJson,
      actionJson: item.actionJson,
    })),
  });
  trace.push(...executableTrace);

  return {
    ruleVersionId: activeVersion.id,
    ruleVersionCode: activeVersion.ruleVersionCode,
    sourceHash: activeVersion.sourceHash,
    rules: {
      version: activeVersion.rulesJson,
      items: setItems.map((item) => ({
        ruleCode: item.ruleCode,
        itemType: item.itemType,
        precedence: item.precedence,
        condition: item.conditionJson,
        action: item.actionJson,
        ruleHash: item.ruleHash,
      })),
    },
    executableRules,
    flattenedValues,
    trace,
  };
}
