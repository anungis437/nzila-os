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
  /**
   * Short, plain-language headline (1 sentence, ≤ 160 chars). It states what the result rests on (the records it cites, or that it
   * cites none); it is never the engine's fixed interpretation guidance presented as a finding.
   */
  headline: string;
  /** A 2–4 sentence calm summary of the envelope. */
  summary: string;
  /** The engine's fixed interpretation guidance: the same text for every organization, so it is labelled guidance, not a finding. */
  guidance: string;
  /** Number of stored records the envelope cites as evidence. */
  evidenceCount: number;
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
  // No engine computes a confidence; the kernel's lowest band then means "not assessed", not a measured shortfall.
  insufficient_data: 'with no assessed confidence',
};

const DOMAIN_LABEL_PATTERN = /_/g;

function pickHeadline(env: InstitutionalExplainabilityEnvelope<unknown>): string {
  // The headline states what the result rests on. The interpretation guidance is fixed text, identical for every organization, so it is
  // never used as a headline: that would present guidance as a finding about this organization.
  const domain = env.domain.replace(DOMAIN_LABEL_PATTERN, ' ');
  const evidenceCount = env.evidence.length;
  const headline = evidenceCount === 0
    ? `No evidence-backed finding for ${domain}: the result cites no institutional record.`
    : `${domain}: result cites ${evidenceCount} institutional record${evidenceCount === 1 ? '' : 's'}.`;
  return headline.length > 160 ? `${headline.slice(0, 157)}...` : headline;
}

function pickSummary(env: InstitutionalExplainabilityEnvelope<unknown>): string {
  const conf = CONFIDENCE_PHRASE[env.confidence] ?? '';
  const evidenceCount = env.evidence.length;
  const reviewCount = env.governanceImplications.filter((g) => g.requiresHumanReview).length;
  const parts = [
    evidenceCount === 0
      ? 'No institutional evidence is attached to this result, so it is guidance, not a finding.'
      : `Derived from ${evidenceCount} institutional evidence item${evidenceCount === 1 ? '' : 's'} ${conf}.`,
    `Guidance: ${env.interpretationGuidance.trim()}`,
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
    guidance: env.interpretationGuidance.trim(),
    evidenceCount: env.evidence.length,
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
    // Surface review-flagged narratives first, then those that cite evidence (most first), then an assessed confidence. A narrative
    // that cites nothing and has no assessed confidence never outranks one that rests on records.
    const confidenceRank = (n: InstitutionalNarrative) =>
      n.confidence === 'very_high' ? 4 : n.confidence === 'high' ? 3 : n.confidence === 'moderate' ? 2 : n.confidence === 'low' ? 1 : 0;
    const review = (n: InstitutionalNarrative) => (n.reviewSignals.length > 0 ? 1 : 0);
    const evidence = (n: InstitutionalNarrative) => n.evidenceCount ?? 0;
    return review(b) - review(a) || evidence(b) - evidence(a) || confidenceRank(b) - confidenceRank(a);
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
