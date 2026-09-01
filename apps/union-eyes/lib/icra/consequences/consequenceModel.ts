/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Consequence Model
 * MODULE: OCI/OCRA Finding → Consequence mapping (deterministic, confidence-gated)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_CONSEQUENCE_MODEL.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pure, deterministic mapping from a finding theme + confidence band to the
 * institutional consequences at stake.
 *
 * CONSTITUTIONAL CONSTRAINTS:
 *   - Consequences are reference mappings + reporting framing. NEVER a score input.
 *   - Severity is confidence-gated: catastrophe is never asserted on thin evidence.
 *   - This module MUST NOT import the scoring engine.
 */

import type { ConfidenceState } from '@nzila/oci-confidence';

export const CONSEQUENCE_MODEL_VERSION = '1.0.0';

export type ConsequenceClassId =
  | 'institutional'
  | 'governance'
  | 'operational'
  | 'service_delivery'
  | 'public_trust'
  | 'financial_risk';

export type ConsequenceSeverity = 'negligible' | 'moderate' | 'serious' | 'severe';

/** Whether the consequence may be stated as fact, as potential, or not at all. */
export type ConsequenceAssertion = 'asserted' | 'potential' | 'not_asserted';

export interface ConsequenceMappingRule {
  readonly findingTheme: string;
  readonly classes: readonly ConsequenceClassId[];
  readonly realizationTrigger: string;
  readonly baseSeverity: ConsequenceSeverity;
}

export interface MappedConsequence {
  readonly classes: readonly ConsequenceClassId[];
  readonly severity: ConsequenceSeverity;
  readonly assertion: ConsequenceAssertion;
  readonly realizationTrigger: string;
}

export const CONSEQUENCE_MAPPING_RULES: Record<string, ConsequenceMappingRule> = Object.freeze({
  undocumented_succession_authority: {
    findingTheme: 'undocumented_succession_authority',
    classes: ['institutional', 'service_delivery', 'governance'],
    realizationTrigger: 'unplanned_departure',
    baseSeverity: 'serious',
  },
  records_retention_gap: {
    findingTheme: 'records_retention_gap',
    classes: ['governance', 'public_trust', 'financial_risk'],
    realizationTrigger: 'audit_or_litigation',
    baseSeverity: 'serious',
  },
  missing_delegation_instrument: {
    findingTheme: 'missing_delegation_instrument',
    classes: ['governance', 'institutional'],
    realizationTrigger: 'leadership_transition',
    baseSeverity: 'moderate',
  },
  single_point_operational_dependency: {
    findingTheme: 'single_point_operational_dependency',
    classes: ['operational', 'service_delivery'],
    realizationTrigger: 'absence_or_system_failure',
    baseSeverity: 'serious',
  },
  no_continuity_plan: {
    findingTheme: 'no_continuity_plan',
    classes: ['institutional', 'service_delivery', 'public_trust'],
    realizationTrigger: 'disruption_or_disaster',
    baseSeverity: 'severe',
  },
  board_oversight_gap: {
    findingTheme: 'board_oversight_gap',
    classes: ['governance', 'public_trust'],
    realizationTrigger: 'audit_or_scandal',
    baseSeverity: 'serious',
  },
  ungoverned_automation: {
    findingTheme: 'ungoverned_automation',
    classes: ['governance', 'public_trust', 'financial_risk'],
    realizationTrigger: 'automated_error_at_scale',
    baseSeverity: 'serious',
  },
  institutional_memory_concentration: {
    findingTheme: 'institutional_memory_concentration',
    classes: ['operational', 'institutional'],
    realizationTrigger: 'departure_or_illness',
    baseSeverity: 'serious',
  },
});

/** Map a confidence band to how strongly a consequence may be stated. */
function assertionFor(confidence: ConfidenceState): ConsequenceAssertion {
  switch (confidence) {
    case 'HIGH':
    case 'MODERATE':
      return 'asserted';
    case 'LOW':
      return 'potential';
    case 'INSUFFICIENT':
      return 'not_asserted';
  }
}

/**
 * When confidence is low, even a severe base consequence is downgraded in how it
 * is stated (not in the underlying institutional reality). This keeps the model
 * from over-claiming catastrophe on thin evidence.
 */
function gatedSeverity(
  base: ConsequenceSeverity,
  assertion: ConsequenceAssertion,
): ConsequenceSeverity {
  if (assertion === 'asserted') return base;
  if (assertion === 'potential') {
    // Stated as a potential exposure; never escalate, may soften severe→serious.
    return base === 'severe' ? 'serious' : base;
  }
  // not_asserted: severity is moot — the consequence is not claimed.
  return 'negligible';
}

/**
 * Map a finding theme + the finding's confidence band to its consequence.
 * Deterministic and pure. Confidence gates the assertion and severity framing.
 */
export function mapFindingToConsequence(
  theme: string,
  confidence: ConfidenceState,
): MappedConsequence {
  const rule = CONSEQUENCE_MAPPING_RULES[theme];
  const assertion = assertionFor(confidence);

  if (!rule) {
    return Object.freeze({
      classes: Object.freeze([]),
      severity: 'negligible',
      assertion: 'not_asserted',
      realizationTrigger: 'unknown',
    });
  }

  return Object.freeze({
    classes: rule.classes,
    severity: gatedSeverity(rule.baseSeverity, assertion),
    assertion,
    realizationTrigger: rule.realizationTrigger,
  });
}
