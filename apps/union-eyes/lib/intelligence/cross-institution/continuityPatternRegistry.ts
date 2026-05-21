/**
 * ARTIFACT TYPE: Continuity Pattern Registry
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity pattern registry.
 *
 * Reviewer-curated catalogue of anonymised continuity archetypes the network
 * recognises. Patterns are descriptive; they never carry a "good" or "bad"
 * connotation and never reference individual institutions.
 *
 * Pattern membership is intentionally coarse so the registry cannot be used
 * to fingerprint a specific institution.
 */

export const CONTINUITY_PATTERN_REGISTRY_VERSION = '1.0.0' as const;

export const CONTINUITY_PATTERN_KINDS = [
  'cohesive_holding_archetype',
  'governance_recovery_archetype',
  'stewardship_redistribution_archetype',
  'onboarding_strengthening_archetype',
  'continuity_debt_reduction_archetype',
  'continuity_fragmentation_archetype',
] as const;

export type ContinuityPatternKind = (typeof CONTINUITY_PATTERN_KINDS)[number];

export interface ContinuityPattern {
  readonly kind: ContinuityPatternKind;
  readonly description: string;
}

const PATTERNS: Readonly<Record<ContinuityPatternKind, ContinuityPattern>> = Object.freeze({
  cohesive_holding_archetype: {
    kind: 'cohesive_holding_archetype',
    description:
      'Continuity holds across the readable window; governance, stewardship, and onboarding readings move together.',
  },
  governance_recovery_archetype: {
    kind: 'governance_recovery_archetype',
    description:
      'Governance entropy was regressing earlier in the window and is now stabilizing; recovery is reviewer-readable.',
  },
  stewardship_redistribution_archetype: {
    kind: 'stewardship_redistribution_archetype',
    description:
      'Stewardship has moved outward across the window and the redistribution has held without reconcentration.',
  },
  onboarding_strengthening_archetype: {
    kind: 'onboarding_strengthening_archetype',
    description:
      'Onboarding survivability has moved from weakening or holding into strengthening across the window.',
  },
  continuity_debt_reduction_archetype: {
    kind: 'continuity_debt_reduction_archetype',
    description:
      'Continuity debt has been reducing across the window; the institution has been actively repaying continuity.',
  },
  continuity_fragmentation_archetype: {
    kind: 'continuity_fragmentation_archetype',
    description:
      'The window shows meaningful continuity regression; the reading warrants reviewer-led stabilisation, not algorithmic remediation.',
  },
});

export function getContinuityPattern(kind: ContinuityPatternKind): ContinuityPattern {
  return PATTERNS[kind];
}

export function listContinuityPatterns(): ReadonlyArray<ContinuityPattern> {
  return Object.values(PATTERNS).sort((a, b) => a.kind.localeCompare(b.kind));
}
