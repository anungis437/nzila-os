/**
 * One read of a health & safety stats route for a screen, as a hook.
 *
 * The stats routes answer through withApi, so their figures arrive as { success, data: { ... }, timestamp }. The answer is kept with the
 * organization, route and attempt it was read for, so it is never shown for another organization or while a retry is on its way, and a
 * failed read is an outcome of its own: the screen shows it as unknown, never as zero.
 */
"use client";

import * as React from "react";
import { logger } from "@/lib/logger";
import { envelopeData, readApiError } from "@/lib/client/api-envelope";

export type StatsOutcome<T> = { kind: "ready"; stats: T } | { kind: "error"; message: string };

async function readStats<T>(path: string, parse: (data: Record<string, unknown>) => T): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(await readApiError(response, `The statistics could not be loaded (status ${response.status}).`));
  return parse(envelopeData(await response.json()));
}

/**
 * `parse` must be a stable function (declare it at module level); it throws when the figures are not what the route promises.
 * `scope` is whatever the figures belong to besides the route (the organization); with `enabled` false nothing is read.
 */
export function useStats<T>(path: string, parse: (data: Record<string, unknown>) => T, scope: string, enabled: boolean) {
  const [attempt, setAttempt] = React.useState(0);
  const [loaded, setLoaded] = React.useState<{ key: string; outcome: StatsOutcome<T> } | null>(null);
  const key = `${scope}|${path}|${attempt}`;

  React.useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    readStats(path, parse).then(
      (stats) => {
        if (current) setLoaded({ key, outcome: { kind: "ready", stats } });
      },
      (error: unknown) => {
        logger.error(`Failed to read ${path}`, error);
        if (current) setLoaded({ key, outcome: { kind: "error", message: error instanceof Error ? error.message : "The statistics could not be loaded." } });
      },
    );
    return () => {
      current = false;
    };
  }, [enabled, key, path, parse]);

  const reload = React.useCallback(() => setAttempt((count) => count + 1), []);
  return { outcome: loaded?.key === key ? loaded.outcome : null, reload };
}
