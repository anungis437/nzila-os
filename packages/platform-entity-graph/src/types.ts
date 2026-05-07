/**
 * @nzila/platform-entity-graph — Types
 *
 * Semantic entity graph types for cross-domain traversal.
 */
import type { OntologyEntityType, RelationshipType } from '@nzila/platform-ontology'

// ── Graph Node ──────────────────────────────────────────────────────────────

export interface EntityNode {
  readonly entityType: OntologyEntityType
  readonly resourceId: string
  readonly tenantId: string
  readonly canonicalName: string
  readonly status: string
  readonly metadata: Record<string, unknown>
}

// ── Graph Edge ──────────────────────────────────────────────────────────────

export interface EntityEdge {
  readonly id: string
  readonly sourceEntityType: OntologyEntityType
  readonly sourceEntityId: string
  readonly targetEntityType: OntologyEntityType
  readonly targetEntityId: string
  readonly relationshipType: RelationshipType
  readonly metadata: Record<string, unknown>
}

// ── Subgraph ────────────────────────────────────────────────────────────────

export interface EntitySubgraph {
  readonly seedNode: EntityNode
  readonly nodes: readonly EntityNode[]
  readonly edges: readonly EntityEdge[]
  readonly depth: number
}

// ── Relationship Path ───────────────────────────────────────────────────────

export interface RelationshipPath {
  readonly from: EntityNode
  readonly to: EntityNode
  readonly path: readonly EntityEdge[]
  readonly length: number
}

// ── Neighbor Result ─────────────────────────────────────────────────────────

export interface NeighborResult {
  readonly node: EntityNode
  readonly edge: EntityEdge
  readonly direction: 'outgoing' | 'incoming'
}

// ── Graph Store Interface ───────────────────────────────────────────────────

export interface EntityGraphStore {
  getNode(tenantId: string, entityType: OntologyEntityType, resourceId: string): Promise<EntityNode | undefined>
  getEdges(tenantId: string, entityType: OntologyEntityType, resourceId: string): Promise<readonly EntityEdge[]>
  addNode(node: EntityNode): Promise<void>
  addEdge(edge: EntityEdge): Promise<void>
  removeEdge(edgeId: string): Promise<void>
}
