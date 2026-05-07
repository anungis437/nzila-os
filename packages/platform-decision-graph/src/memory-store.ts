/**
 * @nzila/platform-decision-graph — In-Memory Store
 */
import type {
  DecisionNode,
  DecisionEdge,
  DecisionGraphStore,
} from './types'
import type { OntologyEntityType as _OntologyEntityType } from '@nzila/platform-ontology'

export function createInMemoryDecisionStore(): DecisionGraphStore {
  const nodes = new Map<string, DecisionNode>()
  const edges: DecisionEdge[] = []

  return {
    async persistNode(node) {
      nodes.set(node.id, node)
    },
    async persistEdge(edge) {
      edges.push(edge)
    },
    async getNode(id) {
      return nodes.get(id)
    },
    async getEdgesFrom(decisionId) {
      return edges.filter((e) => e.fromDecisionId === decisionId)
    },
    async getEdgesTo(decisionId) {
      return edges.filter((e) => e.toDecisionId === decisionId)
    },
    async getNodesByEntity(entityType, resourceId) {
      return Array.from(nodes.values()).filter(
        (n) => n.entityType === entityType && n.resourceId === resourceId,
      )
    },
    async updateNodeStatus(id, status) {
      const existing = nodes.get(id)
      if (existing) {
        nodes.set(id, {
          ...existing,
          status,
          executedAt:
            status === 'executed' ? new Date().toISOString() : existing.executedAt,
        })
      }
    },
  }
}
