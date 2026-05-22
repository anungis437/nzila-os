/**
 * ARTIFACT TYPE: Routed Submission Validator
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: docs/oci/assessment/OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §7
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pure helper used by both the live submit flow and the API ingest route to
 * answer two integrity questions about a submission against the routed bank:
 *
 *   1. Are all REQUIRED, INCLUDED questions actually answered?
 *      (no silent drops)
 *
 *   2. Did the submission contain answers for DEFERRED questions?
 *      (no fabricated/synthetic data smuggled in)
 *
 * HARD RULE: the validator NEVER fakes answers for deferred questions and
 * NEVER coerces a missing required answer into a default value. It only
 * reports.
 */

import type { RoutedQuestionBank } from './routingTypes';

export interface RoutedSubmissionValidationResult {
  readonly ok: boolean;
  readonly missingRequiredIds: readonly string[];
  readonly strayDeferredAnswerIds: readonly string[];
}

/**
 * Validate a routed submission.
 *
 * @param routedBank The bank produced by `routeQuestionBank` for the profile.
 * @param answeredIds Iterable of question IDs the respondent actually answered.
 */
export function validateRoutedSubmission(
  routedBank: RoutedQuestionBank,
  answeredIds: Iterable<string>,
): RoutedSubmissionValidationResult {
  const answered = new Set(answeredIds);
  const includedIds = new Set(routedBank.includedQuestions.map((q) => q.id));
  const deferredIds = new Set(routedBank.deferredQuestions.map((q) => q.id));

  const missingRequiredIds: string[] = [];
  for (const q of routedBank.requiredQuestions) {
    if (!includedIds.has(q.id)) continue; // required but routed out → not asked
    if (!answered.has(q.id)) missingRequiredIds.push(q.id);
  }

  const strayDeferredAnswerIds: string[] = [];
  for (const id of answered) {
    if (deferredIds.has(id)) strayDeferredAnswerIds.push(id);
  }

  return {
    ok: missingRequiredIds.length === 0 && strayDeferredAnswerIds.length === 0,
    missingRequiredIds,
    strayDeferredAnswerIds,
  };
}
