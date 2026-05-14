/**
 * Governance — Read-Only Query Surfaces
 *
 * Permitted query categories per Phase 3 architecture audit:
 *   - Lineage (`lineageChain` in ./chronology)
 *   - Hierarchy (`hierarchyAncestors`, `hierarchyDescendants`)
 *   - Continuity (`continuityCohort`)
 *   - Eligibility (`eligibleVotersFor`)
 *   - Chronology (`chronologyForEntity` in ./chronology)
 *   - Dependency mapping (`dependencyClosure`)
 *
 * FORBIDDEN (and not implemented):
 *   - Predictive / influence / caucus / profiling / behavioural / optimization queries.
 */
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import { IggRelationshipKinds } from '../ontology/kinds'

function edgeKind(e: EntityEdge): string | undefined {
  return (e.metadata as Record<string, unknown> | undefined)?.iggKind as
    | string
    | undefined
}

/** Return ancestor entity IDs by walking PARENT_OF edges upwards. */
export function hierarchyAncestors(
  entityId: string,
  edges: readonly EntityEdge[],
): readonly string[] {
  const parentOf = new Map<string, string>()
  for (const e of edges) {
    if (edgeKind(e) === IggRelationshipKinds.PARENT_OF) {
      // source PARENT_OF target → target's parent is source
      parentOf.set(e.targetEntityId, e.sourceEntityId)
    }
  }
  const seen = new Set<string>([entityId])
  const out: string[] = []
  let cursor = entityId
  while (parentOf.has(cursor)) {
    const parent = parentOf.get(cursor)!
    if (seen.has(parent)) break
    seen.add(parent)
    out.push(parent)
    cursor = parent
  }
  return out
}

/** Return descendant entity IDs by BFS over PARENT_OF edges. */
export function hierarchyDescendants(
  entityId: string,
  edges: readonly EntityEdge[],
): readonly string[] {
  const childrenOf = new Map<string, string[]>()
  for (const e of edges) {
    if (edgeKind(e) === IggRelationshipKinds.PARENT_OF) {
      const list = childrenOf.get(e.sourceEntityId) ?? []
      list.push(e.targetEntityId)
      childrenOf.set(e.sourceEntityId, list)
    }
  }
  const seen = new Set<string>([entityId])
  const out: string[] = []
  const queue: string[] = [entityId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const child of childrenOf.get(id) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      out.push(child)
      queue.push(child)
    }
  }
  return out
}

/**
 * Return all entities currently AFFILIATED_WITH the given organization.
 * Useful for continuity / cohort views (which locals belong to a federation,
 * which committees serve a congress).
 */
export function continuityCohort(
  organizationId: string,
  edges: readonly EntityEdge[],
): readonly string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of edges) {
    if (
      edgeKind(e) === IggRelationshipKinds.AFFILIATED_WITH &&
      e.targetEntityId === organizationId &&
      !seen.has(e.sourceEntityId)
    ) {
      seen.add(e.sourceEntityId)
      out.push(e.sourceEntityId)
    }
  }
  return out
}

/**
 * Return entity IDs eligible to vote in the given session, derived from
 * ELIGIBLE_TO_VOTE_IN edges. Delegation is intentionally NOT applied here —
 * use `resolveDelegationChains` separately if delegated weight is desired.
 */
export function eligibleVotersFor(
  votingSessionId: string,
  edges: readonly EntityEdge[],
): readonly string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of edges) {
    if (
      edgeKind(e) === IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN &&
      e.targetEntityId === votingSessionId &&
      !seen.has(e.sourceEntityId)
    ) {
      seen.add(e.sourceEntityId)
      out.push(e.sourceEntityId)
    }
  }
  return out
}

/**
 * Compute the transitive closure of DEPENDS_ON edges starting from
 * `entityId`. Used to answer "what does this institutional state depend on?"
 * without exposing protected escalation/veto edges.
 */
export function dependencyClosure(
  entityId: string,
  edges: readonly EntityEdge[],
): readonly string[] {
  const dependsOn = new Map<string, string[]>()
  for (const e of edges) {
    if (edgeKind(e) === IggRelationshipKinds.DEPENDS_ON) {
      const list = dependsOn.get(e.sourceEntityId) ?? []
      list.push(e.targetEntityId)
      dependsOn.set(e.sourceEntityId, list)
    }
  }
  const seen = new Set<string>([entityId])
  const out: string[] = []
  const queue = [entityId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const dep of dependsOn.get(cur) ?? []) {
      if (seen.has(dep)) continue
      seen.add(dep)
      out.push(dep)
      queue.push(dep)
    }
  }
  return out
}

/** Convenience: filter nodes by IGG kind metadata. */
export function nodesOfIggKind(
  nodes: readonly EntityNode[],
  kind: string,
): readonly EntityNode[] {
  return nodes.filter(
    (n) =>
      ((n.metadata as Record<string, unknown> | undefined)?.iggKind as
        | string
        | undefined) === kind,
  )
}
