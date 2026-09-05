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

import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { organizations, organizationRelationships } from '@/db/schema-organizations'
import { logger } from '@/lib/logger'

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

// ── Substrate adapter ───────────────────────────────────────────────────────

const IGG_KIND_BY_ORG_TYPE: Readonly<Record<string, string>> = {
  platform: IggEntityKinds.PLATFORM,
  congress: IggEntityKinds.CONGRESS,
  federation: IggEntityKinds.FEDERATION,
  union: IggEntityKinds.UNION,
  local: IggEntityKinds.LOCAL,
  region: IggEntityKinds.REGION,
  district: IggEntityKinds.DISTRICT,
}

const IGG_KIND_BY_RELATIONSHIP_TYPE: Readonly<Record<string, string>> = {
  affiliate: IggRelationshipKinds.AFFILIATED_WITH,
  federation: IggRelationshipKinds.AFFILIATED_WITH,
  local: IggRelationshipKinds.AFFILIATED_WITH,
  chapter: IggRelationshipKinds.AFFILIATED_WITH,
  region: IggRelationshipKinds.AFFILIATED_WITH,
  district: IggRelationshipKinds.AFFILIATED_WITH,
  joint_council: IggRelationshipKinds.AFFILIATED_WITH,
  merged_from: IggRelationshipKinds.SUPERSEDES,
  split_from: IggRelationshipKinds.SUPERSEDES,
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString()
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString()
  return parsed.toISOString()
}

function normalizeStatus(status: string | null | undefined): string {
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  if (status === 'archived') return 'archived'
  if (status === 'suspended') return 'suspended'
  return 'active'
}

/**
 * Returns the raw institutional governance graph used by the topology
 * surfaces.
 */
export async function getInstitutionalGraph(): Promise<InstitutionalTimelineGraph> {
  try {
    // PR #752 round 8: this deliberately reads across ALL organizations
    // (no per-org filter) for the national/cross-affiliate topology view —
    // app-level access is now restricted to clc_staff/clc_executive/
    // system_admin (see lib/organizational-topology/access.ts). Execute
    // under withSystemContext so the DB-level boundary matches that
    // app-level authority instead of relying on ordinary tenant-RLS
    // routing to happen to allow a cross-org read.
    const [orgRows, relationshipRows] = await withSystemContext(async (_tx) =>
      Promise.all([db.select().from(organizations), db.select().from(organizationRelationships)]),
    )

    const nodes: InstitutionalTimelineGraph['nodes'] = orgRows.map((org) => ({
      entityType: 'Organization',
      entityId: org.id,
      tenantId: org.appId ?? org.id,
      canonicalName: org.displayName ?? org.name,
      status: normalizeStatus(org.status),
      metadata: {
        iggKind: IGG_KIND_BY_ORG_TYPE[org.organizationType] ?? IggEntityKinds.UNION,
        organizationType: org.organizationType,
        slug: org.slug,
        hierarchyLevel: org.hierarchyLevel,
        foundedAt: org.affiliationDate ? toIso(org.affiliationDate) : undefined,
        createdAt: toIso(org.createdAt),
      },
    }))

    const parentEdges: InstitutionalTimelineGraph['edges'] = orgRows
      .filter((org) => Boolean(org.parentId))
      .map((org) => ({
        id: `org-parent-${org.id}`,
        sourceEntityType: 'Organization',
        sourceEntityId: org.parentId as string,
        targetEntityType: 'Organization',
        targetEntityId: org.id,
        relationshipType: 'PARENT_OF',
        metadata: {
          iggKind: IggRelationshipKinds.PARENT_OF,
          effectiveAt: toIso(org.createdAt),
          summary: `Parent relationship established for ${org.displayName ?? org.name}`,
        },
      }))

    const explicitEdges: InstitutionalTimelineGraph['edges'] = relationshipRows.map((rel) => {
      const iggKind =
        IGG_KIND_BY_RELATIONSHIP_TYPE[rel.relationshipType] ??
        IggRelationshipKinds.AFFILIATED_WITH
      return {
        id: rel.id,
        sourceEntityType: 'Organization',
        sourceEntityId: rel.childOrgId,
        targetEntityType: 'Organization',
        targetEntityId: rel.parentOrgId,
        relationshipType:
          iggKind === IggRelationshipKinds.SUPERSEDES
            ? 'DEPENDS_ON'
            : 'BELONGS_TO',
        metadata: {
          ...(rel.metadata ?? {}),
          iggKind,
          relationshipType: rel.relationshipType,
          effectiveAt: toIso(rel.effectiveDate),
          endedAt: rel.endDate ? toIso(rel.endDate) : undefined,
          createdAt: toIso(rel.createdAt),
          summary: `Relationship ${rel.relationshipType} between ${rel.childOrgId} and ${rel.parentOrgId}`,
        },
      }
    })

    const decisions: InstitutionalTimelineGraph['decisions'] = relationshipRows.map((rel) => ({
      id: `org-rel-decision-${rel.id}`,
      tenantId: rel.parentOrgId,
      decisionType: 'policy_evaluation',
      status: 'executed',
      actorType: 'system',
      actorId: 'institutional-topology-adapter',
      entityType: 'Organization',
      entityId: rel.childOrgId,
      summary: `Recorded ${rel.relationshipType} relationship`,
      outcome: {
        iggCategory: 'institutional_relationship',
        iggEventKind: 'relationship_recorded',
        relationshipType: rel.relationshipType,
      },
      policyRefs: [],
      evidenceRefs: [],
      knowledgeRefs: [],
      createdAt: toIso(rel.createdAt),
      executedAt: toIso(rel.effectiveDate),
    }))

    return {
      nodes,
      edges: [...parentEdges, ...explicitEdges],
      decisions,
    }
  } catch (error) {
    logger.warn(
      '[organizational-topology] Failed to load institutional graph from persistence; returning empty graph',
      {
        error,
      },
    )
    return { nodes: [], edges: [], decisions: [] }
  }
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

function readEdgeKind(edge: { metadata?: any }): string | undefined {
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
