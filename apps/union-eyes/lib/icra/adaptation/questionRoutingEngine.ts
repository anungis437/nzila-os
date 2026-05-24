/**
 * ARTIFACT TYPE: Routing Engine (pure orchestrator)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §5; OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md §4, §10
 *
 * Given a full question bank and an organizational profile, produces a
 * deterministic `RoutedQuestionBank` with audit-grade rationale.
 *
 * Refuses to narrow below the minimum-meaningful threshold (returns full
 * bank with a `routing_failure_safe_default` rationale instead).
 */

import { decideEligibility } from './questionEligibilityRules';
import { prioritize, type PrioritizedQuestion } from './questionPriorityModel';
import {
  DEFAULT_ROUTING_OPTIONS,
  ROUTING_ENGINE_VERSION,
  type RoutableQuestion,
  type RoutedQuestionBank,
  type RoutingOptions,
  type RoutingRationale,
} from './routingTypes';
import type { InstitutionalAssessmentProfile } from './types';

/**
 * Fingerprint helper — short, stable, low-cardinality. Hash by question-id
 * concatenation is NOT used (could leak ordering specifics in telemetry);
 * we instead emit `<count>-<bandSig>-<sectionSig>`.
 */
function fingerprintSelection(prioritized: readonly PrioritizedQuestion[]): string {
  const bands: Record<string, number> = { core: 0, required: 0, recommended: 0, contextual: 0 };
  const sections = new Set<string>();
  for (const p of prioritized) {
    bands[p.band] = (bands[p.band] ?? 0) + 1;
    sections.add(p.question.section);
  }
  const bandSig = `c${bands.core}r${bands.required}m${bands.recommended}x${bands.contextual}`;
  const sectionSig = [...sections].sort().join('.');
  return `${prioritized.length}|${bandSig}|${sectionSig}`;
}

function buildFullBankFallback(
  questions: readonly RoutableQuestion[],
  reason: string,
): RoutedQuestionBank {
  const prioritized = prioritize(
    questions.map((q) => ({ question: q, band: 'core' as const })),
  );
  const rationale: RoutingRationale[] = [
    {
      questionId: '*',
      decision: 'include_core',
      ruleId: 'routing.safe_default_full_bank',
      statement: reason,
    },
  ];
  return Object.freeze({
    doctrineVersion: '1.0.0' as const,
    routeVersion: ROUTING_ENGINE_VERSION,
    includedQuestions: prioritized.map((p) => p.question),
    deferredQuestions: [],
    requiredQuestions: prioritized.map((p) => p.question),
    optionalContextQuestions: [],
    routingRationale: rationale,
    usedSafeDefault: true,
    selectionFingerprint: fingerprintSelection(prioritized),
  });
}

/**
 * Route the bank for the supplied profile.
 *
 * Inputs:
 *  - `bank` — the full inventory of OCRA questions to consider.
 *  - `profile` — deterministic organizational profile.
 *  - `options` — see `RoutingOptions`.
 */
export function routeQuestionBank(
  bank: readonly RoutableQuestion[],
  profile: InstitutionalAssessmentProfile,
  options: RoutingOptions = {},
): RoutedQuestionBank {
  const opts = { ...DEFAULT_ROUTING_OPTIONS, ...options };

  // Profile arrived as a partial conservative default: doctrine §4 says we
  // do not narrow on speculative inputs. Return full bank.
  if (profile.usedConservativeDefault) {
    return buildFullBankFallback(
      bank,
      'Profile was assembled from partial inputs; routing fell back to the full question bank to avoid speculative narrowing.',
    );
  }

  const included: PrioritizedQuestion[] = [];
  const deferred: RoutableQuestion[] = [];
  const rationale: RoutingRationale[] = [];

  for (const q of bank) {
    const decision = decideEligibility(q, profile);
    if (decision.kind === 'include') {
      included.push({ question: q, band: decision.band });
      rationale.push({
        questionId: q.id,
        decision:
          decision.band === 'core'
            ? 'include_core'
            : decision.band === 'required'
              ? 'include_required'
              : decision.band === 'recommended'
                ? 'include_recommended'
                : 'include_contextual',
        ruleId: decision.ruleId,
        statement: decision.statement,
      });
    } else {
      deferred.push(q);
      rationale.push({
        questionId: q.id,
        decision:
          decision.reason === 'suppressed'
            ? 'defer_suppressed'
            : decision.reason === 'complexity_floor'
              ? 'defer_complexity_floor'
              : decision.reason === 'complexity_ceiling'
                ? 'defer_complexity_ceiling'
                : 'defer_out_of_scope',
        ruleId: decision.ruleId,
        statement: decision.statement,
      });
    }
  }

  // Doctrine §5: never let routing produce a sub-meaningful set.
  if (included.length < opts.minIncludedQuestions) {
    return buildFullBankFallback(
      bank,
      `Routed selection (${included.length}) fell below minimum-meaningful threshold (${opts.minIncludedQuestions}); falling back to the full question bank.`,
    );
  }

  const prioritized = prioritize(included);
  const requiredQuestions = prioritized
    .filter((p) => p.band === 'core' || p.band === 'required')
    .map((p) => p.question);
  const optionalContextQuestions = prioritized
    .filter((p) => p.band === 'recommended' || p.band === 'contextual')
    .map((p) => p.question);

  return Object.freeze({
    doctrineVersion: '1.0.0' as const,
    routeVersion: ROUTING_ENGINE_VERSION,
    includedQuestions: prioritized.map((p) => p.question),
    deferredQuestions: deferred,
    requiredQuestions,
    optionalContextQuestions,
    routingRationale: rationale,
    usedSafeDefault: false,
    selectionFingerprint: fingerprintSelection(prioritized),
  });
}
