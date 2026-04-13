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

  it('retrieves incoming neighbors', async () => {
    const neighbors = await getEntityNeighbors(
      store, TENANT, OntologyEntityTypes.FAMILY, familyId,
    )
    expect(neighbors.length).toBe(1)
    expect(neighbors[0].direction).toBe('incoming')
    expect(neighbors[0].node.entityType).toBe(OntologyEntityTypes.CLIENT)
  })

  it('getEntityNeighbors skips edges to missing nodes', async () => {
    const missingId = 'missing-0000-0000-0000-000000000001'
    await store.addEdge(
      edge('e-missing-nbr', OntologyEntityTypes.FAMILY, familyId, OntologyEntityTypes.PRODUCT, missingId, RelationshipTypes.HAS),
    )
    const neighbors = await getEntityNeighbors(
      store, TENANT, OntologyEntityTypes.FAMILY, familyId,
    )
    // Only Client neighbor should appear (the missing product is skipped)
    const ids = neighbors.map((n) => n.node.entityId)
    expect(ids).not.toContain(missingId)
    await store.removeEdge('e-missing-nbr')
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

  it('removeEdge deletes an edge from the store', async () => {
    await store.removeEdge('e1')
    const neighbors = await getEntityNeighbors(
      store, TENANT, OntologyEntityTypes.CLIENT, clientId,
    )
    const types = neighbors.map((n) => n.node.entityType)
    expect(types).not.toContain(OntologyEntityTypes.FAMILY)
  })

  it('buildEntitySubgraph returns undefined for non-existent seed', async () => {
    const result = await buildEntitySubgraph(
      store, TENANT, OntologyEntityTypes.CLIENT, 'nonexistent-id', 2,
    )
    expect(result).toBeUndefined()
  })

  it('buildEntitySubgraph skips edges to missing nodes', async () => {
    const extraId = 'e0000000-0000-0000-0000-000000000099'
    // Edge to a node that does NOT exist in the store
    await store.addEdge(
      edge('e-dangling', OntologyEntityTypes.CLIENT, clientId, OntologyEntityTypes.PRODUCT, extraId, RelationshipTypes.HAS),
    )
    const subgraph = await buildEntitySubgraph(
      store, TENANT, OntologyEntityTypes.CLIENT, clientId, 1,
    )
    expect(subgraph).toBeDefined()
    // Dangling node should not appear
    const ids = subgraph!.nodes.map((n) => n.entityId)
    expect(ids).not.toContain(extraId)
    await store.removeEdge('e-dangling')
  })

  it('buildEntitySubgraph handles incoming edges not previously collected', async () => {
    const employerId = 'emp-0000-0000-0000-000000000001'
    await store.addNode(node(OntologyEntityTypes.EMPLOYER, employerId, 'Acme Corp'))
    // Employer -> Case: when BFS processes Case, this is a NEW edge where Case is target
    await store.addEdge(
      edge('e-emp', OntologyEntityTypes.EMPLOYER, employerId, OntologyEntityTypes.CASE, caseId, RelationshipTypes.HAS),
    )
    const subgraph = await buildEntitySubgraph(
      store, TENANT, OntologyEntityTypes.CLIENT, clientId, 2,
    )
    expect(subgraph).toBeDefined()
    const ids = subgraph!.nodes.map((n) => n.entityId)
    expect(ids).toContain(employerId)
    await store.removeEdge('e-emp')
  })

  it('buildEntitySubgraph skips already-visited nodes via cycle', async () => {
    // Document -> Client creates a cycle: BFS at depth 2+ will try to re-visit Client
    await store.addEdge(
      edge('e-cycle', OntologyEntityTypes.DOCUMENT, docId, OntologyEntityTypes.CLIENT, clientId, RelationshipTypes.HAS),
    )
    const subgraph = await buildEntitySubgraph(
      store, TENANT, OntologyEntityTypes.CLIENT, clientId, 3,
    )
    expect(subgraph).toBeDefined()
    // Client should appear exactly once despite the cycle
    const clientNodes = subgraph!.nodes.filter((n) => n.entityId === clientId)
    expect(clientNodes.length).toBe(1)
    await store.removeEdge('e-cycle')
  })

  it('resolveRelationshipPath returns undefined when from node missing', async () => {
    const path = await resolveRelationshipPath(
      store, TENANT,
      OntologyEntityTypes.CLIENT, 'nonexistent-from',
      OntologyEntityTypes.DOCUMENT, docId,
    )
    expect(path).toBeUndefined()
  })

  it('resolveRelationshipPath returns undefined when to node missing', async () => {
    const path = await resolveRelationshipPath(
      store, TENANT,
      OntologyEntityTypes.CLIENT, clientId,
      OntologyEntityTypes.DOCUMENT, 'nonexistent-to',
    )
    expect(path).toBeUndefined()
  })

  it('resolveRelationshipPath returns undefined when maxDepth exceeded', async () => {
    // Path Client -> Case -> Document requires 2 hops, so maxDepth=1 should fail
    const path = await resolveRelationshipPath(
      store, TENANT,
      OntologyEntityTypes.CLIENT, clientId,
      OntologyEntityTypes.DOCUMENT, docId,
      1,
    )
    expect(path).toBeUndefined()
  })

  it('resolveRelationshipPath skips dangling edges to missing nodes', async () => {
    const phantomId = 'p0000000-0000-0000-0000-000000000099'
    // Edge from Client to non-existent node — BFS processes it before finding Document
    await store.addEdge(
      edge('e-phantom', OntologyEntityTypes.CLIENT, clientId, OntologyEntityTypes.PRODUCT, phantomId, RelationshipTypes.HAS),
    )
    const path = await resolveRelationshipPath(
      store, TENANT,
      OntologyEntityTypes.CLIENT, clientId,
      OntologyEntityTypes.DOCUMENT, docId,
    )
    expect(path).toBeDefined()
    expect(path!.length).toBe(2)
    await store.removeEdge('e-phantom')
  })
})
