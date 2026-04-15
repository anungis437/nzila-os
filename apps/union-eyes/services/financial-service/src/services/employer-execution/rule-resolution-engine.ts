import { sql } from "drizzle-orm";
import { db } from "../../db";
import { resolveActiveCbaRuleVersion } from "./cba-version-resolver";
import type {
  ExecutableRule,
  FlattenedRuleValues,
  RuleResolutionContext,
  RuleResolutionResult,
} from "./types";

function toNumber(value: unknown): number | null {
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
  const latestByKind = new Map<ExecutableRule["kind"], ExecutableRule>();

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

  executableRules.push({
    kind: "base_rate",
    strategy: "hourly",
    amount: defaults.baseRate,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "base_rate"],
  });
  executableRules.push({
    kind: "overtime",
    strategy: "daily_threshold",
    thresholdHours: 8,
    multiplier: defaults.overtimeMultiplier,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "overtime"],
  });
  executableRules.push({
    kind: "double_time",
    strategy: "after_threshold",
    thresholdHours: 12,
    multiplier: defaults.doubleTimeMultiplier,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "double_time"],
  });
  executableRules.push({
    kind: "shift_premium",
    strategy: "flat_per_hour",
    amount: defaults.shiftPremiumRate,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "shift_premium"],
  });
  executableRules.push({
    kind: "travel",
    strategy: "hourly",
    amount: defaults.travelPremiumRate,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "travel"],
  });
  executableRules.push({
    kind: "dues",
    strategy: "percent_gross",
    amount: defaults.duesRate,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "dues"],
  });
  executableRules.push({
    kind: "benefits",
    strategy: "percent_gross",
    amount: defaults.benefitRate,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "benefits"],
  });
  executableRules.push({
    kind: "pension",
    strategy: "percent_gross",
    amount: defaults.pensionRate,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "pension"],
  });
  executableRules.push({
    kind: "statutory_holiday",
    strategy: "calendar_match",
    holidayCode: "GENERIC",
    multiplier: defaults.statutoryHolidayMultiplier,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "statutory_holiday"],
  });
  executableRules.push({
    kind: "regional_override",
    strategy: "augment",
    targetRuleKind: "gross",
    amount: defaults.regionalOverride,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "regional_override"],
  });
  executableRules.push({
    kind: "classification_override",
    strategy: "augment",
    targetRuleKind: "gross",
    amount: defaults.classificationOverride,
    sourceRuleId: input.ruleVersionId,
    path: ["rulesJson", "classification_override"],
  });

  for (const baseRule of executableRules) {
    latestByKind.set(baseRule.kind, baseRule);
  }

  trace.push({ step: "rule_semantics_defaults", outcome: "resolved", details: { defaults } });

  const sorted = [...input.items].sort((a, b) => a.precedence - b.precedence);
  const nextValues = { ...defaults };

  for (const item of sorted) {
    const itemType = (item.itemType ?? "").toLowerCase();
    const ruleCode = (item.ruleCode ?? "").toLowerCase();
    const ruleId = item.id ?? `${input.ruleVersionId}:${item.ruleCode}:${item.precedence}`;
    const action = item.actionJson ?? {};

    const amount =
      toNumber(action.amount) ??
      toNumber(action.value) ??
      toNumber(action.rate) ??
      toNumber(action.percent) ??
      toNumber(action.multiplier) ??
      0;

    const threshold = toNumber(action.thresholdHours) ?? toNumber(action.threshold_hours) ?? 8;
    const strategy = String(action.strategy ?? "").toLowerCase();
    const path = ["ruleItems", String(item.precedence), item.ruleCode];
    const condition = item.conditionJson ?? {};
    const enabled = condition.enabled !== false;

    if (!enabled) {
      trace.push({
        step: "rule_item_skipped",
        outcome: "condition_false",
        details: {
          ruleCode: item.ruleCode,
          itemType: item.itemType,
          precedence: item.precedence,
          condition,
        },
      });
      continue;
    }

    let applied: ExecutableRule | null = null;
    if (itemType === "base_rate" || ruleCode.includes("base_rate")) {
      nextValues.baseRate = amount;
      applied = { kind: "base_rate", strategy: "hourly", amount, sourceRuleId: ruleId, path };
    } else if (itemType === "overtime" || ruleCode.includes("overtime")) {
      const multiplier = toNumber(action.multiplier) ?? amount;
      nextValues.overtimeMultiplier = multiplier;
      applied = {
        kind: "overtime",
        strategy: "daily_threshold",
        thresholdHours: threshold,
        multiplier,
        sourceRuleId: ruleId,
        path,
      };
    } else if (itemType === "doubletime" || ruleCode.includes("double_time")) {
      const multiplier = toNumber(action.multiplier) ?? amount;
      nextValues.doubleTimeMultiplier = multiplier;
      applied = {
        kind: "double_time",
        strategy: "after_threshold",
        thresholdHours: threshold,
        multiplier,
        sourceRuleId: ruleId,
        path,
      };
    } else if (itemType === "premium" || ruleCode.includes("shift_premium")) {
      nextValues.shiftPremiumRate = amount;
      applied = {
        kind: "shift_premium",
        strategy: strategy === "flat_per_shift" ? "flat_per_shift" : "flat_per_hour",
        amount,
        sourceRuleId: ruleId,
        path,
      };
    } else if (itemType === "travel" || ruleCode.includes("travel")) {
      nextValues.travelPremiumRate = amount;
      applied = {
        kind: "travel",
        strategy: strategy === "flat" || strategy === "per_km" ? (strategy as "flat" | "per_km") : "hourly",
        amount,
        sourceRuleId: ruleId,
        path,
      };
    } else if (itemType === "dues" || ruleCode.includes("dues")) {
      nextValues.duesRate = amount;
      applied = {
        kind: "dues",
        strategy: strategy === "per_hour" || strategy === "flat" ? (strategy as "per_hour" | "flat") : "percent_gross",
        amount,
        sourceRuleId: ruleId,
        path,
      };
    } else if (itemType === "benefit" || ruleCode.includes("benefit")) {
      nextValues.benefitRate = amount;
      applied = {
        kind: "benefits",
        strategy: strategy === "percent_gross" || strategy === "flat" ? (strategy as "percent_gross" | "flat") : "per_hour",
        amount,
        sourceRuleId: ruleId,
        path,
      };
    } else if (itemType === "pension" || ruleCode.includes("pension")) {
      nextValues.pensionRate = amount;
      applied = {
        kind: "pension",
        strategy: strategy === "percent_gross" || strategy === "flat" ? (strategy as "percent_gross" | "flat") : "per_hour",
        amount,
        sourceRuleId: ruleId,
        path,
      };
    } else if (ruleCode.includes("regional_override")) {
      nextValues.regionalOverride = amount;
      applied = {
        kind: "regional_override",
        strategy: strategy === "replace" ? "replace" : "augment",
        targetRuleKind: String(action.targetRuleKind ?? "gross"),
        amount,
        sourceRuleId: ruleId,
        path,
      };
    } else if (ruleCode.includes("classification_override")) {
      nextValues.classificationOverride = amount;
      applied = {
        kind: "classification_override",
        strategy: strategy === "replace" ? "replace" : "augment",
        targetRuleKind: String(action.targetRuleKind ?? "gross"),
        amount,
        sourceRuleId: ruleId,
        path,
      };
    }

    if (applied) {
      const previous = latestByKind.get(applied.kind);
      executableRules.push(applied);
      latestByKind.set(applied.kind, applied);

      if (previous) {
        trace.push({
          step: "rule_item_suppressed",
          outcome: "superseded",
          details: {
            kind: applied.kind,
            supersededSourceRuleId: previous.sourceRuleId,
            supersededPath: previous.path,
            supersededBySourceRuleId: applied.sourceRuleId,
            supersededByPath: applied.path,
            precedence: item.precedence,
          },
        });
      }

      trace.push({
        step: "rule_item_applied",
        outcome: "override",
        details: {
          ruleCode: item.ruleCode,
          itemType: item.itemType,
          precedence: item.precedence,
          kind: applied.kind,
          strategy: applied.strategy,
          sourceRuleId: applied.sourceRuleId,
          condition,
          supersededSourceRuleId: previous?.sourceRuleId,
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
