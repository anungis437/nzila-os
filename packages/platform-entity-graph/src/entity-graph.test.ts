/**
 * @nzila/platform-entity-graph — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { OntologyEntityTypes, RelationshipTypes } from '@nzila/platform-ontology'
import { createInMemoryGraphStore } from './memory-store'
import {
  getEntityNode,
  getEntityNeighbors,
  buildEntitySubgraph,
  resolveRelationshipPath,
} from './traversal'
import type { EntityNode, EntityEdge } from './types'
import type { OntologyEntityType, RelationshipType } from '@nzila/platform-ontology'

const TENANT = '550e8400-e29b-41d4-a716-446655440000'

function node(type: string, id: string, name: string): EntityNode {
  return {
    entityType: type as OntologyEntityType,
    entityId: id,
    tenantId: TENANT,
    canonicalName: name,
    status: 'active',
    metadata: {},
  }
}

function edge(
  id: string,
  srcType: string,
  srcId: string,
  tgtType: string,
  tgtId: string,
  relType: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: srcType as OntologyEntityType,
    sourceEntityId: srcId,
    targetEntityType: tgtType as OntologyEntityType,
    targetEntityId: tgtId,
    relationshipType: relType as RelationshipType,
    metadata: {},
  }
}

describe('platform-entity-graph', () => {
  const store = createInMemoryGraphStore()
  const clientId = 'c0000000-0000-0000-0000-000000000001'
  const familyId = 'f0000000-0000-0000-0000-000000000001'
  const caseId = 'a0000000-0000-0000-0000-000000000001'
  const docId = 'd0000000-0000-0000-0000-000000000001'

  beforeEach(async () => {
    // Seed graph
    await store.addNode(node(OntologyEntityTypes.CLIENT, clientId, 'Jane Doe'))
    await store.addNode(node(OntologyEntityTypes.FAMILY, familyId, 'Doe Family'))
    await store.addNode(node(OntologyEntityTypes.CASE, caseId, 'Case 001'))
    await store.addNode(node(OntologyEntityTypes.DOCUMENT, docId, 'ID Document'))

    await store.addEdge(
      edge('e1', OntologyEntityTypes.CLIENT, clientId, OntologyEntityTypes.FAMILY, familyId, RelationshipTypes.HAS),
    )
    await store.addEdge(
      edge('e2', OntologyEntityTypes.CLIENT, clientId, OntologyEntityTypes.CASE, caseId, RelationshipTypes.HAS),
    )
    await store.addEdge(
      edge('e3', OntologyEntityTypes.CASE, caseId, OntologyEntityTypes.DOCUMENT, docId, RelationshipTypes.HAS),
    )
  })

  it('retrieves a node', async () => {
    const n = await getEntityNode(store, TENANT, OntologyEntityTypes.CLIENT, clientId)
    expect(n).toBeDefined()
    expect(n!.canonicalName).toBe('Jane Doe')
  })

  it('retrieves neighbors', async () => {
    const neighbors = await getEntityNeighbors(
      store, TENANT, OntologyEntityTypes.CLIENT, clientId,
    )
    expect(neighbors.length).toBe(2)
    const types = neighbors.map((n) => n.node.entityType)
    expect(types).toContain(OntologyEntityTypes.FAMILY)
    expect(types).toContain(OntologyEntityTypes.CASE)
  })

  it('builds a subgraph', async () => {
    const subgraph = await buildEntitySubgraph(
      store, TENANT, OntologyEntityTypes.CLIENT, clientId, 2,
    )
    expect(subgraph).toBeDefined()
    expect(subgraph!.nodes.length).toBe(4) // Client, Family, Case, Document
    expect(subgraph!.edges.length).toBe(3)
  })

  it('resolves relationship path', async () => {
    const path = await resolveRelationshipPath(
      store, TENANT,
      OntologyEntityTypes.CLIENT, clientId,
      OntologyEntityTypes.DOCUMENT, docId,
    )
    expect(path).toBeDefined()
    expect(path!.length).toBe(2) // Client -> Case -> Document
  })

  it('returns undefined for no path', async () => {
    const orphanId = 'x0000000-0000-0000-0000-000000000099'
    await store.addNode(node(OntologyEntityTypes.PRODUCT, orphanId, 'Orphan'))
    const path = await resolveRelationshipPath(
      store, TENANT,
      OntologyEntityTypes.CLIENT, clientId,
      OntologyEntityTypes.PRODUCT, orphanId,
    )
    expect(path).toBeUndefined()
  })
})
