/**
 * ARTIFACT TYPE: Cross-Institution Intelligence
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Cross-Institution Continuity Intelligence™.
 *
 * Reads a sector baseline envelope and returns the set of continuity patterns
 * the envelope appears to express. The output is anonymous, descriptive, and
 * sector-level only — never per-institution.
 *
 * Hard rules enforced by construction:
 *   - No organizational ranking
 *   - No organizational exposure (no handles ever appear in the output)
 *   - No worker analytics
 *   - No prestige scoring
 *   - No competitive continuity scoring
 *
 * The reading is intentionally a small set of patterns, not a score.
 */

import type {
  IntelligenceSector,
  SectorBaselineEnvelope,
} from '../contracts/intelligenceContracts';
import { K_ANONYMITY_FLOOR } from '../ethics/intelligenceEthicsValidators';
import {
  getContinuityPattern,
  type ContinuityPattern,
  type ContinuityPatternKind,
} from './continuityPatternRegistry';

export const CROSS_INSTITUTION_INTELLIGENCE_VERSION = '1.0.0' as const;

export interface CrossInstitutionReading {
  readonly sector: IntelligenceSector;
  readonly readable: boolean;
  readonly patterns: ReadonlyArray<ContinuityPattern>;
  readonly basedOn: number;
}

function totalMeaningful(distribution: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const [key, value] of Object.entries(distribution)) {
    if (key === 'not_yet_readable') continue;
    total += value;
  }
  return total;
}

function fraction(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function readCrossInstitutionPatterns(
  envelope: SectorBaselineEnvelope,
): CrossInstitutionReading {
  if (
    !envelope.readable ||
    envelope.contributingInstitutions < K_ANONYMITY_FLOOR
  ) {
    return {
      sector: envelope.sector,
      readable: false,
      patterns: [],
      basedOn: envelope.contributingInstitutions,
    };
  }

  const recognised: ContinuityPatternKind[] = [];

  const trajectoryTotal = totalMeaningful(envelope.trajectoryDistribution);
  if (
    trajectoryTotal > 0 &&
    fraction(
      envelope.trajectoryDistribution.holding +
        envelope.trajectoryDistribution.stabilizing,
      trajectoryTotal,
    ) >= 0.7
  ) {
    recognised.push('cohesive_holding_archetype');
  }
  if (
    trajectoryTotal > 0 &&
    fraction(envelope.trajectoryDistribution.regressing, trajectoryTotal) >= 0.4
  ) {
    recognised.push('continuity_fragmentation_archetype');
  }

  const driftTotal = totalMeaningful(envelope.driftDistribution);
  if (
    driftTotal > 0 &&
    fraction(envelope.driftDistribution.stabilizing, driftTotal) >= 0.5
  ) {
    recognised.push('governance_recovery_archetype');
  }

  const stewardshipTotal = totalMeaningful(envelope.stewardshipDistribution);
  if (
    stewardshipTotal > 0 &&
    fraction(envelope.stewardshipDistribution.redistributing, stewardshipTotal) >=
      0.5
  ) {
    recognised.push('stewardship_redistribution_archetype');
  }

  const survivabilityTotal = totalMeaningful(envelope.survivabilityDistribution);
  if (
    survivabilityTotal > 0 &&
    fraction(envelope.survivabilityDistribution.strengthening, survivabilityTotal) >=
      0.5
  ) {
    recognised.push('onboarding_strengthening_archetype');
  }

  const debtTotal = totalMeaningful(envelope.debtDistribution);
  if (
    debtTotal > 0 &&
    fraction(envelope.debtDistribution.reducing, debtTotal) >= 0.5
  ) {
    recognised.push('continuity_debt_reduction_archetype');
  }

  const patterns = recognised
    .sort((a, b) => a.localeCompare(b))
    .map((kind) => getContinuityPattern(kind));

  return {
    sector: envelope.sector,
    readable: true,
    patterns,
    basedOn: envelope.contributingInstitutions,
  };
}
