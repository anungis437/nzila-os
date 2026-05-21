/**
 * ARTIFACT TYPE: Longitudinal Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity evolution timeline.
 *
 * Composes a deterministic, reviewer-readable timeline from a sequence of
 * longitudinal readings for a single institution. The timeline is intentionally
 * minimal: it carries the band progression and the reviewer references that
 * produced each reading. It does NOT compute a forecast.
 */

import type {
  ContinuityTrajectoryBand,
  ContinuityTrajectoryRecord,
} from '../contracts/intelligenceContracts';

export const CONTINUITY_EVOLUTION_TIMELINE_VERSION = '1.0.0' as const;

export interface TimelinePoint {
  readonly observedAt: string; // ISO-8601
  readonly band: ContinuityTrajectoryBand;
  readonly reviewerRefId: string;
}

export interface ContinuityEvolutionTimeline {
  readonly institutionRefHash: string;
  readonly points: ReadonlyArray<TimelinePoint>;
  readonly readable: boolean;
}

/**
 * Composes a timeline for a single institution from its longitudinal readings.
 * Returns a `readable: false` timeline if no readings exist; never invents
 * intermediate points between readings.
 */
export function composeContinuityEvolutionTimeline(
  institutionRefHash: string,
  records: ReadonlyArray<ContinuityTrajectoryRecord>,
): ContinuityEvolutionTimeline {
  const filtered = records.filter(
    (r) => r.handle.institutionRefHash === institutionRefHash,
  );
  if (filtered.length === 0) {
    return { institutionRefHash, points: [], readable: false };
  }
  const points = filtered
    .map<TimelinePoint>((r) => ({
      observedAt: r.observedAt,
      band: r.band,
      reviewerRefId: r.reviewerRefId,
    }))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return { institutionRefHash, points, readable: true };
}
