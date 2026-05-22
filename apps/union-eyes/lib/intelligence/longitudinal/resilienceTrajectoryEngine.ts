/**
 * ARTIFACT TYPE: Resilience Trajectory Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Resilience trajectory engine.
 *
 * Reads a continuity evolution timeline and produces a single resilience
 * trajectory band describing how the institution's continuity has moved.
 *
 * The engine refuses to read a trajectory from a single observation. It needs
 * at least two readings; otherwise the result is `not_yet_readable`.
 *
 * Banding rules (deterministic, refusal-first):
 *   - `not_yet_readable` if fewer than 2 readings exist OR every reading is
 *     itself `not_yet_readable`.
 *   - `persisting`     if the last reading is `holding` or `stabilizing` AND
 *                      no reading in the trailing window is `regressing`.
 *   - `eroding`        if the last reading is `regressing`.
 *   - `holding`        otherwise.
 */

import type {
  ContinuityTrajectoryBand,
  InstitutionalResilienceBand,
} from '../contracts/intelligenceContracts';
import type { ContinuityEvolutionTimeline } from './continuityEvolutionTimeline';

export const RESILIENCE_TRAJECTORY_VERSION = '1.0.0' as const;

export interface ResilienceTrajectoryReading {
  readonly band: InstitutionalResilienceBand;
  readonly basedOn: number; // number of readings considered
  readonly observedAt: string; // ISO-8601 of the most recent reading, or empty
}

const REFUSAL: ResilienceTrajectoryReading = Object.freeze({
  band: 'not_yet_readable',
  basedOn: 0,
  observedAt: '',
});

function isMeaningful(band: ContinuityTrajectoryBand): boolean {
  return band !== 'not_yet_readable';
}

export function readResilienceTrajectory(
  timeline: ContinuityEvolutionTimeline,
): ResilienceTrajectoryReading {
  if (!timeline.readable || timeline.points.length < 2) {
    return REFUSAL;
  }
  const meaningfulPoints = timeline.points.filter((p) => isMeaningful(p.band));
  if (meaningfulPoints.length < 2) {
    return REFUSAL;
  }
  const lastPoint = meaningfulPoints[meaningfulPoints.length - 1]!;
  const lastBand = lastPoint.band;
  let band: InstitutionalResilienceBand;
  if (lastBand === 'regressing') {
    band = 'eroding';
  } else if (
    (lastBand === 'holding' || lastBand === 'stabilizing') &&
    !meaningfulPoints.some((p) => p.band === 'regressing')
  ) {
    band = 'persisting';
  } else {
    band = 'holding';
  }
  return {
    band,
    basedOn: meaningfulPoints.length,
    observedAt: lastPoint.observedAt,
  };
}
