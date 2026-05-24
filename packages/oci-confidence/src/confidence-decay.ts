/**
 * ARTIFACT TYPE: IP / Module
 * PACKAGE: @nzila/oci-confidence
 * MODULE: confidence-decay
 * DOCTRINE_VERSION: 1.0.0
 *
 * Temporal confidence degradation. Maps an assessment age in days to
 * a decay band per the doctrine schedule:
 *
 *   < 90d   -> NONE
 *   90-180  -> MILD
 *   180-365 -> MODERATE
 *   > 365   -> SEVERE
 *
 * Decay never converts a HIGH confidence to a probability claim; it
 * shifts the confidence band conservatively.
 */

import type { ConfidenceState, DecayBand, CautionState } from './confidenceContracts';

export interface DecayResult {
  readonly band: DecayBand;
  readonly caution: CautionState | null;
}

export function classifyDecay(ageDays: number | null | undefined): DecayResult {
  if (ageDays == null || !Number.isFinite(ageDays) || ageDays < 0) {
    return Object.freeze({ band: 'NONE', caution: null });
  }
  if (ageDays < 90) return Object.freeze({ band: 'NONE', caution: null });
  if (ageDays < 180) return Object.freeze({ band: 'MILD', caution: null });
  if (ageDays < 365) return Object.freeze({ band: 'MODERATE', caution: 'OUTDATED_ASSESSMENT' });
  return Object.freeze({ band: 'SEVERE', caution: 'OUTDATED_ASSESSMENT' });
}

/** Apply decay to a base confidence band; never raises confidence. */
export function applyDecay(base: ConfidenceState, decay: DecayBand): ConfidenceState {
  if (base === 'INSUFFICIENT') return 'INSUFFICIENT';
  switch (decay) {
    case 'NONE':
      return base;
    case 'MILD':
      return base === 'HIGH' ? 'MODERATE' : base;
    case 'MODERATE':
      if (base === 'HIGH') return 'MODERATE';
      if (base === 'MODERATE') return 'LOW';
      return base;
    case 'SEVERE':
      return 'INSUFFICIENT';
  }
}

export const DECAY_THRESHOLDS_DAYS = Object.freeze({ mild: 90, moderate: 180, severe: 365 });
