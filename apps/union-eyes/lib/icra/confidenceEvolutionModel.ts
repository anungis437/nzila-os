/**
 * Confidence Evolution Model — longitudinal confidence trajectory.
 *
 * Given a chronologically ordered series of per-assessment confidence
 * snapshots for the same institution (already pseudonymized by upstream
 * intelligence-network validators), derive whether institutional
 * continuity confidence is stabilizing, improving, eroding, or unchanged
 * per domain.
 *
 * Refusal-default: < 2 snapshots → 'insufficient-history' for every domain.
 */

import type { ContinuityConfidenceDomain } from './continuityConfidenceSignals';

export type ConfidenceTrajectory =
  | 'improving'
  | 'stable'
  | 'eroding'
  | 'volatile'
  | 'insufficient-history';

export interface ConfidenceSnapshot {
  assessmentId: string;
  generatedAt: string;
  confidenceByDomain: Record<ContinuityConfidenceDomain, number | null>;
}

export interface DomainTrajectory {
  domain: ContinuityConfidenceDomain;
  trajectory: ConfidenceTrajectory;
  /** Latest observed confidence (0..1) or null. */
  latest: number | null;
  /** Mean confidence across the available history. */
  mean: number | null;
  /** Standard deviation across history. */
  stddev: number | null;
  /** Number of snapshots that contributed. */
  sampleCount: number;
}

const STABLE_THRESHOLD = 0.07;   // change band considered "no movement"
const VOLATILE_STDDEV = 0.20;    // stddev above this is volatile

export function evaluateConfidenceEvolution(
  snapshots: ConfidenceSnapshot[],
): DomainTrajectory[] {
  const domains: ContinuityConfidenceDomain[] = [
    'operational_clarity',
    'governance_confidence',
    'reconstruction_confidence',
    'onboarding_confidence',
    'modernization_continuity_confidence',
    'recoverability_confidence',
  ];

  const ordered = [...snapshots].sort(
    (a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt),
  );

  return domains.map((domain) => {
    const series = ordered
      .map((s) => s.confidenceByDomain[domain])
      .filter((v): v is number => typeof v === 'number');

    if (series.length < 2) {
      return {
        domain,
        trajectory: 'insufficient-history',
        latest: series.length === 1 ? series[0] : null,
        mean: series.length === 1 ? series[0] : null,
        stddev: null,
        sampleCount: series.length,
      };
    }

    const latest = series[series.length - 1];
    const earliest = series[0];
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const variance =
      series.reduce((acc, v) => acc + (v - mean) ** 2, 0) / series.length;
    const stddev = Math.sqrt(variance);

    let trajectory: ConfidenceTrajectory;
    if (stddev > VOLATILE_STDDEV) {
      trajectory = 'volatile';
    } else {
      const delta = latest - earliest;
      if (Math.abs(delta) < STABLE_THRESHOLD) trajectory = 'stable';
      else if (delta > 0) trajectory = 'improving';
      else trajectory = 'eroding';
    }

    return { domain, trajectory, latest, mean, stddev, sampleCount: series.length };
  });
}
