/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Governance Entropy Scale™
 * DOCTRINE_VERSION: 1.0.0
 *
 * A five-point scale measuring drift between governance design and
 * governance practice. The scale is the classification spine consumed by
 * the Workbook Governance Lineage module and the PDF executive narrative.
 *
 * Pure, deterministic. Typed scaffold for the Facilitated Edition engine.
 *
 * Hardening invariants:
 *   1. ENTROPY_LEVELS is deeply frozen.
 *   2. classifyEntropy clamps any numeric input to [0,1] and tolerates NaN.
 *   3. Levels are ordered with strictly descending lowerBounds.
 */

export type EntropyLevelId =
  | 'coherent'
  | 'recognised_drift'
  | 'patterned_drift'
  | 'institutional_drift'
  | 'systemic_entropy';

export interface EntropyLevel {
  id: EntropyLevelId;
  ordinal: 1 | 2 | 3 | 4 | 5;
  label: string;
  posture: string;
  lowerBound: number;
}

export const ENTROPY_LEVELS: readonly EntropyLevel[] = Object.freeze([
  Object.freeze({
    id: 'systemic_entropy' as const,
    ordinal: 5 as const,
    label: 'Systemic entropy',
    posture:
      'Governance practice no longer reliably traces back to governance design. Reconstruction is necessary.',
    lowerBound: 0.8,
  }),
  Object.freeze({
    id: 'institutional_drift' as const,
    ordinal: 4 as const,
    label: 'Institutional drift',
    posture:
      'Multiple domains show patterned divergence from designed governance. Stabilization is appropriate.',
    lowerBound: 0.6,
  }),
  Object.freeze({
    id: 'patterned_drift' as const,
    ordinal: 3 as const,
    label: 'Patterned drift',
    posture:
      'Recurring divergence in identifiable domains. Recognition is the prerequisite for stabilization.',
    lowerBound: 0.4,
  }),
  Object.freeze({
    id: 'recognised_drift' as const,
    ordinal: 2 as const,
    label: 'Recognised drift',
    posture:
      'Drift is named and known to institutional stewards. Continuity is intact but vigilance is warranted.',
    lowerBound: 0.2,
  }),
  Object.freeze({
    id: 'coherent' as const,
    ordinal: 1 as const,
    label: 'Coherent governance',
    posture:
      'Governance practice and governance design are in close alignment. Periodic review is sufficient.',
    lowerBound: 0,
  }),
]);

/**
 * @param drift A scalar 0–1. Higher values indicate greater divergence.
 *              Non-finite inputs are treated as 0 (coherent).
 */
export function classifyEntropy(drift: number): EntropyLevel {
  const safe = typeof drift === 'number' && Number.isFinite(drift) ? clamp01(drift) : 0;
  for (const level of ENTROPY_LEVELS) {
    if (safe >= level.lowerBound) return level;
  }
  return ENTROPY_LEVELS[ENTROPY_LEVELS.length - 1];
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
