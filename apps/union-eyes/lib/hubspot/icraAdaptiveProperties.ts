/**
 * ICRA → HubSpot adaptive property mapper.
 *
 * Pure deterministic helper that derives a low-cardinality set of HubSpot
 * contact/company properties from an OCRA `InstitutionalAssessmentProfile`
 * + `RoutedQuestionBank`. Designed to be composed alongside
 * `icraPropertyMapper.ts` at the HubSpot sync call site.
 *
 * Anti-surveillance posture:
 * - NEVER maps org name, free-text fields, raw answers, rationale text,
 *   deferred question IDs, or anything respondent-supplied beyond the
 *   declared form selections.
 * - All values are low-cardinality enums or non-negative integers.
 * - Property keys are stable and prefixed `ocra_`; HubSpot custom-property
 *   creation is a one-time setup task on the CRM side.
 */

import type {
  InstitutionalAssessmentProfile,
  RoutedQuestionBank,
} from '@/lib/icra/adaptation';

// ─────────────────────────────────────────────────────────────────────────────
// HubSpot custom property keys (low-cardinality, audit-safe)
// ─────────────────────────────────────────────────────────────────────────────

export const OCRA_ADAPTIVE_CONTACT_PROPERTIES = {
  institutionalScale: 'ocra_institutional_scale',
  continuityComplexity: 'ocra_continuity_complexity',
  governanceComplexity: 'ocra_governance_complexity',
  continuityExposure: 'ocra_continuity_exposure',
  respondentLens: 'ocra_respondent_lens',
  routingEngineVersion: 'ocra_routing_engine_version',
  routedQuestionCount: 'ocra_routed_question_count',
  deferredQuestionCount: 'ocra_deferred_question_count',
  safeDefaultUsed: 'ocra_safe_default_used',
} as const;

/**
 * Exhaustive whitelist of property keys this helper is permitted to emit.
 * The privacy test pins this list. Adding a key here requires:
 *
 *   - A CRM-side property creation
 *   - An updated privacy regression test
 *   - A security review note explaining the cardinality bound
 */
export const OCRA_ADAPTIVE_PROPERTY_KEYS_ALLOWLIST: readonly string[] =
  Object.values(OCRA_ADAPTIVE_CONTACT_PROPERTIES);

export type OcraAdaptiveContactProperties = Readonly<
  Partial<Record<string, string | number | boolean>>
>;

/**
 * Derive HubSpot contact properties from an OCRA adaptive context.
 *
 * Returned values are typed loosely (string | number | boolean) to mirror
 * the HubSpot SDK's accepted property value shape. Every value is bounded:
 *
 *   - Enum bands → 1 of 5-6 known strings
 *   - Counts → small non-negative integers
 *   - Booleans → true/false
 *
 * NO free text. NO org names. NO emails. NO IDs of individual questions.
 */
export function deriveOcraAdaptiveContactProperties(
  profile: InstitutionalAssessmentProfile,
  bank: RoutedQuestionBank,
): OcraAdaptiveContactProperties {
  return {
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.institutionalScale]:
      profile.institutionalScale,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.continuityComplexity]:
      profile.continuityComplexity,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.governanceComplexity]:
      profile.governanceComplexity,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.continuityExposure]:
      profile.continuityExposure,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.respondentLens]: profile.respondentLens,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.routingEngineVersion]: bank.routeVersion,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.routedQuestionCount]:
      bank.includedQuestions.length,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.deferredQuestionCount]:
      bank.deferredQuestions.length,
    [OCRA_ADAPTIVE_CONTACT_PROPERTIES.safeDefaultUsed]: bank.usedSafeDefault,
  };
}
