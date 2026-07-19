/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Obligation Taxonomy
 * MODULE: OCI/OCRA Obligation Taxonomy (reference data)
 * DOCTRINE: docs/oci/government-readiness/OCI_OCRA_OBLIGATION_TAXONOMY.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Canonical, deterministic reference data for the seven obligation classes.
 *
 * CONSTITUTIONAL CONSTRAINT: obligations are reference + reporting context.
 * They are NEVER a score input. Nothing in this module imports the scoring
 * engine, and `reportingPriorityWeight` / `tier` govern report ordering and
 * escalation language ONLY — never any dimension, composite, or maturity band.
 */

import type { EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';

export const OBLIGATION_TAXONOMY_VERSION = '1.0.0';

export type ObligationClassId =
  | 'statutory'
  | 'regulatory'
  | 'policy'
  | 'governance'
  | 'fiduciary'
  | 'continuity'
  | 'operational';

/** Reporting precedence tier. Lower number = higher accountability gravity. */
export type ObligationTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ObligationClass {
  readonly id: ObligationClassId;
  /** Reporting precedence ONLY. Never a numeric score weight. */
  readonly tier: ObligationTier;
  /** Minimum evidence level before a finding may assert this class. */
  readonly evidenceFloor: EvidenceLevel;
  /** Report-ordering hint ONLY. Explicitly not a score weight. */
  readonly reportingPriorityWeight: number;
  readonly label: string;
  readonly definition: string;
}

/**
 * The seven canonical obligation classes, tier-ordered.
 * Tier governs reporting precedence and escalation language, never numerics.
 */
export const OBLIGATION_CLASSES: Record<ObligationClassId, ObligationClass> = Object.freeze({
  statutory: {
    id: 'statutory',
    tier: 1,
    evidenceFloor: 'DOCUMENTED',
    reportingPriorityWeight: 7,
    label: 'Statutory',
    definition: 'Duties imposed by primary legislation (acts, enabling statutes).',
  },
  regulatory: {
    id: 'regulatory',
    tier: 2,
    evidenceFloor: 'DOCUMENTED',
    reportingPriorityWeight: 6,
    label: 'Regulatory',
    definition: 'Duties imposed by delegated regulation or a regulator.',
  },
  fiduciary: {
    id: 'fiduciary',
    tier: 3,
    evidenceFloor: 'DOCUMENTED',
    reportingPriorityWeight: 5,
    label: 'Fiduciary',
    definition: 'Duties of loyalty, prudence, and care owed to the institution and public.',
  },
  governance: {
    id: 'governance',
    tier: 4,
    evidenceFloor: 'DOCUMENTED',
    reportingPriorityWeight: 4,
    label: 'Governance',
    definition: 'Duties arising from the governance framework (bylaws, delegation, oversight).',
  },
  policy: {
    id: 'policy',
    tier: 5,
    evidenceFloor: 'VERBAL',
    reportingPriorityWeight: 3,
    label: 'Policy',
    definition: 'Duties imposed by government or organizational policy.',
  },
  continuity: {
    id: 'continuity',
    tier: 6,
    evidenceFloor: 'VERBAL',
    reportingPriorityWeight: 2,
    label: 'Continuity',
    definition: 'Duties to preserve institutional function across disruption and transition.',
  },
  operational: {
    id: 'operational',
    tier: 7,
    evidenceFloor: 'VERBAL',
    reportingPriorityWeight: 1,
    label: 'Operational',
    definition: 'Duties to maintain day-to-day operational integrity.',
  },
});

export const OBLIGATION_CLASS_IDS: readonly ObligationClassId[] = Object.freeze([
  'statutory',
  'regulatory',
  'fiduciary',
  'governance',
  'policy',
  'continuity',
  'operational',
]);

/** Order a set of obligation classes by reporting precedence (highest tier first). */
export function leadObligation(
  classes: readonly ObligationClassId[],
): ObligationClassId | null {
  if (classes.length === 0) return null;
  return [...classes].sort(
    (a, b) => OBLIGATION_CLASSES[a].tier - OBLIGATION_CLASSES[b].tier,
  )[0];
}
