/**
 * Governance — Chronology & Lineage Utilities
 *
 * Pure functions over substrate `DecisionNode` and `EntityEdge` arrays that
 * answer "How did this institutional state emerge?" — NOT
 * "How do we optimize governance?".
 *
 * No predictive scoring, no influence ranking, no behavioural modelling.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import { IggRelationshipKinds } from '../ontology/kinds.js'

export interface ChronologyEntry {
  readonly decisionId: string
  readonly entityId: string
  readonly occurredAt: string
  readonly summary: string
  readonly category: string | undefined
  readonly status: string
}

/**
 * Order decisions chronologically (ascending). Decisions with no
 * `createdAt`/`executedAt` sort last in stable input order.
 */
export function orderDecisionsChronologically(
  decisions: readonly DecisionNode[],
): readonly DecisionNode[] {
  const indexed = decisions.map((d, idx) => ({ d, idx, ts: timestampOf(d) }))
  indexed.sort((a, b) => {
    if (a.ts === null && b.ts === null) return a.idx - b.idx
    if (a.ts === null) return 1
    if (b.ts === null) return -1
    if (a.ts === b.ts) return a.idx - b.idx
    return a.ts < b.ts ? -1 : 1
  })
  return indexed.map((entry) => entry.d)
}

/**
 * Project a decision sequence into a thin chronology view bound to a
 * specific subject entity.
 */
export function chronologyForEntity(
  entityId: string,
  decisions: readonly DecisionNode[],
): readonly ChronologyEntry[] {
  return orderDecisionsChronologically(
    decisions.filter((d) => d.entityId === entityId),
  ).map((d) => ({
    decisionId: d.id,
    entityId: d.entityId,
    occurredAt:
      d.executedAt ?? d.createdAt ?? new Date(0).toISOString(),
    summary: d.summary ?? '',
    category:
      (d.outcome as Record<string, unknown> | undefined)?.iggCategory as
        | string
        | undefined,
    status: d.status,
  }))
}

/**
 * Walk SUPERSEDES / OVERRIDES edges to compute a lineage chain for an
 * entity (e.g. CBA v2 supersedes v1 supersedes v0).
 *
 * Returns entity IDs in oldest → newest order. Cycles are broken
 * defensively; the caller never receives an infinite chain.
 */
export function lineageChain(
  startEntityId: string,
  edges: readonly EntityEdge[],
): readonly string[] {
  const successorOf = new Map<string, string>() // older → newer
  const predecessorOf = new Map<string, string>() // newer → older
  for (const e of edges) {
    const kind = (e.metadata as Record<string, unknown> | undefined)?.iggKind as
      | string
      | undefined
    if (
      kind === IggRelationshipKinds.SUPERSEDES ||
      kind === IggRelationshipKinds.OVERRIDES
    ) {
      // Convention: source supersedes target → target is older, source is newer.
      predecessorOf.set(e.sourceEntityId, e.targetEntityId)
      successorOf.set(e.targetEntityId, e.sourceEntityId)
    }
  }

  // Walk backwards to find oldest ancestor.
  const seenBack = new Set<string>([startEntityId])
  let oldest = startEntityId
  while (predecessorOf.has(oldest)) {
    const prev = predecessorOf.get(oldest)!
    if (seenBack.has(prev)) break
    seenBack.add(prev)
    oldest = prev
  }

  // Walk forwards from oldest to newest.
  const chain: string[] = [oldest]
  const seenForward = new Set<string>([oldest])
  let cursor = oldest
  while (successorOf.has(cursor)) {
    const next = successorOf.get(cursor)!
    if (seenForward.has(next)) break
    seenForward.add(next)
    chain.push(next)
    cursor = next
  }
  return chain
}

function timestampOf(d: DecisionNode): string | null {
  return d.executedAt ?? d.createdAt ?? null
}
