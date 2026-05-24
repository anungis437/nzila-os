/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Continuity Survivability Matrix\u2122
 * DOCTRINE_VERSION: 1.0.0
 *
 * Plots institutional dependencies against successor identification to
 * surface survivability gaps. The matrix is the IP shape consumed by the
 * Facilitated Edition Continuity Breakpoints module.
 *
 * Self-Guided Edition exposes a single derived classification (the
 * survivability cell of the most exposed carrier). Full plot lands in the
 * Facilitated Edition.
 */

export type DependencyConcentration = 'distributed' | 'concentrated' | 'singular';
export type SuccessorReadiness = 'identified' | 'in_progress' | 'absent';

export interface SurvivabilityCell {
  id: string;
  dependency: DependencyConcentration;
  successor: SuccessorReadiness;
  label: string;
  posture: string;
}

const cell = (
  dependency: DependencyConcentration,
  successor: SuccessorReadiness,
  label: string,
  posture: string,
): SurvivabilityCell => ({
  id: `${dependency}_${successor}`,
  dependency,
  successor,
  label,
  posture,
});

export const SURVIVABILITY_MATRIX: readonly SurvivabilityCell[] = [
  cell(
    'singular',
    'absent',
    'Continuity break imminent on transition',
    'A single carrier holds an institution-critical responsibility with no identified successor. This configuration produces a continuity break on the next transition.',
  ),
  cell(
    'singular',
    'in_progress',
    'Stabilizing — succession underway',
    'A single carrier remains, but succession work is underway. Completing identification and shadowing reduces breakage risk.',
  ),
  cell(
    'singular',
    'identified',
    'Stabilized — succession identified',
    'A single carrier remains, but a successor is identified. Document the operational lineage before the transition.',
  ),
  cell(
    'concentrated',
    'absent',
    'Fragile concentration',
    'Responsibility is held by a small group with no identified successors. Broaden stewardship before the next transition.',
  ),
  cell(
    'concentrated',
    'in_progress',
    'Concentration improving',
    'A small group holds responsibility and succession work is underway. Continue broadening stewardship.',
  ),
  cell(
    'concentrated',
    'identified',
    'Concentrated but covered',
    'A small group holds responsibility with identified successors. Maintain shadowing and lineage capture.',
  ),
  cell(
    'distributed',
    'absent',
    'Distributed without lineage',
    'Responsibility is distributed but no successors are formally identified. Lineage capture is the next step.',
  ),
  cell(
    'distributed',
    'in_progress',
    'Distributed and stabilizing',
    'Responsibility is distributed and succession identification is underway. This is a healthy posture.',
  ),
  cell(
    'distributed',
    'identified',
    'Distributed and covered',
    'Responsibility is distributed with identified successors. Periodic review is sufficient.',
  ),
] as const;

export function classifySurvivability(
  dependency: DependencyConcentration,
  successor: SuccessorReadiness,
): SurvivabilityCell {
  const found = SURVIVABILITY_MATRIX.find(
    (c) => c.dependency === dependency && c.successor === successor,
  );
  return found ?? SURVIVABILITY_MATRIX[SURVIVABILITY_MATRIX.length - 1];
}
