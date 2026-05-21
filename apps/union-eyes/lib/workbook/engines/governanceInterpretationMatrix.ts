/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Governance Lineage
 * DOCTRINE_VERSION: 2.0.0
 *
 * Governance Interpretation Matrix™ — plots the alignment between how
 * governance was designed and how it is currently interpreted in
 * practice, across the workbook's named governance domains.
 *
 * Pure, deterministic. Anti-surveillance: domains are abstracted (no
 * verbatim policy text, no named interpreters).
 */

export type InterpretationAlignment =
  | 'aligned'
  | 'drift'
  | 'divergent'
  | 'contradictory';

export interface GovernanceDomainInput {
  /** Abstract domain id e.g. "compensation_governance". */
  readonly id: string;
  /** Domain label e.g. "Compensation governance". */
  readonly label: string;
  /** True if a written governance design exists. */
  readonly hasWrittenDesign: boolean;
  /** True if practice is consistently observed across bodies. */
  readonly practiceObservedConsistently: boolean;
  /** Scalar 0–1: extent to which practice diverges from design. */
  readonly designPracticeDrift: number;
}

export interface InterpretationCell {
  readonly id: string;
  readonly label: string;
  readonly alignment: InterpretationAlignment;
  readonly drift: number;
  readonly posture: string;
}

const ALIGNMENT_POSTURE: Record<InterpretationAlignment, string> = {
  aligned: 'Governance design and governance practice are in close alignment.',
  drift: 'Governance practice shows recognisable drift from governance design.',
  divergent:
    'Governance practice diverges substantially from governance design across the domain.',
  contradictory:
    'Governance practice and governance design no longer reliably trace to one another. Reconstruction would require external interpretation.',
};

export function buildInterpretationMatrix(
  domains: readonly GovernanceDomainInput[],
): readonly InterpretationCell[] {
  return domains.map((d) => {
    const alignment = classifyAlignment(d);
    return {
      id: d.id,
      label: d.label,
      alignment,
      drift: clamp01(round2(d.designPracticeDrift)),
      posture: ALIGNMENT_POSTURE[alignment],
    };
  });
}

function classifyAlignment(d: GovernanceDomainInput): InterpretationAlignment {
  if (!d.hasWrittenDesign && d.designPracticeDrift >= 0.4) return 'contradictory';
  if (d.designPracticeDrift >= 0.7) return 'contradictory';
  if (d.designPracticeDrift >= 0.5) return 'divergent';
  if (d.designPracticeDrift >= 0.25 || !d.practiceObservedConsistently) return 'drift';
  return 'aligned';
}

export function aggregateInterpretationDrift(
  cells: readonly InterpretationCell[],
): number {
  if (cells.length === 0) return 0;
  const sum = cells.reduce((a, c) => a + c.drift, 0);
  return round2(sum / cells.length);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
