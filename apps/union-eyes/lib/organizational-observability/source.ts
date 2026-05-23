/**
 * Institutional Observability — read-only data adapter.
 *
 * Sources an empty institutional substrate today. The IGG public builders
 * apply doctrine fences (redaction + protected-kind assertions) regardless,
 * so this surface is governance-safe even when wired to a future real
 * substrate.
 *
 * Doctrine: this module answers "How did this institutional state emerge?"
 * — never "How do we optimize institutional behavior?". No automation,
 * no scoring, no predictions, no behavioural analytics.
 */

import {
  buildContinuityTimeline,
  buildEvidenceConvergence,
  buildExplainabilityRecords,
  buildInstitutionalTimeline,
  collectInstitutionalObservability,
  summarizeProvenanceCoverage,
  type ContinuityEntry,
  type EvidenceConvergenceEntry,
  type ExplainabilityRecord,
  type InstitutionalObservabilitySnapshot,
  type InstitutionalTimelineEntry,
  type InstitutionalTimelineGraph,
  type ProvenanceCoverageSummary,
} from '@nzila/institutional-governance-graph'

export interface InstitutionalObservabilityView {
  readonly generatedAt: string
  readonly substrate: {
    readonly nodes: number
    readonly edges: number
    readonly decisions: number
  }
  readonly chronology: readonly InstitutionalTimelineEntry[]
  readonly evidence: readonly EvidenceConvergenceEntry[]
  readonly continuity: readonly ContinuityEntry[]
  readonly explainability: readonly ExplainabilityRecord[]
  readonly provenance: ProvenanceCoverageSummary
  readonly snapshot: InstitutionalObservabilitySnapshot | null
}

/**
 * Returns the raw institutional governance graph used by the read surfaces.
 *
 * Placeholder: the real institutional substrate adapter is a future
 * workstream. Returning an empty, well-typed graph keeps the read surfaces
 * calm and exercises the IGG fences end-to-end.
 */
export async function getInstitutionalGraph(): Promise<InstitutionalTimelineGraph> {
  return { nodes: [], edges: [], decisions: [] }
}

/**
 * Composes the read-only observability view from the IGG public builders.
 * Every list returned here has already passed through `redactProtected`
 * and the projection-level protected-kind fences in the IGG layer.
 */
export async function getInstitutionalObservabilityView(): Promise<InstitutionalObservabilityView> {
  const graph = await getInstitutionalGraph()

  const chronology = buildInstitutionalTimeline(graph)
  const evidence = buildEvidenceConvergence(graph)
  const continuity = buildContinuityTimeline(graph)
  const explainability = buildExplainabilityRecords(graph)
  const provenance = summarizeProvenanceCoverage(explainability)
  const snapshot = collectInstitutionalObservability(graph)

  return {
    generatedAt: new Date().toISOString(),
    substrate: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      decisions: graph.decisions.length,
    },
    chronology,
    evidence,
    continuity,
    explainability,
    provenance,
    snapshot,
  }
}
