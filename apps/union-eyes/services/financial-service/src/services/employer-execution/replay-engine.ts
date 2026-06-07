import { createHash } from "crypto";
import type { EvaluationGraphDiffEntry, ReplayDiff, ReplayDiffEntry, RuleEvaluationNode } from "./types";

function jsonEqual(left: any, right: any): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function causeTypeFromDetail(causeDetail: string): ReplayDiffEntry["causeType"] {
  const normalized = causeDetail.toLowerCase();
  if (normalized.includes("rule")) return "rule_change";
  if (normalized.includes("engine")) return "engine_change";
  if (normalized.includes("input")) return "input_change";
  return "derived_change";
}

function toRecord(value: any): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getEvaluationNodes(value: any): RuleEvaluationNode[] {
  const record = toRecord(value);
  const calcTrace = toRecord(record.calc_trace);
  const evaluationGraph = toRecord(calcTrace.evaluation_graph);
  const nodes = evaluationGraph.nodes;

  if (!Array.isArray(nodes)) return [];
  return nodes.filter((node): node is RuleEvaluationNode => typeof node === "object" && node !== null) as RuleEvaluationNode[];
}

function getAppliedPath(value: any): string[] {
  const record = toRecord(value);
  const calcTrace = toRecord(record.calc_trace);
  const evaluationGraph = toRecord(calcTrace.evaluation_graph);
  const path = evaluationGraph.appliedPath;
  if (!Array.isArray(path)) return [];
  return path.filter((entry): entry is string => typeof entry === "string");
}

function keyForNode(node: RuleEvaluationNode): string {
  return `${node.ruleKind}:${node.sourceRuleId}:${node.ruleCode}:${node.evaluationOrder}`;
}

export function diffEvaluationGraph(input: {
  employeeExternalId: string;
  originalTrace: any;
  replayTrace: any;
  causeDetail: string;
}): EvaluationGraphDiffEntry[] {
  const originalNodes = getEvaluationNodes(input.originalTrace);
  const replayNodes = getEvaluationNodes(input.replayTrace);
  const originalByKey = new Map(originalNodes.map((node) => [keyForNode(node), node]));
  const replayByKey = new Map(replayNodes.map((node) => [keyForNode(node), node]));

  const diffs: EvaluationGraphDiffEntry[] = [];
  const causeType = causeTypeFromDetail(input.causeDetail);

  for (const [key, originalNode] of originalByKey) {
    const replayNode = replayByKey.get(key);
    if (!replayNode) {
      diffs.push({
        employeeExternalId: input.employeeExternalId,
        nodeId: originalNode.nodeId,
        changeType: "node_removed",
        original: originalNode as any as Record<string, unknown>,
        replay: undefined,
        causeType,
        causeDetail: input.causeDetail,
      });
      continue;
    }

    if (originalNode.conditionResult !== replayNode.conditionResult) {
      diffs.push({
        employeeExternalId: input.employeeExternalId,
        nodeId: originalNode.nodeId,
        changeType: "condition_changed",
        original: { conditionResult: originalNode.conditionResult },
        replay: { conditionResult: replayNode.conditionResult },
        causeType,
        causeDetail: input.causeDetail,
      });
    }

    if (originalNode.decision !== replayNode.decision || originalNode.decisionReason !== replayNode.decisionReason) {
      diffs.push({
        employeeExternalId: input.employeeExternalId,
        nodeId: originalNode.nodeId,
        changeType: "decision_changed",
        original: {
          decision: originalNode.decision,
          decisionReason: originalNode.decisionReason,
        },
        replay: {
          decision: replayNode.decision,
          decisionReason: replayNode.decisionReason,
        },
        causeType,
        causeDetail: input.causeDetail,
      });
    }

    if ((originalNode.supersededByNodeId ?? null) !== (replayNode.supersededByNodeId ?? null)) {
      diffs.push({
        employeeExternalId: input.employeeExternalId,
        nodeId: originalNode.nodeId,
        changeType: "supersession_changed",
        original: { supersededByNodeId: originalNode.supersededByNodeId ?? null },
        replay: { supersededByNodeId: replayNode.supersededByNodeId ?? null },
        causeType,
        causeDetail: input.causeDetail,
      });
    }
  }

  for (const [key, replayNode] of replayByKey) {
    if (!originalByKey.has(key)) {
      diffs.push({
        employeeExternalId: input.employeeExternalId,
        nodeId: replayNode.nodeId,
        changeType: "node_added",
        original: undefined,
        replay: replayNode as any as Record<string, unknown>,
        causeType,
        causeDetail: input.causeDetail,
      });
    }
  }

  const originalAppliedPath = getAppliedPath(input.originalTrace);
  const replayAppliedPath = getAppliedPath(input.replayTrace);
  if (!jsonEqual(originalAppliedPath, replayAppliedPath)) {
    diffs.push({
      employeeExternalId: input.employeeExternalId,
      changeType: "applied_path_changed",
      original: { appliedPath: originalAppliedPath },
      replay: { appliedPath: replayAppliedPath },
      causeType,
      causeDetail: input.causeDetail,
    });
  }

  return diffs;
}

export function replayDiff(
  original: Record<string, unknown>,
  replayed: Record<string, unknown>,
  causeDetail = "derived replay variance",
  options?: {
    scope?: ReplayDiffEntry["scope"];
    subjectId?: string;
    originalRulePath?: string[];
    replayRulePath?: string[];
  },
): ReplayDiff {
  const fields = new Set([...Object.keys(original), ...Object.keys(replayed)]);
  const differences: ReplayDiff["differences"] = [];

  for (const field of fields) {
    const originalValue = original[field];
    const replayValue = replayed[field];
    if (!jsonEqual(originalValue, replayValue)) {
      differences.push({
        scope: options?.scope ?? "run",
        subjectId: options?.subjectId ?? "run",
        field,
        originalValue,
        replayValue,
        causeType: causeTypeFromDetail(causeDetail),
        causeDetail,
        originalRulePath: options?.originalRulePath,
        replayRulePath: options?.replayRulePath,
      });
    }
  }

  const graphDifferences =
    options?.scope === "employee_item"
      ? diffEvaluationGraph({
          employeeExternalId: options.subjectId ?? "unknown",
          originalTrace: original.trace,
          replayTrace: replayed.trace,
          causeDetail,
        })
      : [];

  const changed = differences.length > 0 || graphDifferences.length > 0;
  const summary = changed
    ? `Replay changed ${differences.length} value field(s) and ${graphDifferences.length} graph node(s)`
    : "Replay matched original output";

  return { changed, differences, graphDifferences, summary };
}

export function hashReplayDiff(diff: ReplayDiff): string {
  return createHash("sha256").update(JSON.stringify(diff)).digest("hex");
}
