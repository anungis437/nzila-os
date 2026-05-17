/**
 * Workstream H — Governance topology hydration.
 *
 * Read-only topology assembly layer composed from existing IGG substrates and
 * optional topology adapter sources. The intent is institutional traceability,
 * not automation or analytics.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import type {
  HydratedTopologySources,
  InstitutionalTopologySourceAdapter,
} from '../adapters/topology-source-adapter'
import { hydrateTopologySources } from '../adapters/topology-source-adapter'
import { IggRelationshipKinds } from '../ontology/kinds'
import {
  assertNoProtectedKindsInReadSurface,
  redactProtected,
} from './protected'

const EPOCH = new Date(0).toISOString()

export type NormalizedRelationshipKind =
  | 'REPRESENTS'
  | 'DELEGATES_TO'
  | 'AFFILIATED_WITH'
  | 'GOVERNED_BY'
  | 'ESCALATED_TO'
  | 'REPORTS_TO'
  | 'PARTICIPATES_IN'
  | 'MEMBER_OF'
  | 'SUCCESSOR_TO'
  | 'CONTINUITY_LINKED_TO'

export interface NormalizedGovernanceRelationship {
  readonly id: string
  readonly kind: NormalizedRelationshipKind
  readonly fromEntityId: string
  readonly toEntityId: string
  readonly occurredAt: string
  readonly status: string
  readonly chronologyRef: string
  readonly evidenceRefs: readonly string[]
  readonly uncertainty: 'explicit' | 'ambiguous'
  readonly provenance: {
    readonly source: string
    readonly sourceId: string
  }
}

export interface HydratedLineageChain {
  readonly rootEntityId: string
  readonly chainEntityIds: readonly string[]
  readonly incomplete: boolean
  readonly relationshipKinds: readonly NormalizedRelationshipKind[]
  readonly lastObservedAt: string
}

export interface EnrichedChronologyEntry {
  readonly id: string
  readonly occurredAt: string
  readonly entityId: string
  readonly kind: 'decision' | 'relationship' | 'continuity'
  readonly summary: string
  readonly relationshipRef?: string
  readonly decisionRef?: string
  readonly chronologyRef: string
  readonly evidenceRefs: readonly string[]
  readonly provenance: {
    readonly source: string
    readonly sourceId: string
  }
}

export interface ContinuityProjection {
  readonly entityId: string
  readonly pathwayEntityIds: readonly string[]
  readonly unresolvedTransitions: number
  readonly orphanedRepresentationChains: number
  readonly continuityLinkedEvidenceRefs: readonly string[]
  readonly lastTransitionAt: string
}

export interface HydrationExplainabilityRecord {
  readonly relationshipId: string
  readonly sourceRefs: readonly string[]
  readonly chronologyRefs: readonly string[]
  readonly relationshipRefs: readonly string[]
  readonly continuityRefs: readonly string[]
  readonly evidenceRefs: readonly string[]
}

export interface HydratedGovernanceTopology {
  readonly generatedAt: string
  readonly relationships: readonly NormalizedGovernanceRelationship[]
  readonly lineageChains: readonly HydratedLineageChain[]
  readonly chronology: readonly EnrichedChronologyEntry[]
  readonly continuityProjections: readonly ContinuityProjection[]
  readonly explainability: readonly HydrationExplainabilityRecord[]
  readonly topology: {
    readonly federationTopology: readonly string[]
    readonly localAffiliationStructures: readonly string[]
    readonly representationHierarchies: readonly string[]
    readonly delegationTopology: readonly string[]
    readonly governanceAncestryTrees: readonly string[]
    readonly committeeTopology: readonly string[]
    readonly continuityLinkedGovernanceStructures: readonly string[]
  }
  readonly stats: {
    readonly redactedProtectedRelationships: number
    readonly normalizedRelationshipCount: number
    readonly lineageChainCount: number
    readonly chronologyEntryCount: number
    readonly continuityProjectionCount: number
  }
}

function relationshipKindFromEdge(iggKind: string | undefined): NormalizedRelationshipKind | null {
  switch (iggKind) {
    case IggRelationshipKinds.REPRESENTS:
      return 'REPRESENTS'
    case IggRelationshipKinds.DELEGATES_TO:
      return 'DELEGATES_TO'
    case IggRelationshipKinds.AFFILIATED_WITH:
      return 'AFFILIATED_WITH'
    case IggRelationshipKinds.GOVERNED_BY:
      return 'GOVERNED_BY'
    case IggRelationshipKinds.ESCALATED_TO:
      return 'ESCALATED_TO'
    case IggRelationshipKinds.MEMBER_OF:
      return 'MEMBER_OF'
    case IggRelationshipKinds.PARENT_OF:
      return 'REPORTS_TO'
    case IggRelationshipKinds.SUPERSEDES:
      return 'SUCCESSOR_TO'
    case IggRelationshipKinds.DEPENDS_ON:
    case IggRelationshipKinds.INFORMED_BY:
    case IggRelationshipKinds.TRIGGERED_BY:
      return 'CONTINUITY_LINKED_TO'
    default:
      return null
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function edgeIggKind(edge: EntityEdge): string | undefined {
  return asString((edge.metadata as Record<string, unknown> | undefined)?.iggKind)
}

function edgeOccurredAt(edge: EntityEdge): string {
  return (
    asString((edge.metadata as Record<string, unknown> | undefined)?.occurredAt) ?? EPOCH
  )
}

function edgeEvidenceRefs(edge: EntityEdge): readonly string[] {
  return asStringArray((edge.metadata as Record<string, unknown> | undefined)?.evidenceRefs)
}

function isProtectedTopologyMetadata(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) return false
  const serialized = JSON.stringify(meta).toLowerCase()
  return (
    serialized.includes('class_b') ||
    serialized.includes('reserved_matter') ||
    serialized.includes('veto') ||
    serialized.includes('founder_control') ||
    serialized.includes('protected_pathway')
  )
}

export function normalizeGovernanceRelationships(input: {
  readonly edges: readonly EntityEdge[]
  readonly topologySources?: Pick<
    HydratedTopologySources,
    | 'delegationChains'
    | 'representationAssignments'
    | 'proceduralEscalations'
    | 'committeeStructures'
    | 'governanceCenterSources'
  >
}): readonly NormalizedGovernanceRelationship[] {
  const relationships: NormalizedGovernanceRelationship[] = []

  for (const edge of input.edges) {
    const kind = relationshipKindFromEdge(edgeIggKind(edge))
    if (!kind) continue
    const metadata = edge.metadata as Record<string, unknown> | undefined
    if (isProtectedTopologyMetadata(metadata)) continue

    const mapped =
      kind === 'REPORTS_TO'
        ? {
            fromEntityId: edge.targetEntityId,
            toEntityId: edge.sourceEntityId,
          }
        : {
            fromEntityId: edge.sourceEntityId,
            toEntityId: edge.targetEntityId,
          }

    relationships.push({
      id: `norm:${edge.id}`,
      kind,
      fromEntityId: mapped.fromEntityId,
      toEntityId: mapped.toEntityId,
      occurredAt: edgeOccurredAt(edge),
      status: asString(metadata?.status) ?? 'observed',
      chronologyRef: `chronology:edge:${edge.id}`,
      evidenceRefs: edgeEvidenceRefs(edge),
      uncertainty: metadata?.occurredAt ? 'explicit' : 'ambiguous',
      provenance: {
        source: 'edge',
        sourceId: edge.id,
      },
    })
  }

  const sources = input.topologySources
  if (!sources) return dedupeRelationships(relationships)

  for (const row of sources.delegationChains) {
    relationships.push({
      id: `norm:delegation:${row.id}`,
      kind: 'DELEGATES_TO',
      fromEntityId: row.fromEntityId,
      toEntityId: row.toEntityId,
      occurredAt: row.occurredAt ?? EPOCH,
      status: row.status,
      chronologyRef: `chronology:delegation:${row.id}`,
      evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
      uncertainty: row.occurredAt ? 'explicit' : 'ambiguous',
      provenance: {
        source: 'delegation-chain',
        sourceId: row.id,
      },
    })
  }

  for (const row of sources.representationAssignments) {
    relationships.push({
      id: `norm:representation:${row.id}`,
      kind: 'REPRESENTS',
      fromEntityId: row.representativeEntityId,
      toEntityId: row.representedEntityId,
      occurredAt: row.validFrom ?? EPOCH,
      status: row.status,
      chronologyRef: `chronology:representation:${row.id}`,
      evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
      uncertainty: row.validFrom ? 'explicit' : 'ambiguous',
      provenance: {
        source: 'representation-assignment',
        sourceId: row.id,
      },
    })
  }

  for (const row of sources.proceduralEscalations) {
    relationships.push({
      id: `norm:escalation:${row.id}`,
      kind: 'ESCALATED_TO',
      fromEntityId: row.fromEntityId,
      toEntityId: row.toEntityId,
      occurredAt: row.occurredAt ?? EPOCH,
      status: row.status,
      chronologyRef: `chronology:escalation:${row.id}`,
      evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
      uncertainty: row.occurredAt ? 'explicit' : 'ambiguous',
      provenance: {
        source: 'procedural-escalation',
        sourceId: row.id,
      },
    })
  }

  for (const row of sources.committeeStructures) {
    if (row.parentCommitteeEntityId) {
      relationships.push({
        id: `norm:committee-parent:${row.id}`,
        kind: 'PARTICIPATES_IN',
        fromEntityId: row.committeeEntityId,
        toEntityId: row.parentCommitteeEntityId,
        occurredAt: row.effectiveFrom ?? EPOCH,
        status: row.status,
        chronologyRef: `chronology:committee:${row.id}`,
        evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
        uncertainty: row.effectiveFrom ? 'explicit' : 'ambiguous',
        provenance: {
          source: 'committee-structure',
          sourceId: row.id,
        },
      })
    }
    if (row.governedByEntityId) {
      relationships.push({
        id: `norm:committee-governed:${row.id}`,
        kind: 'GOVERNED_BY',
        fromEntityId: row.committeeEntityId,
        toEntityId: row.governedByEntityId,
        occurredAt: row.effectiveFrom ?? EPOCH,
        status: row.status,
        chronologyRef: `chronology:committee-governed:${row.id}`,
        evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
        uncertainty: row.effectiveFrom ? 'explicit' : 'ambiguous',
        provenance: {
          source: 'committee-structure',
          sourceId: row.id,
        },
      })
    }
  }

  for (const row of sources.governanceCenterSources) {
    relationships.push({
      id: `norm:governance-center:${row.id}`,
      kind: 'CONTINUITY_LINKED_TO',
      fromEntityId: row.sourceEntityId,
      toEntityId: row.targetEntityId,
      occurredAt: row.occurredAt ?? EPOCH,
      status: row.status,
      chronologyRef: `chronology:governance-center:${row.id}`,
      evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
      uncertainty: row.occurredAt ? 'explicit' : 'ambiguous',
      provenance: {
        source: 'governance-center',
        sourceId: row.id,
      },
    })
  }

  return dedupeRelationships(relationships)
}

function dedupeRelationships(
  rows: readonly NormalizedGovernanceRelationship[],
): readonly NormalizedGovernanceRelationship[] {
  const seen = new Set<string>()
  const out: NormalizedGovernanceRelationship[] = []
  for (const row of rows) {
    const key = `${row.kind}:${row.fromEntityId}:${row.toEntityId}:${row.occurredAt}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function hydrateInstitutionalLineage(
  relationships: readonly NormalizedGovernanceRelationship[],
): readonly HydratedLineageChain[] {
  const chainKinds = new Set<NormalizedRelationshipKind>([
    'SUCCESSOR_TO',
    'DELEGATES_TO',
    'REPRESENTS',
  ])
  const bySource = new Map<string, NormalizedGovernanceRelationship[]>()
  const hasIncoming = new Set<string>()

  for (const rel of relationships) {
    if (!chainKinds.has(rel.kind)) continue
    const list = bySource.get(rel.fromEntityId) ?? []
    list.push(rel)
    bySource.set(rel.fromEntityId, list)
    hasIncoming.add(rel.toEntityId)
  }

  const roots = new Set<string>()
  for (const rel of relationships) {
    if (!chainKinds.has(rel.kind)) continue
    if (!hasIncoming.has(rel.fromEntityId)) roots.add(rel.fromEntityId)
  }

  const chains: HydratedLineageChain[] = []
  for (const root of roots) {
    const visited = new Set<string>([root])
    const chain: string[] = [root]
    const kinds: NormalizedRelationshipKind[] = []
    let lastObservedAt = EPOCH
    let cursor = root

    while (bySource.has(cursor)) {
      const options = bySource.get(cursor)!
      const next = [...options].sort((a, b) =>
        a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
      )[0]!
      if (visited.has(next.toEntityId)) break
      visited.add(next.toEntityId)
      chain.push(next.toEntityId)
      kinds.push(next.kind)
      if (next.occurredAt > lastObservedAt) lastObservedAt = next.occurredAt
      cursor = next.toEntityId
    }

    const incomplete = !bySource.has(cursor)
    chains.push({
      rootEntityId: root,
      chainEntityIds: chain,
      incomplete,
      relationshipKinds: kinds,
      lastObservedAt,
    })
  }

  return chains
}

export function enrichInstitutionalChronology(input: {
  readonly decisions: readonly DecisionNode[]
  readonly relationships: readonly NormalizedGovernanceRelationship[]
  readonly topologySources?: Pick<HydratedTopologySources, 'continuityRecords'>
}): readonly EnrichedChronologyEntry[] {
  const entries: EnrichedChronologyEntry[] = []

  for (const decision of input.decisions) {
    entries.push({
      id: `chronology:decision:${decision.id}`,
      occurredAt: decision.executedAt ?? decision.createdAt ?? EPOCH,
      entityId: decision.entityId,
      kind: 'decision',
      summary: decision.summary ?? decision.id,
      decisionRef: decision.id,
      chronologyRef: `chronology:decision:${decision.id}`,
      evidenceRefs: decision.evidenceRefs ?? [],
      provenance: {
        source: 'decision',
        sourceId: decision.id,
      },
    })
  }

  for (const relationship of input.relationships) {
    entries.push({
      id: `chronology:relationship:${relationship.id}`,
      occurredAt: relationship.occurredAt,
      entityId: relationship.fromEntityId,
      kind: 'relationship',
      summary: `${relationship.kind} ${relationship.fromEntityId} -> ${relationship.toEntityId}`,
      relationshipRef: relationship.id,
      chronologyRef: relationship.chronologyRef,
      evidenceRefs: relationship.evidenceRefs,
      provenance: relationship.provenance,
    })
  }

  for (const row of input.topologySources?.continuityRecords ?? []) {
    entries.push({
      id: `chronology:continuity:${row.id}`,
      occurredAt: row.occurredAt ?? EPOCH,
      entityId: row.entityId,
      kind: 'continuity',
      summary: `${row.continuityType} continuity record`,
      chronologyRef: `chronology:continuity:${row.id}`,
      evidenceRefs: asStringArray(row.metadata?.evidenceRefs),
      provenance: {
        source: 'continuity-record',
        sourceId: row.id,
      },
    })
  }

  return [...entries].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.id.localeCompare(b.id),
  )
}

export function hydrateContinuityProjections(input: {
  readonly relationships: readonly NormalizedGovernanceRelationship[]
  readonly chronology: readonly EnrichedChronologyEntry[]
}): readonly ContinuityProjection[] {
  const byEntity = new Map<string, NormalizedGovernanceRelationship[]>()
  for (const rel of input.relationships) {
    const list = byEntity.get(rel.fromEntityId) ?? []
    list.push(rel)
    byEntity.set(rel.fromEntityId, list)
  }

  const projections: ContinuityProjection[] = []
  for (const [entityId, rels] of byEntity.entries()) {
    const pathway = new Set<string>([entityId])
    let unresolvedTransitions = 0
    let orphanedRepresentationChains = 0
    const evidenceRefs = new Set<string>()
    let lastTransitionAt = EPOCH

    for (const rel of rels) {
      pathway.add(rel.toEntityId)
      for (const ref of rel.evidenceRefs) evidenceRefs.add(ref)
      if (rel.occurredAt > lastTransitionAt) lastTransitionAt = rel.occurredAt
      if (rel.status !== 'active' && rel.status !== 'observed' && rel.status !== 'resolved') {
        unresolvedTransitions += 1
      }
      if (rel.kind === 'REPRESENTS' && rel.uncertainty === 'ambiguous') {
        orphanedRepresentationChains += 1
      }
    }

    const hasChronology = input.chronology.some((entry) => entry.entityId === entityId)
    if (!hasChronology) unresolvedTransitions += 1

    projections.push({
      entityId,
      pathwayEntityIds: [...pathway],
      unresolvedTransitions,
      orphanedRepresentationChains,
      continuityLinkedEvidenceRefs: [...evidenceRefs].sort(),
      lastTransitionAt,
    })
  }

  return projections
}

export function buildHydrationExplainability(
  relationships: readonly NormalizedGovernanceRelationship[],
  chronology: readonly EnrichedChronologyEntry[],
  continuity: readonly ContinuityProjection[],
): readonly HydrationExplainabilityRecord[] {
  const continuityByEntity = new Map<string, ContinuityProjection>()
  for (const projection of continuity) continuityByEntity.set(projection.entityId, projection)

  return relationships.map((relationship) => {
    const chronologyRefs = chronology
      .filter((entry) => entry.entityId === relationship.fromEntityId)
      .map((entry) => entry.chronologyRef)

    const continuityRefs = continuityByEntity.has(relationship.fromEntityId)
      ? [`continuity:${relationship.fromEntityId}`]
      : []

    const sourceRef = `${relationship.provenance.source}:${relationship.provenance.sourceId}`

    return {
      relationshipId: relationship.id,
      sourceRefs: [sourceRef],
      chronologyRefs,
      relationshipRefs: [relationship.id],
      continuityRefs,
      evidenceRefs: [...relationship.evidenceRefs],
    }
  })
}

export function hydrateGovernanceTopologyInfrastructure(input: {
  readonly edges: readonly EntityEdge[]
  readonly decisions: readonly DecisionNode[]
  readonly topologySources?: Pick<
    HydratedTopologySources,
    | 'committeeStructures'
    | 'delegationChains'
    | 'representationAssignments'
    | 'continuityRecords'
    | 'proceduralEscalations'
    | 'governanceCenterSources'
  >
}): HydratedGovernanceTopology {
  const preCount = input.edges.length

  const safe = redactProtected({
    edges: input.edges,
    decisions: input.decisions,
    nodes: [],
  })

  assertNoProtectedKindsInReadSurface({
    edges: safe.edges,
    decisions: safe.decisions,
    nodes: safe.nodes,
  })

  const normalized = normalizeGovernanceRelationships({
    edges: safe.edges ?? [],
    topologySources: input.topologySources,
  })

  const lineage = hydrateInstitutionalLineage(normalized)
  const chronology = enrichInstitutionalChronology({
    decisions: safe.decisions ?? [],
    relationships: normalized,
    topologySources: input.topologySources
      ? { continuityRecords: input.topologySources.continuityRecords ?? [] }
      : undefined,
  })
  const continuity = hydrateContinuityProjections({
    relationships: normalized,
    chronology,
  })
  const explainability = buildHydrationExplainability(normalized, chronology, continuity)

  const federationTopology = normalized
    .filter((rel) => rel.kind === 'AFFILIATED_WITH')
    .map((rel) => rel.toEntityId)
  const localAffiliationStructures = normalized
    .filter((rel) => rel.kind === 'AFFILIATED_WITH')
    .map((rel) => `${rel.fromEntityId}->${rel.toEntityId}`)
  const representationHierarchies = normalized
    .filter((rel) => rel.kind === 'REPRESENTS')
    .map((rel) => `${rel.fromEntityId}->${rel.toEntityId}`)
  const delegationTopology = normalized
    .filter((rel) => rel.kind === 'DELEGATES_TO')
    .map((rel) => `${rel.fromEntityId}->${rel.toEntityId}`)
  const governanceAncestryTrees = lineage.map((chain) => chain.chainEntityIds.join(' -> '))
  const committeeTopology = normalized
    .filter((rel) => rel.kind === 'PARTICIPATES_IN' || rel.kind === 'GOVERNED_BY')
    .map((rel) => `${rel.fromEntityId}->${rel.toEntityId}`)
  const continuityLinkedGovernanceStructures = normalized
    .filter((rel) => rel.kind === 'CONTINUITY_LINKED_TO' || rel.kind === 'SUCCESSOR_TO')
    .map((rel) => `${rel.fromEntityId}->${rel.toEntityId}`)

  return {
    generatedAt: new Date().toISOString(),
    relationships: normalized,
    lineageChains: lineage,
    chronology,
    continuityProjections: continuity,
    explainability,
    topology: {
      federationTopology,
      localAffiliationStructures,
      representationHierarchies,
      delegationTopology,
      governanceAncestryTrees,
      committeeTopology,
      continuityLinkedGovernanceStructures,
    },
    stats: {
      redactedProtectedRelationships: Math.max(0, preCount - (safe.edges?.length ?? 0)),
      normalizedRelationshipCount: normalized.length,
      lineageChainCount: lineage.length,
      chronologyEntryCount: chronology.length,
      continuityProjectionCount: continuity.length,
    },
  }
}

export async function hydrateGovernanceTopologyFromAdapter(
  adapter: InstitutionalTopologySourceAdapter,
): Promise<HydratedGovernanceTopology> {
  const sources = await hydrateTopologySources(adapter)

  return hydrateGovernanceTopologyInfrastructure({
    edges: [],
    decisions: [],
    topologySources: {
      committeeStructures: sources.committeeStructures,
      delegationChains: sources.delegationChains,
      representationAssignments: sources.representationAssignments,
      continuityRecords: sources.continuityRecords,
      proceduralEscalations: sources.proceduralEscalations,
      governanceCenterSources: sources.governanceCenterSources,
    },
  })
}
