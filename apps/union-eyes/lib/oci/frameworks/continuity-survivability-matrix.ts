/**
 * ARTIFACT TYPE: IP / Framework
 * FRAMEWORK: Continuity Survivability Matrix™
 * DOCTRINE_VERSION: 1.0.0
 *
 * Plots institutional dependencies against successor identification to
 * surface survivability gaps. The matrix is the IP shape consumed by the
 * Facilitated Edition Continuity Breakpoints module.
 *
 * Self-Guided Edition exposes a single derived classification (the
 * survivability cell of the most exposed carrier). Full plot lands in the
 * Facilitated Edition.
 *
 * Hardening invariants:
 *   1. SURVIVABILITY_MATRIX is deeply frozen.
 *   2. Matrix contains exactly one cell per (dependency, successor) permutation.
 *   3. classifySurvivability falls back to the worst-case cell (singular_absent)
 *      for unknown enum inputs — fail-loud-in-meaning, not fail-silent-cheerful.
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

const DEPENDENCIES: readonly DependencyConcentration[] = Object.freeze([
  'distributed',
  'concentrated',
  'singular',
]);
const SUCCESSORS: readonly SuccessorReadiness[] = Object.freeze([
  'identified',
  'in_progress',
  'absent',
]);

const cell = (
  dependency: DependencyConcentration,
  successor: SuccessorReadiness,
  label: string,
  posture: string,
): SurvivabilityCell =>
  Object.freeze({
    id: `${dependency}_${successor}`,
    dependency,
    successor,
    label,
    posture,
  });

export const SURVIVABILITY_MATRIX: readonly SurvivabilityCell[] = Object.freeze([
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
]);

/**
 * The worst-case cell, used as the fallback for unknown enum inputs.
 *
 * Rationale: when a caller supplies a permutation the matrix does not
 * recognise, we must NOT cheerfully return "distributed_identified" — that
 * would communicate a healthy posture for what is in fact an unmodelled
 * configuration. Returning the worst-case cell makes the misclassification
 * loud in meaning (operators will investigate).
 */
const WORST_CASE_CELL = SURVIVABILITY_MATRIX[0];

function isKnownDependency(d: unknown): d is DependencyConcentration {
  return typeof d === 'string' && (DEPENDENCIES as readonly string[]).includes(d);
}

function isKnownSuccessor(s: unknown): s is SuccessorReadiness {
  return typeof s === 'string' && (SUCCESSORS as readonly string[]).includes(s);
}

export function classifySurvivability(
  dependency: DependencyConcentration,
  successor: SuccessorReadiness,
): SurvivabilityCell {
  if (!isKnownDependency(dependency) || !isKnownSuccessor(successor)) {
    return WORST_CASE_CELL;
  }
  const found = SURVIVABILITY_MATRIX.find(
    (c) => c.dependency === dependency && c.successor === successor,
  );
  return found ?? WORST_CASE_CELL;
}
