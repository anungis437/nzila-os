import { describe, it, expect } from "vitest";
import { diffEvaluationGraph, replayDiff, hashReplayDiff } from "../../services/employer-execution/replay-engine";
import type { RuleEvaluationNode } from "../../services/employer-execution/types";

function makeNode(overrides: Partial<RuleEvaluationNode> = {}): RuleEvaluationNode {
  return {
    nodeId: overrides.nodeId ?? "n1",
    payrollRunId: overrides.payrollRunId ?? "run-1",
    employeeExternalId: overrides.employeeExternalId ?? "emp-1",
    ruleKind: overrides.ruleKind ?? "base_rate",
    ruleCode: overrides.ruleCode ?? "BR1",
    sourceRuleId: overrides.sourceRuleId ?? "src-1",
    strategy: overrides.strategy ?? "hourly",
    precedence: overrides.precedence ?? 100,
    conditionResult: overrides.conditionResult ?? "true",
    decision: overrides.decision ?? "applied",
    decisionReason: overrides.decisionReason ?? "applied",
    parentNodeId: overrides.parentNodeId ?? null,
    supersededByNodeId: overrides.supersededByNodeId ?? null,
    compositionMode: overrides.compositionMode ?? "replace",
    path: overrides.path ?? ["base_rate"],
    evaluationOrder: overrides.evaluationOrder ?? 1,
    inputSnapshotHash: overrides.inputSnapshotHash ?? "snap",
    createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  };
}

function makeTrace(nodes: RuleEvaluationNode[], appliedPath: string[]) {
  return { calc_trace: { evaluation_graph: { nodes, appliedPath } } };
}

describe("diffEvaluationGraph", () => {
  it("returns no diffs for identical traces", () => {
    const nodes = [makeNode()];
    const trace = makeTrace(nodes, ["base_rate"]);
    const diffs = diffEvaluationGraph({
      employeeExternalId: "emp-1",
      originalTrace: trace,
      replayTrace: makeTrace([makeNode()], ["base_rate"]),
      causeDetail: "rule change",
    });
    expect(diffs).toEqual([]);
  });

  it("detects a removed node", () => {
    const diffs = diffEvaluationGraph({
      employeeExternalId: "emp-1",
      originalTrace: makeTrace([makeNode()], ["base_rate"]),
      replayTrace: makeTrace([], []),
      causeDetail: "rule removed",
    });
    expect(diffs.some((d) => d.changeType === "node_removed")).toBe(true);
    // appliedPath also changes
    expect(diffs.some((d) => d.changeType === "applied_path_changed")).toBe(true);
    // causeDetail "rule" -> rule_change
    expect(diffs[0].causeType).toBe("rule_change");
  });

  it("detects an added node", () => {
    const diffs = diffEvaluationGraph({
      employeeExternalId: "emp-1",
      originalTrace: makeTrace([], []),
      replayTrace: makeTrace([makeNode()], ["base_rate"]),
      causeDetail: "engine upgrade",
    });
    expect(diffs.some((d) => d.changeType === "node_added")).toBe(true);
    expect(diffs.find((d) => d.changeType === "node_added")!.causeType).toBe("engine_change");
  });

  it("detects condition, decision, and supersession changes", () => {
    const original = makeTrace([makeNode()], ["base_rate"]);
    const replay = makeTrace(
      [
        makeNode({
          conditionResult: "false",
          decision: "skipped",
          decisionReason: "disabled",
          supersededByNodeId: "n2",
        }),
      ],
      ["base_rate"],
    );
    const diffs = diffEvaluationGraph({
      employeeExternalId: "emp-1",
      originalTrace: original,
      replayTrace: replay,
      causeDetail: "input variance",
    });
    expect(diffs.some((d) => d.changeType === "condition_changed")).toBe(true);
    expect(diffs.some((d) => d.changeType === "decision_changed")).toBe(true);
    expect(diffs.some((d) => d.changeType === "supersession_changed")).toBe(true);
    expect(diffs[0].causeType).toBe("input_change");
  });

  it("falls back to derived_change cause type and tolerates malformed traces", () => {
    const diffs = diffEvaluationGraph({
      employeeExternalId: "emp-1",
      originalTrace: null,
      replayTrace: { calc_trace: "not-an-object" },
      causeDetail: "something else",
    });
    expect(diffs).toEqual([]);
  });
});

describe("replayDiff", () => {
  it("reports no change when records are equal", () => {
    const result = replayDiff({ a: 1, b: "x" }, { a: 1, b: "x" });
    expect(result.changed).toBe(false);
    expect(result.differences).toEqual([]);
    expect(result.summary).toBe("Replay matched original output");
  });

  it("reports field-level differences at run scope", () => {
    const result = replayDiff({ total: 100 }, { total: 150 }, "rule change");
    expect(result.changed).toBe(true);
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].field).toBe("total");
    expect(result.differences[0].scope).toBe("run");
    expect(result.differences[0].causeType).toBe("rule_change");
    expect(result.summary).toContain("1 value field");
  });

  it("includes graph differences for employee_item scope", () => {
    const original = {
      grossPay: 100,
      trace: makeTrace([makeNode()], ["base_rate"]),
    };
    const replayed = {
      grossPay: 120,
      trace: makeTrace([], []),
    };
    const result = replayDiff(original, replayed, "input change", {
      scope: "employee_item",
      subjectId: "emp-1",
    });
    expect(result.changed).toBe(true);
    expect(result.graphDifferences.length).toBeGreaterThan(0);
    expect(result.differences[0].scope).toBe("employee_item");
  });
});

describe("hashReplayDiff", () => {
  it("produces a stable sha256 hash for the same diff", () => {
    const diff = replayDiff({ total: 100 }, { total: 150 });
    const h1 = hashReplayDiff(diff);
    const h2 = hashReplayDiff(diff);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});
