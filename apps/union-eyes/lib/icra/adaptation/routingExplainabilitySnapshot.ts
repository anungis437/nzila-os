/**
 * ARTIFACT TYPE: Routing Explainability Snapshot
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: docs/oci/superseded/assessment/OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §6
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pure, audit-safe summary of how a routed question bank was selected for a
 * given organizational profile. Designed to be:
 *
 *   - Server- AND client-safe (no I/O, no PII, no free text)
 *   - Persistable as JSON on the assessment record
 *   - Renderable in the PDF report and the result page
 *   - Tested for stability (deterministic categorization)
 *
 * STRICTLY NEVER includes: raw answers, org name, free-text inputs, user
 * agent, IP, location, fingerprint of any individual respondent.
 */

import type { InstitutionalAssessmentProfile } from './types';
import type { RoutedQuestionBank, RoutingRationale } from './routingTypes';

export interface RoutingExplainabilitySnapshot {
  readonly doctrineVersion: '1.0.0';
  readonly routeVersion: string;
  readonly profileBands: {
    readonly institutionalScale: string;
    readonly continuityComplexity: string;
    readonly governanceComplexity: string;
    readonly continuityExposure: string;
    readonly respondentLens: string;
  };
  readonly includedCount: number;
  readonly deferredCount: number;
  readonly requiredCount: number;
  readonly fallbackUsed: boolean;
  /**
   * True when every core (metadata-less) question is still in the included
   * set — comparability guarantee. Snapshot lookers use this to assert the
   * assessment remains benchmarkable across orgs.
   */
  readonly corePreserved: boolean;
  /**
   * Distinct rationale decision categories present in the routed bank. Low
   * cardinality (max 8 values). Useful for aggregate analytics without
   * leaking per-question detail.
   */
  readonly rationaleCategories: readonly RoutingRationale['decision'][];
  /** Low-cardinality stable selection fingerprint from the routing engine. */
  readonly selectionFingerprint: string;
}

/**
 * Build the snapshot from a profile + routed bank. Pure and deterministic.
 */
export function buildRoutingExplainabilitySnapshot(
  profile: InstitutionalAssessmentProfile,
  bank: RoutedQuestionBank,
): RoutingExplainabilitySnapshot {
  const coreIds = new Set(
    [...bank.includedQuestions, ...bank.deferredQuestions]
      .filter((q) => !q.adaptive)
      .map((q) => q.id),
  );
  const includedIds = new Set(bank.includedQuestions.map((q) => q.id));
  const corePreserved =
    coreIds.size === 0 ||
    Array.from(coreIds).every((id) => includedIds.has(id));

  const categories = new Set<RoutingRationale['decision']>();
  for (const r of bank.routingRationale) categories.add(r.decision);

  return {
    doctrineVersion: '1.0.0',
    routeVersion: bank.routeVersion,
    profileBands: {
      institutionalScale: profile.institutionalScale,
      continuityComplexity: profile.continuityComplexity,
      governanceComplexity: profile.governanceComplexity,
      continuityExposure: profile.continuityExposure,
      respondentLens: profile.respondentLens,
    },
    includedCount: bank.includedQuestions.length,
    deferredCount: bank.deferredQuestions.length,
    requiredCount: bank.requiredQuestions.length,
    fallbackUsed: bank.usedSafeDefault,
    corePreserved,
    rationaleCategories: Array.from(categories).sort(),
    selectionFingerprint: bank.selectionFingerprint,
  };
}
