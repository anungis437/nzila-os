/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Facilitator Runtime
 * DOCTRINE_VERSION: 2.0.0
 *
 * Facilitation pacing model. Deterministic categorical rule:
 *
 *   recent ratified  | recent regressed | pacing
 *   ---------------- | ---------------- | -------
 *   0                | 0                | hold
 *   >= 1             | 0                | advance
 *   >= 1             | >= 1             | slow
 *   0                | >= 1             | defer
 *
 * Overload protection: if active interventions exceed bandwidth,
 * pacing is forced to "slow".
 *
 * Pure, deterministic.
 */

export const ENGINE_VERSION = '2.0.0';

export type PacingRecommendation = 'advance' | 'hold' | 'slow' | 'defer';

export interface PacingInput {
  readonly recentRatifiedCount: number;
  readonly recentRegressedCount: number;
  readonly activeInterventionCount: number;
  readonly bandwidthThreshold?: number;
}

export interface PacingReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly pacing: PacingRecommendation;
  readonly overloadEngaged: boolean;
  readonly statement: string;
}

const DEFAULT_BANDWIDTH = 6;

export function readFacilitationPacing(input: PacingInput): PacingReading {
  const threshold = input.bandwidthThreshold ?? DEFAULT_BANDWIDTH;
  const overloadEngaged = input.activeInterventionCount > threshold;

  let pacing: PacingRecommendation;
  if (input.recentRatifiedCount === 0 && input.recentRegressedCount === 0) {
    pacing = 'hold';
  } else if (input.recentRatifiedCount >= 1 && input.recentRegressedCount === 0) {
    pacing = 'advance';
  } else if (input.recentRatifiedCount >= 1 && input.recentRegressedCount >= 1) {
    pacing = 'slow';
  } else {
    pacing = 'defer';
  }

  if (overloadEngaged && pacing === 'advance') pacing = 'slow';

  return {
    engineVersion: ENGINE_VERSION,
    pacing,
    overloadEngaged,
    statement: statementFor(pacing, overloadEngaged),
  };
}

function statementFor(pacing: PacingRecommendation, overload: boolean): string {
  const overloadNote = overload
    ? ' Institutional bandwidth has been exceeded; intervention pacing is held back to protect the institutional rhythm.'
    : '';
  switch (pacing) {
    case 'advance':
      return `Recent ratified moves with no recorded regression; the facilitator may advance the next intervention.${overloadNote}`;
    case 'hold':
      return `No recent ratified or regressed moves; the facilitator should hold and observe.${overloadNote}`;
    case 'slow':
      return `Recent moves include both ratifications and regression; the facilitator should slow the cadence.${overloadNote}`;
    case 'defer':
      return `Recent regression with no recorded ratification; the facilitator should defer further interventions until recovery is observed.${overloadNote}`;
  }
}
