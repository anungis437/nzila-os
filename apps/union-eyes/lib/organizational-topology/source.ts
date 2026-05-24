/**
 * Institutional Topology — read-only data adapter.
 *
 * Composes structural views (hierarchy, affiliation/representation,
 * delegation, lineage, continuity-topology) over the institutional
 * substrate using only the public IGG builders. Every collection passes
 * through `redactProtected` and the IGG protected-kind fences before it
 * reaches this surface.
 *
 * Doctrine: this module answers "What is the shape of this institutional
 * topology and how did it come to exist?" — never "How do we re-route
 * influence, optimize coalitions, or predict outcomes?". No automation,
 * no scoring, no behavioural analytics. Protected institutional
 * semantics are filtered at the graph layer.
 */

import {
  IggEntityKinds,
  IggRelationshipKinds,
  buildContinuityTimeline,
  hierarchyAncestors,
  hierarchyDescendants,
  lineageChain,
  nodesOfIggKind,
  redactProtected,
  resolveDelegationChains,
  type ContinuityEntry,
  type DelegationResolution,
  type InstitutionalTimelineGraph,
} from '@nzila/organizational-governance-graph'

// ── View shapes ─────────────────────────────────────────────────────────────

export interface HierarchyNodeView {
  readonly entityId: string
  readonly iggKind: string
  readonly ancestors: readonly string[]
  readonly descendants: readonly string[]
}

export type AffiliationRelationshipKind = 'affiliated_with' | 'represents'

export interface AffiliationEdgeView {
  readonly sourceEntityId: string
  readonly targetEntityId: string
  readonly relationship: AffiliationRelationshipKind
}

export interface AffiliationCohortView {
  readonly organizationId: string
  readonly memberEntityIds: readonly string[]
}

export interface AffiliationRepresentationView {
  readonly edges: readonly AffiliationEdgeView[]
  readonly cohorts: readonly AffiliationCohortView[]
}

export interface LineageChainView {
  readonly originEntityId: string
  readonly chain: readonly string[]
}

export interface InstitutionalTopologyView {
  readonly generatedAt: string
  readonly substrate: {
    readonly nodes: number
    readonly edges: number
    readonly decisions: number
  }
  readonly hierarchy: readonly HierarchyNodeView[]
  readonly affiliationRepresentation: AffiliationRepresentationView
  readonly delegation: readonly DelegationResolution[]
  readonly lineage: readonly LineageChainView[]
  readonly continuityTopology: readonly ContinuityEntry[]
}

// ── Substrate placeholder ───────────────────────────────────────────────────

/**
 * Returns the raw institutional governance graph used by the topology
 * surfaces.
 *
 * Placeholder: the real institutional substrate adapter is a future
 * workstream. Returning an empty, well-typed graph keeps the read
 * surfaces calm and exercises the IGG fences end-to-end.
 */
export async function getInstitutionalGraph(): Promise<InstitutionalTimelineGraph> {
  return { nodes: [], edges: [], decisions: [] }
}

// ── Composition ─────────────────────────────────────────────────────────────

const HIERARCHY_KINDS: readonly string[] = [
  IggEntityKinds.PLATFORM,
  IggEntityKinds.CONGRESS,
  IggEntityKinds.FEDERATION,
  IggEntityKinds.UNION,
  IggEntityKinds.LOCAL,
  IggEntityKinds.REGION,
  IggEntityKinds.DISTRICT,
  IggEntityKinds.COMMITTEE,
  IggEntityKinds.BARGAINING_UNIT,
]

function readEdgeKind(edge: { metadata?: unknown }): string | undefined {
  return (edge.metadata as Record<string, unknown> | undefined)?.iggKind as
    | string
    | undefined
}

/**
 * Composes the read-only topology view from the IGG public builders.
 * Every list returned here has already passed through `redactProtected`
 * before any structural traversal is performed.
 */
export async function getInstitutionalTopologyView(): Promise<InstitutionalTopologyView> {
  const raw = await getInstitutionalGraph()
  const safe = redactProtected(raw)
  const nodes = safe.nodes ?? []
  const edges = safe.edges ?? []
  const decisions = safe.decisions ?? []

  // Hierarchy — one entry per node carrying an IGG hierarchy kind.
  const hierarchy: readonly HierarchyNodeView[] = HIERARCHY_KINDS.flatMap(
    (kind) =>
      nodesOfIggKind(nodes, kind).map<HierarchyNodeView>((n) => ({
        entityId: n.entityId,
        iggKind: kind,
        ancestors: hierarchyAncestors(n.entityId, edges),
        descendants: hierarchyDescendants(n.entityId, edges),
      })),
  )

  // Affiliation + representation — edges filtered by IGG kind metadata,
  // plus per-organization cohorts derived from AFFILIATED_WITH targets.
  const affiliationEdges: AffiliationEdgeView[] = []
  const cohortTargets = new Set<string>()
  for (const edge of edges) {
    const kind = readEdgeKind(edge)
    if (kind === IggRelationshipKinds.AFFILIATED_WITH) {
      affiliationEdges.push({
        sourceEntityId: edge.sourceEntityId,
        targetEntityId: edge.targetEntityId,
        relationship: 'affiliated_with',
      })
      cohortTargets.add(edge.targetEntityId)
    } else if (kind === IggRelationshipKinds.REPRESENTS) {
      affiliationEdges.push({
        sourceEntityId: edge.sourceEntityId,
        targetEntityId: edge.targetEntityId,
        relationship: 'represents',
      })
    }
  }
  const cohorts: readonly AffiliationCohortView[] = Array.from(cohortTargets)
    .sort()
    .map((organizationId) => ({
      organizationId,
      memberEntityIds: affiliationEdges
        .filter(
          (e) =>
            e.relationship === 'affiliated_with' &&
            e.targetEntityId === organizationId,
        )
        .map((e) => e.sourceEntityId),
    }))
  const affiliationRepresentation: AffiliationRepresentationView = {
    edges: affiliationEdges,
    cohorts,
  }

  // Delegation — placeholder graph carries no delegation edges; resolver
  // returns an empty list and the protected fence remains in force when
  // real delegation inputs are wired in.
  const delegation = resolveDelegationChains([])

  // Lineage — walk SUPERSEDES / OVERRIDES from each node; deduplicate by
  // origin (oldest) so each chain appears once.
  const seenChains = new Set<string>()
  const lineage: LineageChainView[] = []
  for (const node of nodes) {
    const chain = lineageChain(node.entityId, edges)
    if (chain.length === 0) continue
    const origin = chain[0]
    if (seenChains.has(origin)) continue
    seenChains.add(origin)
    lineage.push({ originEntityId: origin, chain })
  }

  // Continuity-topology — succession / tenure / affiliation transitions
  // sorted chronologically by the IGG continuity builder.
  const continuityTopology = buildContinuityTimeline(safe)

  return {
    generatedAt: new Date().toISOString(),
    substrate: {
      nodes: nodes.length,
      edges: edges.length,
      decisions: decisions.length,
    },
    hierarchy,
    affiliationRepresentation,
    delegation,
    lineage,
    continuityTopology,
  }
}
