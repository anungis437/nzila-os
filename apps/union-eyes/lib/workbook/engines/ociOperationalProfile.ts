/**
 * ARTIFACT TYPE: Cross-Module Synthesis Helper
 * DOCTRINE_VERSION: 2.0.0
 *
 * Composes the OCI Operational Profile™ — a single read of the
 * institution's operational continuity posture across all six modules.
 * Pure, deterministic.
 */

export type OperationalPosture =
  | 'continuity_stable'
  | 'continuity_observed'
  | 'continuity_concentrated'
  | 'continuity_fragile'
  | 'continuity_critical';

export interface OciOperationalProfileInput {
  readonly densityIndex: number;
  readonly governanceDriftAggregate: number;
  readonly breakpointCriticalCount: number;
  readonly modernizationErodingCount: number;
  readonly lineageLapsedOrFadingCount: number;
  readonly stabilizationCandidateCount: number;
}

export interface OciOperationalProfile {
  readonly posture: OperationalPosture;
  readonly compositeIndex: number;
  readonly facets: {
    readonly stewardship: number;
    readonly governance: number;
    readonly breakpoint: number;
    readonly modernization: number;
    readonly lineage: number;
  };
  readonly reading: string;
}

export function composeOciOperationalProfile(
  input: OciOperationalProfileInput,
): OciOperationalProfile {
  const stewardship = clamp01(input.densityIndex);
  const governance = clamp01(input.governanceDriftAggregate);
  const breakpoint = clamp01(input.breakpointCriticalCount / 5);
  const modernization = clamp01(input.modernizationErodingCount / 3);
  const lineage = clamp01(input.lineageLapsedOrFadingCount / 5);

  const composite =
    0.3 * stewardship +
    0.2 * governance +
    0.2 * breakpoint +
    0.15 * modernization +
    0.15 * lineage;

  const posture = classifyPosture(composite);

  return {
    posture,
    compositeIndex: round2(composite),
    facets: {
      stewardship: round2(stewardship),
      governance: round2(governance),
      breakpoint: round2(breakpoint),
      modernization: round2(modernization),
      lineage: round2(lineage),
    },
    reading: buildReading(posture, input.stabilizationCandidateCount),
  };
}

function classifyPosture(value: number): OperationalPosture {
  if (value >= 0.8) return 'continuity_critical';
  if (value >= 0.6) return 'continuity_fragile';
  if (value >= 0.4) return 'continuity_concentrated';
  if (value >= 0.2) return 'continuity_observed';
  return 'continuity_stable';
}

function buildReading(posture: OperationalPosture, stabilizationCount: number): string {
  switch (posture) {
    case 'continuity_stable':
      return 'Operational continuity is stable. Periodic mapping is sufficient.';
    case 'continuity_observed':
      return 'Operational continuity is observed in a few facets. Targeted attention is warranted.';
    case 'continuity_concentrated':
      return `Operational continuity is concentrated across multiple facets. ${stabilizationCount} stabilization moves are candidates for the next 90 days.`;
    case 'continuity_fragile':
      return `Operational continuity is fragile across multiple facets. Stabilization is the priority phase; ${stabilizationCount} moves are sequenced.`;
    case 'continuity_critical':
      return `Operational continuity is critical across multiple facets. Stabilization is required; ${stabilizationCount} moves are sequenced and governance ratification should accompany them.`;
  }
  return 'Operational continuity posture is recorded.';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
