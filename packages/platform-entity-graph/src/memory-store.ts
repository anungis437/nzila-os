/**
 * @nzila/platform-entity-graph — In-Memory Graph Store
 *
 * Reference implementation for testing and development.
 * Production usage should implement EntityGraphStore against a database.
 */
import type { OntologyEntityType } from '@nzila/platform-ontology'
import type { EntityNode, EntityEdge, EntityGraphStore } from './types'

export function createInMemoryGraphStore(): EntityGraphStore {
  const nodes = new Map<string, EntityNode>()
  const edges = new Map<string, EntityEdge>()

  const nodeKey = (tenantId: string, entityType: OntologyEntityType, resourceId: string) =>
    `${tenantId}:${entityType}:${resourceId}`

  return {
    async getNode(tenantId, entityType, resourceId) {
      return nodes.get(nodeKey(tenantId, entityType, resourceId))
    },

    async getEdges(tenantId, entityType, resourceId) {
      return Array.from(edges.values()).filter(
        (e) =>
          (e.sourceEntityType === entityType && e.sourceEntityId === resourceId) ||
          (e.targetEntityType === entityType && e.targetEntityId === resourceId),
      )
    },

    async addNode(node) {
      nodes.set(nodeKey(node.tenantId, node.entityType, node.resourceId), node)
    },

    async addEdge(edge) {
      edges.set(edge.id, edge)
    },

    async removeEdge(edgeId) {
      edges.delete(edgeId)
    },
  }
}
