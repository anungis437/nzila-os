/**
 * @nzila/platform-entity-graph — Graph Traversal
 *
 * Provides graph traversal operations over an EntityGraphStore.
 * Pure logic — I/O delegated to store interface.
 */
import type { OntologyEntityType } from '@nzila/platform-ontology'
import type {
  EntityNode,
  EntityEdge,
  EntitySubgraph,
  RelationshipPath,
  NeighborResult,
  EntityGraphStore,
} from './types'

// ── Core Graph Operations ───────────────────────────────────────────────────

/**
 * Retrieve a single entity node from the graph.
 */
export async function getEntityNode(
  store: EntityGraphStore,
  tenantId: string,
  entityType: OntologyEntityType,
  resourceId: string,
): Promise<EntityNode | undefined> {
  return store.getNode(tenantId, entityType, resourceId)
}

/**
 * Get all neighbors of an entity (both incoming and outgoing edges).
 */
export async function getEntityNeighbors(
  store: EntityGraphStore,
  tenantId: string,
  entityType: OntologyEntityType,
  resourceId: string,
): Promise<readonly NeighborResult[]> {
  const edges = await store.getEdges(tenantId, entityType, resourceId)
  const results: NeighborResult[] = []

  for (const edge of edges) {
    const isSource =
      edge.sourceEntityType === entityType && edge.sourceEntityId === resourceId
    const neighborType = isSource ? edge.targetEntityType : edge.sourceEntityType
    const neighborId = isSource ? edge.targetEntityId : edge.sourceEntityId

    const node = await store.getNode(tenantId, neighborType, neighborId)
    if (node) {
      results.push({
        node,
        edge,
        direction: isSource ? 'outgoing' : 'incoming',
      })
    }
  }

  return results
}

/**
 * Build a subgraph by traversing from a seed node up to a given depth.
 * Uses BFS to avoid deep recursion.
 */
export async function buildEntitySubgraph(
  store: EntityGraphStore,
  tenantId: string,
  seedType: OntologyEntityType,
  seedId: string,
  maxDepth: number = 2,
): Promise<EntitySubgraph | undefined> {
  const seedNode = await store.getNode(tenantId, seedType, seedId)
  if (!seedNode) return undefined

  const visitedNodes = new Map<string, EntityNode>()
  const collectedEdges = new Map<string, EntityEdge>()

  const nodeKey = (n: EntityNode) => `${n.entityType}:${n.resourceId}`
  visitedNodes.set(nodeKey(seedNode), seedNode)

  let frontier: EntityNode[] = [seedNode]

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const nextFrontier: EntityNode[] = []

    for (const current of frontier) {
      const edges = await store.getEdges(
        tenantId,
        current.entityType,
        current.resourceId,
      )

      for (const edge of edges) {
        if (collectedEdges.has(edge.id)) continue
        collectedEdges.set(edge.id, edge)

        const isSource =
          edge.sourceEntityType === current.entityType &&
          edge.sourceEntityId === current.resourceId
        const neighborType = isSource
          ? edge.targetEntityType
          : edge.sourceEntityType
        const neighborId = isSource
          ? edge.targetEntityId
          : edge.sourceEntityId

        const neighborNode = await store.getNode(tenantId, neighborType, neighborId)
        if (!neighborNode) continue

        const key = nodeKey(neighborNode)
        if (!visitedNodes.has(key)) {
          visitedNodes.set(key, neighborNode)
          nextFrontier.push(neighborNode)
        }
      }
    }

    frontier = nextFrontier
  }

  return {
    seedNode,
    nodes: Array.from(visitedNodes.values()),
    edges: Array.from(collectedEdges.values()),
    depth: maxDepth,
  }
}

/**
 * Find a relationship path between two entities using BFS.
 * Returns the shortest path or undefined if no path exists.
 */
export async function resolveRelationshipPath(
  store: EntityGraphStore,
  tenantId: string,
  fromType: OntologyEntityType,
  fromId: string,
  toType: OntologyEntityType,
  toId: string,
  maxDepth: number = 5,
): Promise<RelationshipPath | undefined> {
  const fromNode = await store.getNode(tenantId, fromType, fromId)
  const toNode = await store.getNode(tenantId, toType, toId)
  if (!fromNode || !toNode) return undefined

  const toKey = `${toType}:${toId}`

  // BFS path search
  interface QueueItem {
    node: EntityNode
    pathEdges: EntityEdge[]
  }

  const visited = new Set<string>()
  const queue: QueueItem[] = [{ node: fromNode, pathEdges: [] }]
  visited.add(`${fromType}:${fromId}`)

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.pathEdges.length >= maxDepth) continue

    const edges = await store.getEdges(
      tenantId,
      current.node.entityType,
      current.node.resourceId,
    )

    for (const edge of edges) {
      const isSource =
        edge.sourceEntityType === current.node.entityType &&
        edge.sourceEntityId === current.node.resourceId
      const neighborType = isSource
        ? edge.targetEntityType
        : edge.sourceEntityType
      const neighborId = isSource
        ? edge.targetEntityId
        : edge.sourceEntityId

      const key = `${neighborType}:${neighborId}`

      if (key === toKey) {
        const pathEdges = [...current.pathEdges, edge]
        return {
          from: fromNode,
          to: toNode,
          path: pathEdges,
          length: pathEdges.length,
        }
      }

      if (!visited.has(key)) {
        visited.add(key)
        const neighborNode = await store.getNode(tenantId, neighborType, neighborId)
        if (neighborNode) {
          queue.push({
            node: neighborNode,
            pathEdges: [...current.pathEdges, edge],
          })
        }
      }
    }
  }

  return undefined
}
