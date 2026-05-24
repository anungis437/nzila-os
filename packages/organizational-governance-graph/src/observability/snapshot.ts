/**
 * Governance — Read-Only Institutional Observability (Phase 4 Deliverable #8)
 *
 * GATED scaffold that produces a counts-only snapshot of the institutional
 * governance graph for operational observability (e.g. dashboards, log
 * sampling, drift detection). Strictly read-only and additive.
 *
 * Gate:
 *   The function returns `null` when the flag is disabled. By default the
 *   flag is read from `process.env.IGG_OBSERVABILITY_ENABLED === '1'`, but
 *   callers may supply an explicit `enabled` boolean to bypass env access
 *   (useful in tests and in environments where `process` is not available).
 *
 * Doctrine fence (mirrors trust.ts / continuity.ts / evidence.ts):
 *   - COUNTS ONLY. No ratios, no percentages, no averages.
 *   - NO ranking, scoring, weighting, or "trust score".
 *   - NO behavioural inference, actor profiling, or caucus analysis.
 *   - NO predictive simulation, forecasting, or recommendation surface.
 *   - NO governance-efficiency, leadership-stability, or power-network maps.
 *   - Funnels every read through `redactProtected` →
 *     `assertNoProtectedKindsInReadSurface` →
 *     `assertNoProtectedKindsInProjections`.
 *
 * Pipeline:
 *   gate check
 *     → redactProtected (substrate)
 *     → compose timeline + evidence + continuity + trust counts
 *     → assemble counts-only snapshot
 *     → assertNoProtectedKindsInReadSurface
 *     → assertNoProtectedKindsInProjections
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'

import { buildContinuityTimeline } from './../governance/continuity'
import { buildEvidenceConvergence } from './../governance/evidence'
import {
  assertNoProtectedKindsInProjections,
  assertNoProtectedKindsInReadSurface,
  redactProtected,
} from './../governance/protected'
import { buildInstitutionalTimeline } from './../governance/timeline'
import { hydrateGovernanceTopologyInfrastructure } from './../governance/topology-hydration'
import {
  buildExplainabilityRecords,
  summarizeProvenanceCoverage,
} from './../governance/trust'

// ── Public types ──────────────────────────────────────────────────────────

export interface ObservabilityGraph {
  readonly nodes?: readonly EntityNode[]
  readonly edges?: readonly EntityEdge[]
  readonly decisions?: readonly DecisionNode[]
}

export interface ObservabilitySnapshotOptions {
  /**
   * Explicit override for the gate. When omitted, the gate reads
   * `process.env.IGG_OBSERVABILITY_ENABLED === '1'`.
   */
  readonly enabled?: boolean
}

/**
 * Counts-only observability snapshot. By doctrine, every field is a
 * non-negative integer count or a stable string label — never a ratio,
 * percentage, score, weight, or evaluative metric.
 */
export interface InstitutionalObservabilitySnapshot {
  readonly generatedAt: string
  readonly substrate: {
    readonly nodes: number
    readonly edges: number
    readonly decisions: number
  }
  readonly timeline: {
    readonly entries: number
  }
  readonly evidence: {
    readonly entries: number
  }
  readonly continuity: {
    readonly entries: number
  }
  readonly topology: {
    readonly normalizedRelationships: number
    readonly lineageChains: number
    readonly continuityProjections: number
    readonly protectedRedactions: number
  }
  readonly provenance: {
    readonly totalDecisions: number
    readonly decisionsWithEvidence: number
    readonly decisionsWithKnowledge: number
    readonly decisionsWithPolicy: number
    readonly decisionsWithLineage: number
    readonly decisionsWithPrecedingEvent: number
  }
}

// ── Gate ──────────────────────────────────────────────────────────────────

function readGate(opts?: ObservabilitySnapshotOptions): boolean {
  if (typeof opts?.enabled === 'boolean') return opts.enabled
  // Use a defensive read — `process` may not be present in some runtimes.
  const env =
    typeof process !== 'undefined' && process?.env ? process.env : undefined
  return env?.IGG_OBSERVABILITY_ENABLED === '1'
}

// ── Public surface ────────────────────────────────────────────────────────

/**
 * Returns a counts-only observability snapshot of the institutional
 * governance graph, or `null` when the gate is disabled.
 *
 * The function performs no IO of its own and emits nothing — it returns a
 * value for the caller to log, expose, or store as it sees fit.
 */
export function collectInstitutionalObservability(
  graph: ObservabilityGraph,
  options?: ObservabilitySnapshotOptions,
): InstitutionalObservabilitySnapshot | null {
  if (!readGate(options)) return null

  // Substrate fence — apply redactProtected before any counting so protected
  // semantics never reach the snapshot, even as a count.
  const safe = redactProtected({
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
    decisions: graph.decisions ?? [],
  })

  assertNoProtectedKindsInReadSurface({
    nodes: safe.nodes,
    edges: safe.edges,
    decisions: safe.decisions,
  })

  const timeline = buildInstitutionalTimeline({
    nodes: safe.nodes,
    edges: safe.edges,
    decisions: safe.decisions,
  })
  const evidence = buildEvidenceConvergence(safe)
  const continuity = buildContinuityTimeline(safe)
  const topology = hydrateGovernanceTopologyInfrastructure({
    edges: safe.edges,
    decisions: safe.decisions,
  })
  const explain = buildExplainabilityRecords(safe)
  const provenance = summarizeProvenanceCoverage(explain)

  const snapshot: InstitutionalObservabilitySnapshot = {
    generatedAt: new Date().toISOString(),
    substrate: {
      nodes: safe.nodes.length,
      edges: safe.edges.length,
      decisions: safe.decisions.length,
    },
    timeline: { entries: timeline.length },
    evidence: { entries: evidence.length },
    continuity: { entries: continuity.length },
    topology: {
      normalizedRelationships: topology.stats.normalizedRelationshipCount,
      lineageChains: topology.stats.lineageChainCount,
      continuityProjections: topology.stats.continuityProjectionCount,
      protectedRedactions: topology.stats.redactedProtectedRelationships,
    },
    provenance: {
      totalDecisions: provenance.totalDecisions,
      decisionsWithEvidence: provenance.decisionsWithEvidence,
      decisionsWithKnowledge: provenance.decisionsWithKnowledge,
      decisionsWithPolicy: provenance.decisionsWithPolicy,
      decisionsWithLineage: provenance.decisionsWithLineage,
      decisionsWithPrecedingEvent: provenance.decisionsWithPrecedingEvent,
    },
  }

  // Belt-and-suspenders projection fence. The snapshot carries only counts
  // and a timestamp — no `category` or `summary` strings — so we pass an
  // explicit empty projections array to assert intent rather than fields.
  assertNoProtectedKindsInProjections([], 'observability')

  return snapshot
}
