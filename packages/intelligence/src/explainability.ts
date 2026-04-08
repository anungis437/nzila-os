/**
 * @nzila/intelligence — Explainability
 *
 * Translates reasoning-engine chains and decision-engine records into
 * the unified ExplanationTrace attached to every IntelligenceResponse.
 */
import type {
  ExplanationTrace,
  ExplanationStep,
  ExplanationCitation,
} from './types.js'
import type { ReasoningChain, Citation } from '@nzila/platform-reasoning-engine'
import type { DecisionRecord } from '@nzila/platform-decision-engine/types'

// ── From Reasoning Chain ────────────────────────────────────────────────────

/**
 * Convert a platform-reasoning-engine ReasoningChain into a NIL ExplanationTrace.
 */
export function traceFromReasoningChain(chain: ReasoningChain): ExplanationTrace {
  const steps: ExplanationStep[] = chain.steps.map((s) => ({
    stepNumber: s.stepNumber,
    description: s.description,
    confidence: s.confidence,
    durationMs: s.durationMs,
  }))

  const citations: ExplanationCitation[] = chain.allCitations.map(mapCitation)

  const summary =
    chain.conclusion?.summary ??
    `Reasoning chain ${chain.id} (${chain.reasoningType}) — ${chain.status}`

  return { summary, steps, citations }
}

// ── From Decision Record ────────────────────────────────────────────────────

/**
 * Convert a platform-decision-engine DecisionRecord into a NIL ExplanationTrace.
 */
export function traceFromDecisionRecord(record: DecisionRecord): ExplanationTrace {
  const steps: ExplanationStep[] = [
    {
      stepNumber: 1,
      description: `Decision generated: ${record.title}`,
      confidence: record.confidence_score,
      durationMs: 0,
    },
  ]

  const citations: ExplanationCitation[] = record.evidence_refs.map((ref, idx) => ({
    id: `evidence-${idx}`,
    sourceType: mapEvidenceRefType(ref.type),
    sourceId: ref.ref_id,
    label: ref.type,
    excerpt: ref.summary ?? '',
    relevance: 1,
  }))

  return {
    summary: record.explanation,
    steps,
    citations,
  }
}

// ── Empty Trace ─────────────────────────────────────────────────────────────

/**
 * Create a minimal explanation trace for operations that skip reasoning/decision.
 */
export function emptyTrace(summary: string): ExplanationTrace {
  return { summary, steps: [], citations: [] }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapCitation(c: Citation): ExplanationCitation {
  return {
    id: c.id,
    sourceType: c.sourceType,
    sourceId: c.sourceId,
    label: c.label,
    excerpt: c.excerpt,
    relevance: c.relevance,
  }
}

function mapEvidenceRefType(
  t: string,
): ExplanationCitation['sourceType'] {
  const mapping: Record<string, ExplanationCitation['sourceType']> = {
    event: 'event',
    insight: 'data',
    anomaly: 'data',
    metric: 'data',
    policy: 'policy',
    snapshot: 'data',
    change: 'event',
    artifact: 'entity',
  }
  return mapping[t] ?? 'data'
}
