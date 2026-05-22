/**
 * ARTIFACT TYPE: Eligibility Predicates (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §5, §7
 *
 * Decides, for one (question, profile) pair, whether the question should be:
 *   - included as core / required / recommended / contextual, or
 *   - deferred (suppression / out-of-scope / complexity-floor / -ceiling).
 *
 * Never reads question content (prompt text), respondent identity, or any
 * input beyond the structured profile + structured adaptive rules.
 */

import {
  complexityAtLeast,
  complexityAtMost,
} from './orgComplexityModel';
import {
  getProfileFieldValue,
  type ProfileFieldName,
} from './institutionalProfileLens';
import type { RoutableQuestion } from './routingTypes';
import type {
  AdaptiveRules,
  InstitutionalAssessmentProfile,
  InstitutionalProfileField,
} from './types';

export type EligibilityDecision =
  | { kind: 'include'; band: 'core' | 'required' | 'recommended' | 'contextual'; ruleId: string; statement: string }
  | { kind: 'defer'; reason: 'suppressed' | 'out_of_scope' | 'complexity_floor' | 'complexity_ceiling'; ruleId: string; statement: string };

function matchesField(
  profile: InstitutionalAssessmentProfile,
  spec: InstitutionalProfileField,
): boolean {
  return getProfileFieldValue(profile, spec.field as ProfileFieldName) === spec.value;
}

function anyMatch(
  profile: InstitutionalAssessmentProfile,
  specs: readonly InstitutionalProfileField[] | undefined,
): boolean {
  if (!specs || specs.length === 0) return false;
  return specs.some((s) => matchesField(profile, s));
}

/**
 * Resolve eligibility for a single question against a profile. Implements
 * the precedence in §5 of the doctrine:
 *
 *   1. No adaptive metadata          → include as core.
 *   2. `weight: 'core'`              → include as core (rules cannot suppress core).
 *   3. `suppressedFor` matches       → defer (suppression always wins for non-core).
 *   4. complexity floor not met      → defer.
 *   5. complexity ceiling exceeded   → defer.
 *   6. `requiredFor` matches         → include as required.
 *   7. `recommendedFor` matches      → include as recommended.
 *   8. sector / size / governance / respondent relevance constraints
 *      → if at least one constraint is declared and NONE match, defer
 *        as out_of_scope; otherwise include as contextual.
 *   9. no constraints at all         → include as contextual.
 */
export function decideEligibility(
  question: RoutableQuestion,
  profile: InstitutionalAssessmentProfile,
): EligibilityDecision {
  const meta = question.adaptive;
  if (!meta) {
    return {
      kind: 'include',
      band: 'core',
      ruleId: 'eligibility.no_metadata_defaults_core',
      statement: 'Question carries no adaptive metadata; treated as core and always included.',
    };
  }

  if (meta.weight === 'core') {
    return {
      kind: 'include',
      band: 'core',
      ruleId: 'eligibility.weight_core',
      statement: 'Question is declared core; included for every institutional profile.',
    };
  }

  return decideForNonCore(question, profile, meta.rules);
}

function decideForNonCore(
  question: RoutableQuestion,
  profile: InstitutionalAssessmentProfile,
  rules: AdaptiveRules | undefined,
): EligibilityDecision {
  if (!rules) {
    return {
      kind: 'include',
      band: 'contextual',
      ruleId: 'eligibility.no_rules_contextual',
      statement: 'Non-core question with no adaptive rules; included as contextual.',
    };
  }

  // 3. Suppression always wins.
  if (anyMatch(profile, rules.suppressedFor)) {
    return {
      kind: 'defer',
      reason: 'suppressed',
      ruleId: 'eligibility.suppressed_for_profile_field',
      statement: 'Question is explicitly suppressed for one or more active profile fields.',
    };
  }

  // 4. Complexity floor.
  if (rules.minOrgComplexity && !complexityAtLeast(profile.continuityComplexity, rules.minOrgComplexity)) {
    return {
      kind: 'defer',
      reason: 'complexity_floor',
      ruleId: 'eligibility.below_min_complexity',
      statement: `Question requires continuity complexity ≥ ${rules.minOrgComplexity}; profile is ${profile.continuityComplexity}.`,
    };
  }

  // 5. Complexity ceiling.
  if (rules.maxOrgComplexity && !complexityAtMost(profile.continuityComplexity, rules.maxOrgComplexity)) {
    return {
      kind: 'defer',
      reason: 'complexity_ceiling',
      ruleId: 'eligibility.above_max_complexity',
      statement: `Question is scoped to continuity complexity ≤ ${rules.maxOrgComplexity}; profile is ${profile.continuityComplexity}.`,
    };
  }

  // 6. Required.
  if (anyMatch(profile, rules.requiredFor)) {
    return {
      kind: 'include',
      band: 'required',
      ruleId: 'eligibility.required_for_profile_field',
      statement: 'Question is required for one or more active profile fields.',
    };
  }

  // 7. Recommended.
  if (anyMatch(profile, rules.recommendedFor)) {
    return {
      kind: 'include',
      band: 'recommended',
      ruleId: 'eligibility.recommended_for_profile_field',
      statement: 'Question is recommended for one or more active profile fields.',
    };
  }

  // 8/9. Relevance constraints: if any declared and none match → defer.
  const relevanceDeclared =
    (rules.sectorRelevance?.length ?? 0) > 0 ||
    (rules.sizeRelevance?.length ?? 0) > 0 ||
    (rules.governanceRelevance?.length ?? 0) > 0 ||
    (rules.respondentRelevance?.length ?? 0) > 0;

  if (!relevanceDeclared) {
    return {
      kind: 'include',
      band: 'contextual',
      ruleId: 'eligibility.no_relevance_constraints',
      statement: 'Non-core question with no relevance constraints; included as contextual.',
    };
  }

  const sectorMatches = rules.sectorRelevance
    ? profile.declaredInputs.sector !== undefined &&
      rules.sectorRelevance.includes(profile.declaredInputs.sector)
    : false;
  const sizeMatches = rules.sizeRelevance
    ? profile.declaredInputs.workforceBand !== undefined &&
      rules.sizeRelevance.includes(profile.declaredInputs.workforceBand)
    : false;
  const governanceMatches = rules.governanceRelevance
    ? profile.declaredInputs.governanceModel !== undefined &&
      rules.governanceRelevance.includes(profile.declaredInputs.governanceModel)
    : false;
  const respondentMatches = rules.respondentRelevance
    ? rules.respondentRelevance.includes(profile.respondentLens)
    : false;

  if (sectorMatches || sizeMatches || governanceMatches || respondentMatches) {
    return {
      kind: 'include',
      band: 'contextual',
      ruleId: 'eligibility.relevance_constraints_met',
      statement: 'At least one declared relevance constraint matches the active profile.',
    };
  }

  const _ = question; // referenced for future symmetry; keeps signature stable
  void _;

  return {
    kind: 'defer',
    reason: 'out_of_scope',
    ruleId: 'eligibility.relevance_constraints_unmet',
    statement: 'Question declared relevance constraints; none match the active profile.',
  };
}
