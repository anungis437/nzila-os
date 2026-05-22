/**
 * Continuity Confidence Signals — likert_5 modality interpretation.
 *
 * These signals translate confidence-modality answers into named continuity
 * confidence indicators. They are not scores; they are interpretable signals
 * used by Product 5 longitudinal analysis and executive reporting.
 *
 * Doctrine source: docs/oci/assessment/OCI_MODALITY_DOCTRINE.md §4
 */

import type { Answer, Question } from './types';

export type ContinuityConfidenceDomain =
  | 'operational_clarity'
  | 'governance_confidence'
  | 'reconstruction_confidence'
  | 'onboarding_confidence'
  | 'modernization_continuity_confidence'
  | 'recoverability_confidence';

export interface ContinuityConfidenceSignal {
  domain: ContinuityConfidenceDomain;
  /** 0..1 — confidence level expressed by the institution */
  confidence: number;
  /** 0..1 — degree of ambiguity (distance from the extremes) */
  ambiguity: number;
  /** Source question id */
  sourceQuestionId: string;
  /** Whether this signal is longitudinally tracked */
  longitudinalTracked: boolean;
}

/**
 * Map likert_5 questions to their declared confidence domain.
 * Keyed by question id. Authored alongside question creation.
 */
const QUESTION_TO_DOMAIN: Record<string, ContinuityConfidenceDomain> = {
  ccs_01: 'operational_clarity',
  ccs_02: 'governance_confidence',
  ccs_03: 'reconstruction_confidence',
  ccs_04: 'onboarding_confidence',
  ccs_05: 'modernization_continuity_confidence',
  ccs_06: 'recoverability_confidence',
  ccs_07: 'operational_clarity',
};

export function deriveConfidenceSignals(
  answers: Answer[],
  questions: ReadonlyArray<Question>,
): ContinuityConfidenceSignal[] {
  const signals: ContinuityConfidenceSignal[] = [];
  const qIndex = new Map(questions.map((q) => [q.id, q]));

  for (const a of answers) {
    const q = qIndex.get(a.questionId);
    if (!q || q.type !== 'likert_5') continue;

    const domain = QUESTION_TO_DOMAIN[q.id];
    if (!domain) continue;

    const normalized = a.normalizedScore; // already 0..1
    // ambiguity peaks at midpoint (0.5) and falls toward the extremes
    const ambiguity = 1 - Math.abs(normalized - 0.5) * 2;

    signals.push({
      domain,
      confidence: normalized,
      ambiguity,
      sourceQuestionId: q.id,
      longitudinalTracked: q.intelligence?.longitudinalValue === 'high',
    });
  }

  return signals;
}

/**
 * Aggregate per-domain mean confidence. Refusal-default: returns null for
 * domains with no answers rather than fabricating a neutral value.
 */
export function aggregateConfidenceByDomain(
  signals: ContinuityConfidenceSignal[],
): Record<ContinuityConfidenceDomain, number | null> {
  const buckets: Record<ContinuityConfidenceDomain, number[]> = {
    operational_clarity: [],
    governance_confidence: [],
    reconstruction_confidence: [],
    onboarding_confidence: [],
    modernization_continuity_confidence: [],
    recoverability_confidence: [],
  };
  for (const s of signals) buckets[s.domain].push(s.confidence);
  const out: Record<ContinuityConfidenceDomain, number | null> = {
    operational_clarity: null,
    governance_confidence: null,
    reconstruction_confidence: null,
    onboarding_confidence: null,
    modernization_continuity_confidence: null,
    recoverability_confidence: null,
  };
  for (const key of Object.keys(buckets) as ContinuityConfidenceDomain[]) {
    const vals = buckets[key];
    if (vals.length === 0) continue;
    out[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return out;
}
