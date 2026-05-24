/**
 * Institutional Narrative Layer
 *
 * Translates structured cognition envelopes into calm, explainable
 * institutional storytelling. Pure functions — NO new cognition, NO new
 * inference, NO LLM dependency. Narratives are deterministic projections
 * of envelopes already produced and governed by the cognition kernel.
 *
 * Forbidden: workforce framing, individual-level descriptions, optimization
 * language, surveillance vocabulary. Outputs go through the ontology
 * governance vocabulary check before being returned.
 */

import {
  detectForbiddenVocabulary,
  type InstitutionalExplainabilityEnvelope,
} from '@nzila/organizational-cognition-core';

export interface InstitutionalNarrative {
  /** Engine that produced the source envelope. */
  engine: string;
  /** Canonical institutional domain (e.g. "governance"). */
  domain: string;
  /** Short, plain-language headline (1 sentence, ≤ 160 chars). */
  headline: string;
  /** A 2–4 sentence calm summary of the envelope. */
  summary: string;
  /** The most material reasoning steps, in order. */
  keyReasoning: string[];
  /** Governance implications surfaced for human review. */
  reviewSignals: string[];
  /** Confidence band (mirrored from envelope). */
  confidence: string;
  /** Stable narrative version so consumers can detect drift. */
  narrativeVersion: '1.0.0';
}

export const NARRATIVE_VERSION = '1.0.0' as const;

const CONFIDENCE_PHRASE: Record<string, string> = {
  very_high: 'with very high confidence',
  high: 'with high confidence',
  moderate: 'with moderate confidence',
  low: 'with limited confidence',
  insufficient_data: 'with insufficient supporting evidence',
};

function pickHeadline(env: InstitutionalExplainabilityEnvelope<unknown>): string {
  const guidance = env.interpretationGuidance.trim();
  // Headline = first sentence of interpretation guidance, capped at 160 chars.
  const firstSentence = guidance.split(/(?<=[.!?])\s/)[0] ?? guidance;
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}...` : firstSentence;
}

function pickSummary(env: InstitutionalExplainabilityEnvelope<unknown>): string {
  const conf = CONFIDENCE_PHRASE[env.confidence] ?? '';
  const evidenceCount = env.evidence.length;
  const reviewCount = env.governanceImplications.filter((g) => g.requiresHumanReview).length;
  const parts = [
    env.interpretationGuidance.trim(),
    `Derived from ${evidenceCount} institutional evidence item${evidenceCount === 1 ? '' : 's'} ${conf}.`,
  ];
  if (reviewCount > 0) {
    parts.push(
      `${reviewCount} governance implication${reviewCount === 1 ? '' : 's'} flagged for human review.`,
    );
  }
  return parts.join(' ');
}

function pickKeyReasoning(env: InstitutionalExplainabilityEnvelope<unknown>): string[] {
  return env.reasoning
    .slice()
    .sort((a, b) => a.step - b.step)
    .slice(0, 4)
    .map((step) => step.rationale);
}

function pickReviewSignals(env: InstitutionalExplainabilityEnvelope<unknown>): string[] {
  return env.governanceImplications.map((g) =>
    g.requiresHumanReview
      ? `[${g.severity.toUpperCase()}] ${g.implication} (review required)`
      : `[${g.severity}] ${g.implication}`,
  );
}

/**
 * Project a single explainability envelope into a calm narrative.
 * Throws if the synthesized text contains forbidden labor/surveillance vocabulary.
 */
export function narrateEnvelope(
  env: InstitutionalExplainabilityEnvelope<unknown>,
): InstitutionalNarrative {
  const narrative: InstitutionalNarrative = {
    engine: env.provenance.engine,
    domain: env.domain,
    headline: pickHeadline(env),
    summary: pickSummary(env),
    keyReasoning: pickKeyReasoning(env),
    reviewSignals: pickReviewSignals(env),
    confidence: env.confidence,
    narrativeVersion: NARRATIVE_VERSION,
  };

  const composite = [
    narrative.headline,
    narrative.summary,
    ...narrative.keyReasoning,
    ...narrative.reviewSignals,
  ].join(' ');
  const issues = detectForbiddenVocabulary(composite, `narrative:${narrative.engine}`);
  if (issues.length > 0) {
    throw new Error(
      `Narrative for "${narrative.engine}" contains forbidden vocabulary: ${issues
        .map((i) => i.message)
        .join('; ')}`,
    );
  }

  return narrative;
}

/**
 * Project a batch of envelopes into narratives, indexed by engine id.
 * Failures for any single envelope do not fail the batch — they're recorded.
 */
export function narrateEnvelopes(
  envelopes: ReadonlyArray<InstitutionalExplainabilityEnvelope<unknown>>,
): {
  narratives: Record<string, InstitutionalNarrative>;
  failures: Array<{ engine: string; error: string }>;
} {
  const narratives: Record<string, InstitutionalNarrative> = {};
  const failures: Array<{ engine: string; error: string }> = [];
  for (const env of envelopes) {
    try {
      const n = narrateEnvelope(env);
      narratives[env.provenance.engine] = n;
    } catch (err) {
      failures.push({
        engine: env.provenance.engine,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { narratives, failures };
}

/**
 * Compose an executive briefing from a set of narratives. Pure projection,
 * no inference. Used by executive operating intelligence surfaces.
 */
export interface ExecutiveBriefing {
  generatedAt: string;
  organizationalScope: true;
  highlights: InstitutionalNarrative[];
  reviewSignals: string[];
  briefingVersion: '1.0.0';
}

export function composeExecutiveBriefing(
  narratives: ReadonlyArray<InstitutionalNarrative>,
): ExecutiveBriefing {
  const sorted = narratives.slice().sort((a, b) => {
    // Surface higher-confidence + review-flagged narratives first.
    const score = (n: InstitutionalNarrative) =>
      (n.reviewSignals.length > 0 ? 10 : 0) +
      (n.confidence === 'very_high' ? 4 : n.confidence === 'high' ? 3 : n.confidence === 'moderate' ? 2 : 1);
    return score(b) - score(a);
  });
  const reviewSignals: string[] = [];
  for (const n of sorted) {
    for (const sig of n.reviewSignals) {
      if (!reviewSignals.includes(sig)) reviewSignals.push(sig);
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    organizationalScope: true,
    highlights: sorted.slice(0, 8),
    reviewSignals: reviewSignals.slice(0, 12),
    briefingVersion: '1.0.0',
  };
}
