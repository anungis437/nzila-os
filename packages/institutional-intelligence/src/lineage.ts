import { randomUUID } from 'node:crypto'
import {
  lineageNodeSchema,
  lineageEdgeSchema,
  lineageSnapshotSchema,
  type LineageNode,
  type LineageEdge,
  type LineageSnapshot,
} from './schema.js'
import type { InstitutionalIntelligenceStore } from './store.js'

export class DecisionLineageGraphEngine {
  readonly #store: InstitutionalIntelligenceStore

  constructor(store: InstitutionalIntelligenceStore) {
    this.#store = store
  }

  async addNode(input: Omit<LineageNode, 'createdAt'>): Promise<LineageNode> {
    const node = lineageNodeSchema.parse({
      ...input,
      createdAt: new Date().toISOString(),
    })

    await this.#store.appendNode(node)
    return node
  }

  async connect(input: Omit<LineageEdge, 'id' | 'createdAt'>): Promise<LineageEdge> {
    const edge = lineageEdgeSchema.parse({
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    })

    await this.#store.appendEdge(edge)
    return edge
  }

  async buildSnapshot(orgId: string): Promise<LineageSnapshot> {
    const [nodes, edges] = await Promise.all([
      this.#store.getNodes(orgId),
      this.#store.getEdges(orgId),
    ])

    const snapshot = lineageSnapshotSchema.parse({
      orgId,
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
    })

    await this.#store.saveSnapshot(snapshot)
    return snapshot
  }

  async getDecisionLineage(decisionRefId: string, orgId: string): Promise<LineageSnapshot> {
    const snapshot = await this.buildSnapshot(orgId)

    const roots = snapshot.nodes.filter((n) => n.refId === decisionRefId)
    if (roots.length === 0) return { ...snapshot, nodes: [], edges: [] }

    const rootIds = new Set(roots.map((r) => r.id))
    const connectedEdgeIds = new Set<string>()
    const connectedNodeIds = new Set<string>([...rootIds])

    let changed = true
    while (changed) {
      changed = false
      for (const edge of snapshot.edges) {
        const touching = connectedNodeIds.has(edge.fromNodeId) || connectedNodeIds.has(edge.toNodeId)
        if (!touching) continue

        if (!connectedEdgeIds.has(edge.id)) {
          connectedEdgeIds.add(edge.id)
          changed = true
        }

        if (!connectedNodeIds.has(edge.fromNodeId)) {
          connectedNodeIds.add(edge.fromNodeId)
          changed = true
        }

        if (!connectedNodeIds.has(edge.toNodeId)) {
          connectedNodeIds.add(edge.toNodeId)
          changed = true
        }
      }
    }

    return {
      orgId: snapshot.orgId,
      generatedAt: snapshot.generatedAt,
      nodes: snapshot.nodes.filter((n) => connectedNodeIds.has(n.id)),
      edges: snapshot.edges.filter((e) => connectedEdgeIds.has(e.id)),
    }
  }
}
