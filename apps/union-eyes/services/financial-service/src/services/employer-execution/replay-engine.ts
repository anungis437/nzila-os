import { createHash } from "crypto";
import type { ReplayDiff, ReplayDiffEntry } from "./types";

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function causeTypeFromDetail(causeDetail: string): ReplayDiffEntry["causeType"] {
  const normalized = causeDetail.toLowerCase();
  if (normalized.includes("rule")) return "rule_change";
  if (normalized.includes("engine")) return "engine_change";
  if (normalized.includes("input")) return "input_change";
  return "derived_change";
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

  const changed = differences.length > 0;
  const summary = changed
    ? `Replay changed ${differences.length} field(s): ${differences.map((f) => f.field).join(", ")}`
    : "Replay matched original output";

  return { changed, differences, summary };
}

export function hashReplayDiff(diff: ReplayDiff): string {
  return createHash("sha256").update(JSON.stringify(diff)).digest("hex");
}
