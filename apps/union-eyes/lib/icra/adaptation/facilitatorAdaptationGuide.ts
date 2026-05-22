/**
 * ARTIFACT TYPE: Facilitator Adaptation Guide (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §4 (adaptation must remain visible)
 *
 * Produces a `FacilitatorGuide` summarizing every adaptive decision the
 * system made, so a human reviewer (facilitator, advisor, or auditor) can
 * read the assessment with full visibility into what was tailored and why.
 *
 * Never includes PII. Never includes free-text inputs. Every entry is
 * traceable to a rule id.
 */

import type {
  ContextualAssessmentResult,
} from './adaptiveScoringModel';
import type { RoutedQuestionBank } from './routingTypes';
import type { InstitutionalAssessmentProfile } from './types';

export interface FacilitatorGuide {
  readonly doctrineVersion: '1.0.0';
  /** Compact profile band summary (low-cardinality, no PII). */
  readonly profileBand: string;
  /** Whether routing fell back to the full bank (and why). */
  readonly routedSafely: boolean;
  readonly routingFallbackReason: string | null;
  /** Counts of included/deferred/required/contextual questions. */
  readonly routingCounts: {
    readonly included: number;
    readonly deferred: number;
    readonly required: number;
    readonly optionalContext: number;
  };
  /** Cautions the facilitator should attend to when interpreting the report. */
  readonly interpretationCautions: readonly string[];
  /** Adaptation decisions the system made (emphasis, interpretation, warnings). */
  readonly adaptationDecisions: readonly {
    readonly area: 'routing' | 'emphasis' | 'interpretation' | 'warning_filter';
    readonly ruleId: string;
    readonly statement: string;
  }[];
}

function buildInterpretationCautions(
  profile: InstitutionalAssessmentProfile,
  routed: RoutedQuestionBank | null,
): string[] {
  const out: string[] = [];

  if (profile.usedConservativeDefault) {
    out.push(
      'Profile was assembled from partial form inputs; treat scale and exposure interpretations as approximate, not authoritative.',
    );
  }

  if (profile.respondentLens === 'external_advisor') {
    out.push(
      'Respondent completed the assessment from an advisory perspective; findings should be validated with internal stewards before operational decisions.',
    );
  }
  if (profile.respondentLens === 'legal_or_counsel') {
    out.push(
      'Respondent completed the assessment from a legal/counsel perspective; continuity findings are not legal advice and should be paired with operational review.',
    );
  }
  if (profile.respondentLens === 'unknown') {
    out.push(
      'Respondent capacity was not declared; treat the reading as baseline continuity sensing.',
    );
  }

  if (
    profile.institutionalScale === 'micro' ||
    profile.institutionalScale === 'small'
  ) {
    out.push(
      'Small-scale assessment: do not interpret absent enterprise infrastructure as a continuity failure. The honest reading is whether trusted individuals have structural relief.',
    );
  }
  if (profile.institutionalScale === 'federated_complex') {
    out.push(
      'Federated-complex assessment: a strong score in one unit does not generalize to the federation. Coordination quality is the operative question.',
    );
  }

  if (profile.continuityExposure === 'mission_critical') {
    out.push(
      'Mission-critical exposure: continuity gaps translate directly into service-delivery harm; the severity bar is appropriately higher than for other institutions.',
    );
  }

  if (routed && routed.usedSafeDefault) {
    out.push(
      'Routing fell back to the full question bank; the respondent saw every question, so there is no routing bias to account for.',
    );
  }

  return out;
}

/**
 * Build the facilitator guide from the contextual result and (optionally)
 * the routed question bank.
 */
export function buildFacilitatorGuide(
  result: ContextualAssessmentResult,
  routed: RoutedQuestionBank | null,
): FacilitatorGuide {
  const profile = result.institutionalProfile;
  const profileBand = [
    profile.institutionalScale,
    profile.continuityComplexity,
    profile.governanceComplexity,
    profile.continuityExposure,
    profile.respondentLens,
  ].join('|');

  const decisions: FacilitatorGuide['adaptationDecisions'] = [
    ...result.adaptationRationale.map((r) => ({
      area: r.area as 'emphasis' | 'interpretation' | 'warning_filter',
      ruleId: r.ruleId,
      statement: r.statement,
    })),
    ...(routed
      ? routed.routingRationale
          // To keep the guide compact, summarize routing: surface fallback + a sample of deferrals.
          .filter(
            (r, idx, arr) =>
              r.ruleId === 'routing.safe_default_full_bank' ||
              (r.decision.startsWith('defer_') &&
                arr.findIndex((x) => x.ruleId === r.ruleId) === idx),
          )
          .map((r) => ({
            area: 'routing' as const,
            ruleId: r.ruleId,
            statement: r.statement,
          }))
      : []),
  ];

  return Object.freeze({
    doctrineVersion: '1.0.0' as const,
    profileBand,
    routedSafely: routed ? !routed.usedSafeDefault : true,
    routingFallbackReason:
      routed && routed.usedSafeDefault
        ? (routed.routingRationale.find(
            (r) => r.ruleId === 'routing.safe_default_full_bank',
          )?.statement ?? null)
        : null,
    routingCounts: {
      included: routed?.includedQuestions.length ?? 0,
      deferred: routed?.deferredQuestions.length ?? 0,
      required: routed?.requiredQuestions.length ?? 0,
      optionalContext: routed?.optionalContextQuestions.length ?? 0,
    },
    interpretationCautions: Object.freeze(
      buildInterpretationCautions(profile, routed),
    ),
    adaptationDecisions: Object.freeze(decisions),
  });
}
