/**
 * ARTIFACT TYPE: Adaptive Telemetry Helper (pure surface, side effects via fireAndForgetEvent)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §8 (privacy invariants)
 *
 * Thin helpers the live flow can call to emit the three OCRA adaptation
 * telemetry events:
 *
 *   - adaptive_profile_created  (after orgContextClassifier produces a profile)
 *   - assessment_routed         (after questionRoutingEngine produces a bank)
 *   - adaptive_question_deferred (per-question, batched is fine)
 *
 * Privacy contract:
 *  - Metadata values are ALWAYS low-cardinality enum tokens, severity
 *    buckets, rule ids, or small integer counts.
 *  - NEVER includes question text, respondent text, assessment ids, or
 *    identifiers of any kind.
 *  - All values are length-capped by the route layer (MAX_METADATA_VALUE_LEN
 *    = 64) — keep keys and string values short.
 */

import { fireAndForgetEvent } from '@/lib/icra/observability';

import type { RoutedQuestionBank, RoutingRationale } from './routingTypes';
import type { InstitutionalAssessmentProfile } from './types';

/**
 * Emit `adaptive_profile_created` immediately after `classifyOrgContext`
 * returns. Carries only enum tokens — no PII.
 */
export function emitAdaptiveProfileCreated(
  profile: InstitutionalAssessmentProfile,
): void {
  fireAndForgetEvent({
    kind: 'adaptive_profile_created',
    metadata: {
      doctrineVersion: profile.doctrineVersion,
      scale: profile.institutionalScale,
      continuity: profile.continuityComplexity,
      governance: profile.governanceComplexity,
      exposure: profile.continuityExposure,
      lens: profile.respondentLens,
      safeDefault: profile.usedConservativeDefault,
    },
  });
}

/**
 * Emit `assessment_routed` immediately after `routeQuestionBank` returns.
 * Carries only counts + fallback flag, never a per-assessment selection fingerprint.
 */
export function emitAssessmentRouted(routed: RoutedQuestionBank): void {
  fireAndForgetEvent({
    kind: 'assessment_routed',
    metadata: {
      doctrineVersion: routed.doctrineVersion,
      routeVersion: routed.routeVersion,
      included: routed.includedQuestions.length,
      deferred: routed.deferredQuestions.length,
      required: routed.requiredQuestions.length,
      optional: routed.optionalContextQuestions.length,
      safeDefault: routed.usedSafeDefault,
    },
  });
}

/**
 * Emit one `adaptive_question_deferred` per deferred question. Pass the
 * deferral rationale entries from `routed.routingRationale` filtered to
 * `decision.startsWith('defer_')`.
 *
 * Each emission carries the generic rule and decision, never the per-question id.
 */
export function emitAdaptiveQuestionDeferred(rationale: RoutingRationale): void {
  if (!rationale.decision.startsWith('defer_')) return;
  fireAndForgetEvent({
    kind: 'adaptive_question_deferred',
    metadata: {
      decision: rationale.decision,
      ruleId: rationale.ruleId.slice(0, 60),
    },
  });
}

/**
 * Convenience batch emitter — iterates `routed.routingRationale` and emits
 * one `adaptive_question_deferred` per `defer_*` entry. The caller decides
 * whether to batch or skip emission (e.g. to respect telemetry budgets).
 */
export function emitDeferredQuestionsForRoutedBank(
  routed: RoutedQuestionBank,
): void {
  for (const r of routed.routingRationale) {
    if (r.decision.startsWith('defer_')) {
      emitAdaptiveQuestionDeferred(r);
    }
  }
}
