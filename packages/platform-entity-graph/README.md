# @nzila/platform-entity-graph

Semantic entity relationship graph for NzilaOS.

## Purpose

Provides a canonical graph layer for traversing linked entities across domains. Not just database joins — a semantic relationship graph.

## Core Operations

```ts
import {
  getEntityNode,
  getEntityNeighbors,
  buildEntitySubgraph,
  resolveRelationshipPath,
  createInMemoryGraphStore,
} from '@nzila/platform-entity-graph'

const store = createInMemoryGraphStore()

// Get a node
const client = await getEntityNode(store, tenantId, 'Client', clientId)

// Get all neighbors
const neighbors = await getEntityNeighbors(store, tenantId, 'Client', clientId)

// Build subgraph from seed
const subgraph = await buildEntitySubgraph(store, tenantId, 'Client', clientId, 3)

// Find path between entities
const path = await resolveRelationshipPath(store, tenantId, 'Client', clientId, 'Document', docId)
```

## Store Interface

Implement `EntityGraphStore` to back the graph with your database.

## Opt-in directed traversal

`@nzila/platform-entity-graph/directed` exports `traverseDirected` and its typed
port. It does not change the legacy tenant graph API or create a second store.
The adapter supplies scoped, authorized nodes and direction-specific visible
edges; hidden edges are redacted before they reach traversal and mark coverage
incomplete. Institutional adapters compose the CP3 authority/binding boundary.

Depth (1-100), node (1-1000) and edge (1-10000) limits are explicit. Sorted BFS
produces deterministic shortest paths, cycle metadata and explicit truncation.
Unresolved endpoints are not emitted. Incoming dependency impact is distinct
from outgoing prerequisites, and neither asserts confirmed causation.

The local institutional adapter and its historical/lifecycle proof are documented
in the [CP4 closeout](../../docs/architecture/NZILA_OS_CP4_OPERATING_RUNTIME_CLOSEOUT.md).
