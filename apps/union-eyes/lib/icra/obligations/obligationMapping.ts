/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Obligation Mapping
 * MODULE: OCI/OCRA Finding → Obligation mapping (deterministic, table-driven)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_OBLIGATION_TAXONOMY.md §6
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pure, deterministic mapping from a finding theme + evidence level to the
 * admissible obligation classes.
 *
 * CONSTITUTIONAL CONSTRAINT: this module MUST NOT import the scoring engine.
 * Obligation mapping is reporting context only and can never influence a score.
 * (Enforced by obligation-mapping-isolation.test.ts.)
 */

import { isAtLeast, type EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';
import {
  OBLIGATION_CLASSES,
  type ObligationClassId,
} from './obligationTaxonomy';

export interface ObligationMappingRule {
  readonly findingTheme: string;
  /** Candidate classes, highest-tier first. Filtered by evidence floor at map time. */
  readonly defaultClasses: readonly ObligationClassId[];
}

/**
 * Canonical mapping rules. Illustrative but deterministic. Each theme lists the
 * obligation classes it may implicate; the evidence floor on each class gates
 * whether it is admissible for a given finding.
 */
export const OBLIGATION_MAPPING_RULES: Record<string, ObligationMappingRule> = Object.freeze({
  undocumented_succession_authority: {
    findingTheme: 'undocumented_succession_authority',
    defaultClasses: ['fiduciary', 'governance', 'continuity'],
  },
  records_retention_gap: {
    findingTheme: 'records_retention_gap',
    defaultClasses: ['statutory', 'regulatory', 'operational'],
  },
  missing_delegation_instrument: {
    findingTheme: 'missing_delegation_instrument',
    defaultClasses: ['statutory', 'governance'],
  },
  single_point_operational_dependency: {
    findingTheme: 'single_point_operational_dependency',
    defaultClasses: ['continuity', 'operational'],
  },
  no_continuity_plan: {
    findingTheme: 'no_continuity_plan',
    defaultClasses: ['regulatory', 'policy', 'continuity'],
  },
  board_oversight_gap: {
    findingTheme: 'board_oversight_gap',
    defaultClasses: ['fiduciary', 'governance'],
  },
  ungoverned_automation: {
    findingTheme: 'ungoverned_automation',
    defaultClasses: ['regulatory', 'policy', 'governance'],
  },
  institutional_memory_concentration: {
    findingTheme: 'institutional_memory_concentration',
    defaultClasses: ['continuity', 'operational'],
  },
});

/**
 * Map a finding theme + evidence level to the admissible obligation classes.
 *
 * A class is omitted when the finding's evidence level is below that class's
 * `evidenceFloor` — e.g. a statutory obligation is never asserted on VERBAL
 * evidence. Deterministic and pure. Returns classes in highest-tier-first order.
 */
export function mapFindingToObligations(
  theme: string,
  evidenceLevel: EvidenceLevel,
): readonly ObligationClassId[] {
  const rule = OBLIGATION_MAPPING_RULES[theme];
  if (!rule) return Object.freeze([]);

  const admissible = rule.defaultClasses.filter((id) =>
    isAtLeast(evidenceLevel, OBLIGATION_CLASSES[id].evidenceFloor),
  );

  return Object.freeze(
    [...admissible].sort(
      (a, b) => OBLIGATION_CLASSES[a].tier - OBLIGATION_CLASSES[b].tier,
    ),
  );
}
