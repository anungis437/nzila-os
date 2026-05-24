/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Governance Entropy Scale\u2122
 * DOCTRINE_VERSION: 1.0.0
 *
 * A five-point scale measuring drift between governance design and
 * governance practice. The scale is the classification spine consumed by
 * the Workbook Governance Lineage module and the PDF executive narrative.
 *
 * Pure, deterministic. Typed scaffold for the Facilitated Edition engine.
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

export const ENTROPY_LEVELS: readonly EntropyLevel[] = [
  {
    id: 'systemic_entropy',
    ordinal: 5,
    label: 'Systemic entropy',
    posture:
      'Governance practice no longer reliably traces back to governance design. Reconstruction is necessary.',
    lowerBound: 0.8,
  },
  {
    id: 'institutional_drift',
    ordinal: 4,
    label: 'Institutional drift',
    posture:
      'Multiple domains show patterned divergence from designed governance. Stabilization is appropriate.',
    lowerBound: 0.6,
  },
  {
    id: 'patterned_drift',
    ordinal: 3,
    label: 'Patterned drift',
    posture:
      'Recurring divergence in identifiable domains. Recognition is the prerequisite for stabilization.',
    lowerBound: 0.4,
  },
  {
    id: 'recognised_drift',
    ordinal: 2,
    label: 'Recognised drift',
    posture:
      'Drift is named and known to institutional stewards. Continuity is intact but vigilance is warranted.',
    lowerBound: 0.2,
  },
  {
    id: 'coherent',
    ordinal: 1,
    label: 'Coherent governance',
    posture:
      'Governance practice and governance design are in close alignment. Periodic review is sufficient.',
    lowerBound: 0,
  },
] as const;

/**
 * @param drift A scalar 0\u20131. Higher values indicate greater divergence.
 */
export function classifyEntropy(drift: number): EntropyLevel {
  const clamped = Math.max(0, Math.min(1, drift));
  for (const level of ENTROPY_LEVELS) {
    if (clamped >= level.lowerBound) return level;
  }
  return ENTROPY_LEVELS[ENTROPY_LEVELS.length - 1];
}
