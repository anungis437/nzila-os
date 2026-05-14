/**
 * Governance — Trust & Explainability Convergence (Phase 4 Deliverable #7)
 *
 * Read-only convergence layer that joins each governance decision with the
 * provenance trail that makes it institutionally explainable:
 *
 *   - the citation triplet (evidence / knowledge / policy)
 *   - the preceding governance events anchored to the same entity
 *   - the lineage / succession context (SUPERSEDES breakpoints)
 *
 * Answers the institutional-history question:
 *
 *   "What documentary, procedural, and successional record is available
 *    to explain how this decision came to be?"
 *
 * Doctrine fence:
 *   - NO ranking, scoring, weighting, or "trust score" of any kind.
 *   - NO confidence numbers, behavioural attributes, or actor profiling.
 *   - NO predictive simulation or recommendation surface.
 *   - NO governance-efficiency, leadership-stability, or caucus inference.
 *
 * Pipeline (mirrors `./evidence.ts` and `./continuity.ts`):
 *   redactProtected (via underlying builders)
 *     → compose evidence + timeline + continuity
 *     → join provenance refs deterministically
 *     → applyOptions
 *     → assertNoProtectedKindsInReadSurface
 *     → assertNoProtectedKindsInProjections
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'

import {
  type ContinuityEntry,
  buildContinuityTimeline,
} from './continuity'
import {
  type EvidenceConvergenceEntry,
  buildEvidenceConvergence,
} from './evidence'
import {
  assertNoProtectedKindsInProjections,
  assertNoProtectedKindsInReadSurface,
  redactProtected,
} from './protected'
import {
  type InstitutionalTimelineEntry,
  buildInstitutionalTimeline,
} from './timeline'

// ── Public types ──────────────────────────────────────────────────────────

/**
 * A single explainability record for one decision. All references are pure
 * IDs; no scoring, weighting, or evaluative metadata is attached.
 */
export interface ExplainabilityRecord {
  readonly decisionRef: string
  readonly entityRef: string
  readonly occurredAt: string
  readonly decisionType: string
  readonly summary: string
  readonly evidenceRefs: readonly string[]
  readonly knowledgeRefs: readonly string[]
  readonly policyRefs: readonly string[]
  /** Timeline source IDs (decision ids / edge ids) of governance events
   *  occurring at or before this decision on the same entity. */
  readonly precedingEventRefs: readonly string[]
  /** Continuity succession-breakpoint edge IDs in which this decision's
   *  entity appears as predecessor or successor. */
  readonly lineageRefs: readonly string[]
  readonly category?: string
  readonly status?: string
}

export interface TrustConvergenceGraph {
  readonly nodes?: readonly EntityNode[]
  readonly edges?: readonly EntityEdge[]
  readonly decisions?: readonly DecisionNode[]
}

export interface TrustConvergenceOptions {
  readonly since?: string
  readonly until?: string
  readonly decisionTypes?: readonly string[]
  /** When true, restrict to records with at least one citation across
   *  evidence / knowledge / policy. */
  readonly requireCitation?: boolean
  /** Optional bound (in milliseconds) on how far back to look for
   *  preceding events. When omitted, all preceding events on the same
   *  entity are linked. */
  readonly windowBeforeMs?: number
}

/**
 * Provenance coverage counts. Counts only — no ratios, scores, or rankings
 * are emitted, by doctrine.
 */
export interface ProvenanceCoverageSummary {
  readonly totalDecisions: number
  readonly decisionsWithEvidence: number
  readonly decisionsWithKnowledge: number
  readonly decisionsWithPolicy: number
  readonly decisionsWithLineage: number
  readonly decisionsWithPrecedingEvent: number
}

// ── Internal helpers ──────────────────────────────────────────────────────

function precedingEventRefs(
  evidence: EvidenceConvergenceEntry,
  timeline: readonly InstitutionalTimelineEntry[],
  windowBeforeMs: number | undefined,
): readonly string[] {
  const decisionAt = Date.parse(evidence.occurredAt)
  const lowerBound =
    windowBeforeMs !== undefined && Number.isFinite(decisionAt)
      ? decisionAt - windowBeforeMs
      : undefined
  const refs: string[] = []
  for (const t of timeline) {
    if (t.entityRef !== evidence.entityRef) continue
    if (t.sourceId === evidence.decisionId) continue
    if (t.occurredAt > evidence.occurredAt) continue
    if (lowerBound !== undefined) {
      const ts = Date.parse(t.occurredAt)
      if (Number.isFinite(ts) && ts < lowerBound) continue
    }
    refs.push(t.sourceId)
  }
  // Deduplicate while preserving deterministic ascending order.
  return [...new Set(refs)].sort()
}

function lineageRefs(
  evidence: EvidenceConvergenceEntry,
  continuity: readonly ContinuityEntry[],
): readonly string[] {
  const refs: string[] = []
  for (const c of continuity) {
    if (c.kind !== 'succession_breakpoint') continue
    if (c.edgeId === undefined) continue
    if (
      c.predecessorEntityId === evidence.entityRef ||
      c.successorEntityId === evidence.entityRef
    ) {
      refs.push(c.edgeId)
    }
  }
  return [...new Set(refs)].sort()
}

function applyOptions(
  records: readonly ExplainabilityRecord[],
  options: TrustConvergenceOptions | undefined,
): readonly ExplainabilityRecord[] {
  if (!options) return records
  const { since, until, decisionTypes, requireCitation } = options
  return records.filter((r) => {
    if (since && r.occurredAt < since) return false
    if (until && r.occurredAt > until) return false
    if (
      decisionTypes &&
      decisionTypes.length > 0 &&
      !decisionTypes.includes(r.decisionType)
    ) {
      return false
    }
    if (
      requireCitation &&
      r.evidenceRefs.length === 0 &&
      r.knowledgeRefs.length === 0 &&
      r.policyRefs.length === 0
    ) {
      return false
    }
    return true
  })
}

function sortAscending(
  records: readonly ExplainabilityRecord[],
): readonly ExplainabilityRecord[] {
  return [...records].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) return a.decisionRef.localeCompare(b.decisionRef)
    return a.occurredAt < b.occurredAt ? -1 : 1
  })
}

// ── Public builders ───────────────────────────────────────────────────────

/**
 * Build read-only explainability records over the supplied graph. Composes
 * the redacted evidence / timeline / continuity convergences and joins them
 * by entity + chronology — no scoring, no inference, no behavioural data.
 */
export function buildExplainabilityRecords(
  graph: TrustConvergenceGraph,
  options?: TrustConvergenceOptions,
): readonly ExplainabilityRecord[] {
  // Each underlying builder performs its own redactProtected + projection
  // fence; the trust layer composes their already-safe outputs.
  const evidence = buildEvidenceConvergence(graph)
  const timeline = buildInstitutionalTimeline({
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
    decisions: graph.decisions ?? [],
  })
  const continuity = buildContinuityTimeline(graph)

  const records: ExplainabilityRecord[] = evidence.map((e) => ({
    decisionRef: e.decisionId,
    entityRef: e.entityRef,
    occurredAt: e.occurredAt,
    decisionType: e.decisionType,
    summary: e.summary,
    evidenceRefs: e.evidenceRefs,
    knowledgeRefs: e.knowledgeRefs,
    policyRefs: e.policyRefs,
    precedingEventRefs: precedingEventRefs(e, timeline, options?.windowBeforeMs),
    lineageRefs: lineageRefs(e, continuity),
    category: e.category,
    status: e.status,
  }))

  const sorted = sortAscending(records)
  const final = applyOptions(sorted, options)

  // Belt-and-suspenders: re-fence on the substrate and the projection slice
  // we are about to emit, mirroring evidence.ts / continuity.ts pipelines.
  const safe = redactProtected(graph)
  assertNoProtectedKindsInReadSurface({
    nodes: safe.nodes,
    edges: safe.edges,
    decisions: safe.decisions,
  })
  assertNoProtectedKindsInProjections(
    final.map((r) => ({ category: r.category, summary: r.summary })),
    'trust',
  )
  return final
}

/**
 * Explainability record(s) for a single decision id. Returns at most one
 * record, or an empty array if the decision is unknown or was redacted.
 */
export function explainabilityForDecision(
  graph: TrustConvergenceGraph,
  decisionId: string,
): readonly ExplainabilityRecord[] {
  return buildExplainabilityRecords(graph).filter(
    (r) => r.decisionRef === decisionId,
  )
}

/** Explainability records anchored to a single entity. */
export function explainabilityForEntity(
  graph: TrustConvergenceGraph,
  entityRef: string,
  options?: TrustConvergenceOptions,
): readonly ExplainabilityRecord[] {
  return buildExplainabilityRecords(graph, options).filter(
    (r) => r.entityRef === entityRef,
  )
}

/**
 * Provenance coverage counts across a set of explainability records. Counts
 * only — no ratios, no scoring, no ranking, by doctrine.
 */
export function summarizeProvenanceCoverage(
  records: readonly ExplainabilityRecord[],
): ProvenanceCoverageSummary {
  let withEvidence = 0
  let withKnowledge = 0
  let withPolicy = 0
  let withLineage = 0
  let withPreceding = 0
  for (const r of records) {
    if (r.evidenceRefs.length > 0) withEvidence++
    if (r.knowledgeRefs.length > 0) withKnowledge++
    if (r.policyRefs.length > 0) withPolicy++
    if (r.lineageRefs.length > 0) withLineage++
    if (r.precedingEventRefs.length > 0) withPreceding++
  }
  return {
    totalDecisions: records.length,
    decisionsWithEvidence: withEvidence,
    decisionsWithKnowledge: withKnowledge,
    decisionsWithPolicy: withPolicy,
    decisionsWithLineage: withLineage,
    decisionsWithPrecedingEvent: withPreceding,
  }
}
