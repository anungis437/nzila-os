/**
 * ARTIFACT TYPE: IP / Contracts
 * MODULE: lib/oci/statistics/statisticalAnchorContracts
 * DOCTRINE_VERSION: 1.0.0
 *
 * Authoritative types for the HHI + Gini Statistical Anchoring™ layer.
 *
 * Doctrine: HHI/Gini CONTEXTUALIZE OCI; they do NOT replace OCI
 * interpretation, and they NEVER rank institutions.
 */

import type { ConfidenceState, CautionState } from '@nzila/oci-confidence';

export interface ConcentrationInput {
  /** Stable identifier for the bearer (carrier, role, function). Surveillance-safe — typically a hash. */
  readonly id: string;
  /** Non-negative share of the dependent resource. */
  readonly weight: number;
}

export const HHI_BANDS = ['DISTRIBUTED', 'MODERATE', 'CONCENTRATED', 'HIGHLY_CONCENTRATED'] as const;
export type HHIBand = (typeof HHI_BANDS)[number];

export const GINI_BANDS = ['EVEN', 'UNEVEN', 'INEQUITABLE', 'EXTREME'] as const;
export type GiniBand = (typeof GINI_BANDS)[number];

export interface HHIResult {
  /** Normalised HHI in [0,1]. 1/n floor when all weights equal. */
  readonly value: number;
  /** Scaled HHI in [0, 10000] for standards-language compatibility. */
  readonly scaled: number;
  readonly band: HHIBand;
  readonly population: number;
  readonly confidence: ConfidenceState;
  readonly cautionStates: ReadonlyArray<CautionState>;
  readonly rationale: ReadonlyArray<string>;
}

export interface GiniResult {
  /** Gini coefficient in [0,1]. 0 = even, 1 = maximally unequal. */
  readonly value: number;
  readonly band: GiniBand;
  readonly population: number;
  readonly confidence: ConfidenceState;
  readonly cautionStates: ReadonlyArray<CautionState>;
  readonly rationale: ReadonlyArray<string>;
}

export interface StewardshipConcentration {
  readonly hhi: HHIResult;
  readonly gini: GiniResult;
  /** Calm narrative — NEVER a rank, NEVER a probability. */
  readonly narrative: string;
}
