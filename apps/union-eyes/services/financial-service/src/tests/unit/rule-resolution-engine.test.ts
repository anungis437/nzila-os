import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({ execute: vi.fn() }));
const resolverMock = vi.hoisted(() => ({ resolveActiveCbaRuleVersion: vi.fn() }));

vi.mock("../../db", () => ({ db: dbMock }));
vi.mock("../../services/employer-execution/cba-version-resolver", () => resolverMock);

import {
  buildExecutableRules,
  resolveRuleSet,
} from "../../services/employer-execution/rule-resolution-engine";

type Item = {
  id?: string;
  ruleCode: string;
  itemType: string;
  precedence: number;
  conditionJson?: Record<string, unknown>;
  actionJson?: Record<string, unknown>;
};

function build(items: Item[], rulesJson: Record<string, unknown> = {}) {
  return buildExecutableRules({ ruleVersionId: "rv-1", rulesJson, items });
}

describe("buildExecutableRules — defaults and base rules", () => {
  it("emits the 11 base rules with rulesJson-derived defaults", () => {
    const out = build([], {
      base_rate: 30,
      overtime: 1.75,
      double_time: 2.5,
      shift_premium: 2,
      travel: 0.6,
      dues: 0.02,
      benefits: 0.03,
      pension: 0.04,
      statutory_holiday: 1.5,
      regional_override: 1.1,
      classification_override: 1.2,
    });
    expect(out.executableRules).toHaveLength(11);
    expect(out.flattenedValues.baseRate).toBe(30);
    expect(out.flattenedValues.overtimeMultiplier).toBe(1.75);
    expect(out.flattenedValues.statutoryHolidayMultiplier).toBe(1.5);
    expect(out.flattenedValues.regionalOverride).toBe(1.1);
    // trace includes the defaults step
    expect(out.trace.some((t) => t.step === "rule_semantics_defaults")).toBe(true);
  });

  it("falls back to neutral defaults when rulesJson omits or has invalid values", () => {
    const out = build([], { base_rate: "not-a-number", overtime: "" });
    expect(out.flattenedValues.baseRate).toBe(0);
    expect(out.flattenedValues.overtimeMultiplier).toBe(1.5);
    expect(out.flattenedValues.doubleTimeMultiplier).toBe(2);
    expect(out.flattenedValues.regionalOverride).toBe(1);
  });

  it("reads alternate rulesJson key aliases and string numbers", () => {
    const out = build([], { hourly_rate: "42", overtime_multiplier: "2" });
    expect(out.flattenedValues.baseRate).toBe(42);
    expect(out.flattenedValues.overtimeMultiplier).toBe(2);
  });
});

describe("buildExecutableRules — rule items by type", () => {
  it("classifies every item type and composes its value", () => {
    const items: Item[] = [
      { ruleCode: "base", itemType: "base_rate", precedence: 1, actionJson: { amount: 50 } },
      { ruleCode: "ot", itemType: "overtime", precedence: 2, actionJson: { multiplier: 2 } },
      { ruleCode: "dt", itemType: "doubletime", precedence: 3, actionJson: { multiplier: 3 } },
      {
        ruleCode: "prem",
        itemType: "premium",
        precedence: 4,
        actionJson: { amount: 5, strategy: "flat_per_shift" },
      },
      {
        ruleCode: "trv",
        itemType: "travel",
        precedence: 5,
        actionJson: { amount: 1, strategy: "per_km" },
      },
      { ruleCode: "dues", itemType: "dues", precedence: 6, actionJson: { amount: 0.05 } },
      { ruleCode: "ben", itemType: "benefit", precedence: 7, actionJson: { amount: 0.06 } },
      { ruleCode: "pen", itemType: "pension", precedence: 8, actionJson: { amount: 0.07 } },
      {
        ruleCode: "regional_override_x",
        itemType: "other",
        precedence: 9,
        actionJson: { multiplier: 1.3 },
      },
      {
        ruleCode: "classification_override_y",
        itemType: "other",
        precedence: 10,
        actionJson: { multiplier: 1.4 },
      },
    ];
    const out = build(items);
    expect(out.flattenedValues.baseRate).toBe(50);
    expect(out.flattenedValues.overtimeMultiplier).toBe(2);
    expect(out.flattenedValues.doubleTimeMultiplier).toBe(3);
    expect(out.flattenedValues.shiftPremiumRate).toBe(5);
    expect(out.flattenedValues.travelPremiumRate).toBe(1);
    expect(out.flattenedValues.duesRate).toBe(0.05);
    expect(out.flattenedValues.benefitRate).toBe(0.06);
    expect(out.flattenedValues.pensionRate).toBe(0.07);
    expect(out.flattenedValues.regionalOverride).toBe(1.3);
    expect(out.flattenedValues.classificationOverride).toBe(1.4);
    expect(out.trace.some((t) => t.step === "rule_item_composed")).toBe(true);
  });

  it("supports replace/augment/stack/suppress composition and records supersession", () => {
    const items: Item[] = [
      { ruleCode: "base1", itemType: "base_rate", precedence: 1, actionJson: { amount: 20, compositionMode: "replace" } },
      { ruleCode: "base2", itemType: "base_rate", precedence: 2, actionJson: { amount: 5, compositionMode: "augment" } },
      { ruleCode: "base3", itemType: "base_rate", precedence: 3, actionJson: { amount: 5, compositionMode: "stack" } },
      { ruleCode: "dues1", itemType: "dues", precedence: 4, actionJson: { amount: 0.05, compositionMode: "suppress" } },
    ];
    const out = build(items);
    // 20 replace, +5 augment, +5 stack = 30
    expect(out.flattenedValues.baseRate).toBe(30);
    // dues suppressed -> neutral 0
    expect(out.flattenedValues.duesRate).toBe(0);
    expect(out.trace.some((t) => t.step === "rule_item_suppressed")).toBe(true);
  });

  it("skips disabled items and applies precedence axis weighting via scope", () => {
    const items: Item[] = [
      {
        ruleCode: "base_disabled",
        itemType: "base_rate",
        precedence: 1,
        conditionJson: { enabled: false },
        actionJson: { amount: 999 },
      },
      {
        ruleCode: "base_scoped",
        itemType: "base_rate",
        precedence: 2,
        conditionJson: { employerId: "e1", worksiteId: "w1", classificationCode: "c1" },
        actionJson: { amount: 60 },
      },
    ];
    const out = build(items);
    // disabled item is skipped -> scoped 60 wins
    expect(out.flattenedValues.baseRate).toBe(60);
    expect(out.trace.some((t) => t.step === "rule_item_skipped")).toBe(true);
    const composed = out.executableRules.find((r) => r.ruleCode === "base_scoped")!;
    // precedence 2 + axisWeight(employer 200 + worksite 300 + classification 500) = 1002
    expect(composed.precedence).toBe(1002);
  });

  it("ignores items that match no known kind", () => {
    const out = build([{ ruleCode: "mystery", itemType: "unknown", precedence: 1, actionJson: { amount: 1 } }]);
    // only the 11 base rules remain
    expect(out.executableRules).toHaveLength(11);
  });
});

describe("resolveRuleSet", () => {
  beforeEach(() => {
    dbMock.execute.mockReset();
    resolverMock.resolveActiveCbaRuleVersion.mockReset();
  });

  it("throws when no active version is resolved", async () => {
    resolverMock.resolveActiveCbaRuleVersion.mockResolvedValue(null);
    await expect(
      resolveRuleSet({ organizationId: "org-1", workDate: "2025-01-01" }),
    ).rejects.toThrow(/No active CBA rule version found/);
  });

  it("resolves a rule set with executable rules and trace", async () => {
    resolverMock.resolveActiveCbaRuleVersion.mockResolvedValue({
      id: "rv-1",
      ruleVersionCode: "RV-1",
      sourceHash: "hash-1",
      rulesJson: { base_rate: 25 },
    });
    dbMock.execute.mockResolvedValue([
      {
        id: "i1",
        ruleCode: "ot",
        itemType: "overtime",
        precedence: 1,
        conditionJson: {},
        actionJson: { multiplier: 2 },
        ruleHash: "rh-1",
      },
    ]);
    const result = await resolveRuleSet({ organizationId: "org-1", workDate: "2025-01-01" });
    expect(result.ruleVersionCode).toBe("RV-1");
    expect(result.sourceHash).toBe("hash-1");
    expect(result.flattenedValues.baseRate).toBe(25);
    expect(result.flattenedValues.overtimeMultiplier).toBe(2);
    expect(result.rules.items).toHaveLength(1);
    expect(result.trace.some((t) => t.step === "version_lookup" && t.outcome === "resolved")).toBe(true);
    expect(result.trace.some((t) => t.step === "rule_items_lookup")).toBe(true);
  });
});
