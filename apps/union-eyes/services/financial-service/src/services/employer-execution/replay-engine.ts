import { createHash } from "crypto";
import type { ReplayDiff } from "./types";

export function replayDiff(
  original: Record<string, unknown>,
  replayed: Record<string, unknown>,
  reason = "replay variance",
): ReplayDiff {
  const fields = new Set([...Object.keys(original), ...Object.keys(replayed)]);
  const differences: ReplayDiff["differences"] = [];

  for (const field of fields) {
    const originalValue = original[field];
    const replayValue = replayed[field];
    if (JSON.stringify(originalValue) !== JSON.stringify(replayValue)) {
      differences.push({ field, original: originalValue, replay: replayValue, reason });
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
