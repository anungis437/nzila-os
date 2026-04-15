import { createHash } from "crypto";
import type { ReplayDiff } from "./types";

export function replayDiff(
  original: Record<string, unknown>,
  replayed: Record<string, unknown>,
): ReplayDiff {
  const fields = new Set([...Object.keys(original), ...Object.keys(replayed)]);
  const fieldsChanged: ReplayDiff["fieldsChanged"] = [];

  for (const field of fields) {
    const before = original[field];
    const after = replayed[field];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      fieldsChanged.push({ field, before, after });
    }
  }

  const changed = fieldsChanged.length > 0;
  const summary = changed
    ? `Replay changed ${fieldsChanged.length} field(s): ${fieldsChanged.map((f) => f.field).join(", ")}`
    : "Replay matched original output";

  return { changed, fieldsChanged, summary };
}

export function hashReplayDiff(diff: ReplayDiff): string {
  return createHash("sha256").update(JSON.stringify(diff)).digest("hex");
}
