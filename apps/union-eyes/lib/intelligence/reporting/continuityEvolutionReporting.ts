/**
 * ARTIFACT TYPE: Continuity Evolution Reporting
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity evolution reporting.
 *
 * Composes the longitudinal continuity report consumed by executive-level
 * reviewers. The report intentionally feels institutionally reflective rather
 * than dashboard-like:
 *
 *   - resilience trajectories
 *   - governance entropy movement
 *   - stewardship evolution
 *   - continuity debt reduction
 *   - onboarding survivability evolution
 *   - institutional coherence trends
 *
 * It carries narrative paragraphs alongside the structured longitudinal reading
 * so reviewers receive both the reading and the interpretive frame in one
 * surface.
 */

import type { LongitudinalReading } from '../longitudinal/longitudinalContinuityEngine';
import {
  composeInstitutionalTrajectoryNarrative,
  type TrajectoryNarrative,
} from './institutionalTrajectoryNarrative';

export const CONTINUITY_EVOLUTION_REPORTING_VERSION = '1.0.0' as const;

export interface ContinuityEvolutionReport {
  readonly institutionRefHash: string;
  readonly composedAt: string; // ISO-8601
  readonly reading: LongitudinalReading;
  readonly narrative: TrajectoryNarrative;
  /**
   * Reviewer reference for the executive author of the report. Carried so
   * the report remains traceable inside the contributing institution.
   */
  readonly reviewerRefId: string;
  readonly readableForExecutive: boolean;
}

export function composeContinuityEvolutionReport(input: {
  reading: LongitudinalReading;
  composedAt: string;
  reviewerRefId: string;
}): ContinuityEvolutionReport {
  const narrative = composeInstitutionalTrajectoryNarrative(input.reading);
  return {
    institutionRefHash: input.reading.institutionRefHash,
    composedAt: input.composedAt,
    reading: input.reading,
    narrative,
    reviewerRefId: input.reviewerRefId,
    readableForExecutive: narrative.readableForExecutive,
  };
}
