/**
 * @nzila/platform-decision-graph — Operations
 *
 * Core operations for creating decision nodes, linking them,
 * and traversing decision trails.
 */
import type {
  DecisionNode,
  DecisionEdge,
  DecisionTrail,
  DecisionGraphStore,
  CreateDecisionNodeInput,
  CreateDecisionEdgeInput,
} from './types'
import { DecisionStatuses, DecisionEdgeTypes } from './types'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── ID Generation ───────────────────────────────────────────────────────────

let idCounter = 0
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  idCounter++
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`
}

// ── Create Decision Node ────────────────────────────────────────────────────

export async function createDecisionNode(
  store: DecisionGraphStore,
  input: CreateDecisionNodeInput,
): Promise<DecisionNode> {
  const now = new Date().toISOString()
  const node: DecisionNode = {
    id: generateId(),
    tenantId: input.tenantId,
    decisionType: input.decisionType as DecisionNode['decisionType'],
    status: DecisionStatuses.PENDING,
    actorType: input.actorType as DecisionNode['actorType'],
    actorId: input.actorId,
    entityType: input.entityType as OntologyEntityType,
    resourceId: input.resourceId,
    summary: input.summary,
    outcome: input.outcome,
    confidence: input.confidence,
    policyRefs: input.policyRefs,
    evidenceRefs: input.evidenceRefs,
    knowledgeRefs: input.knowledgeRefs,
    reasoning: input.reasoning,
    createdAt: now,
    expiresAt: input.expiresAt,
  }
  await store.persistNode(node)
  return node
}

// ── Link Decisions ──────────────────────────────────────────────────────────

export async function linkDecisions(
  store: DecisionGraphStore,
  input: CreateDecisionEdgeInput,
): Promise<DecisionEdge> {
  const edge: DecisionEdge = {
    id: generateId(),
    fromDecisionId: input.fromDecisionId,
    toDecisionId: input.toDecisionId,
    edgeType: input.edgeType as DecisionEdge['edgeType'],
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  }
  await store.persistEdge(edge)
  return edge
}

// ── Execute Decision ────────────────────────────────────────────────────────

export async function executeDecision(
  store: DecisionGraphStore,
  decisionId: string,
): Promise<void> {
  await store.updateNodeStatus(decisionId, DecisionStatuses.EXECUTED)
}

// ── Override Decision ───────────────────────────────────────────────────────

export async function overrideDecision(
  store: DecisionGraphStore,
  originalDecisionId: string,
  overrideInput: CreateDecisionNodeInput,
): Promise<{ override: DecisionNode; edge: DecisionEdge }> {
  await store.updateNodeStatus(originalDecisionId, DecisionStatuses.OVERRIDDEN)
  const override = await createDecisionNode(store, overrideInput)
  const edge = await linkDecisions(store, {
    fromDecisionId: override.id,
    toDecisionId: originalDecisionId,
    edgeType: DecisionEdgeTypes.OVERRIDES,
  })
  return { override, edge }
}

// ── Get Decision Trail ──────────────────────────────────────────────────────

/**
 * Build a decision trail by traversing all upstream decisions via BFS.
 */
export async function getDecisionTrail(
  store: DecisionGraphStore,
  decisionId: string,
): Promise<DecisionTrail> {
  const visited = new Set<string>()
  const visitedEdges = new Set<string>()
  const nodes: DecisionNode[] = []
  const edges: DecisionEdge[] = []
  const queue: Array<{ id: string; depth: number }> = [
    { id: decisionId, depth: 0 },
  ]
  let maxDepth = 0

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = await store.getNode(id)
    if (!node) continue
    nodes.push(node)
    if (depth > maxDepth) maxDepth = depth

    const addEdge = (edge: DecisionEdge) => {
      if (!visitedEdges.has(edge.id)) {
        visitedEdges.add(edge.id)
        edges.push(edge)
      }
    }

    // Traverse incoming edges (decisions that fed into this one)
    const incomingEdges = await store.getEdgesTo(id)
    for (const edge of incomingEdges) {
      addEdge(edge)
      if (!visited.has(edge.fromDecisionId)) {
        queue.push({ id: edge.fromDecisionId, depth: depth + 1 })
      }
    }

    // Traverse outgoing edges too (decisions this one triggered)
    const outgoingEdges = await store.getEdgesFrom(id)
    for (const edge of outgoingEdges) {
      addEdge(edge)
      if (!visited.has(edge.toDecisionId)) {
        queue.push({ id: edge.toDecisionId, depth: depth + 1 })
      }
    }
  }

  return {
    rootDecisionId: decisionId,
    nodes,
    edges,
    totalDepth: maxDepth,
  }
}

// ── Get Decisions for Entity ────────────────────────────────────────────────

export async function getDecisionsForEntity(
  store: DecisionGraphStore,
  entityType: OntologyEntityType,
  resourceId: string,
): Promise<readonly DecisionNode[]> {
  return store.getNodesByEntity(entityType, resourceId)
}
