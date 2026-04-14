'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createInMemoryGraphStore,
  getEntityNeighbors,
  buildEntitySubgraph,
  type EntityNode,
} from '@nzila/platform-entity-graph'
import { OntologyEntityTypes, RelationshipTypes } from '@nzila/platform-ontology'

// ── Seed data for the in-memory graph ──────────────────────────────────────

const TENANT = 'platform-admin'

const SEED_NODES: EntityNode[] = [
  { entityType: OntologyEntityTypes.ORGANIZATION, entityId: 'org-001', tenantId: TENANT, canonicalName: 'Nzila Corp', status: 'active', metadata: {} },
  { entityType: OntologyEntityTypes.USER, entityId: 'usr-001', tenantId: TENANT, canonicalName: 'John Doe', status: 'active', metadata: { role: 'admin' } },
  { entityType: OntologyEntityTypes.CASE, entityId: 'case-001', tenantId: TENANT, canonicalName: 'Onboarding Case #1', status: 'open', metadata: {} },
  { entityType: OntologyEntityTypes.DOCUMENT, entityId: 'doc-001', tenantId: TENANT, canonicalName: 'KYC Document', status: 'verified', metadata: {} },
  { entityType: OntologyEntityTypes.WORKFLOW, entityId: 'wf-001', tenantId: TENANT, canonicalName: 'Org Onboarding Flow', status: 'active', metadata: {} },
  { entityType: OntologyEntityTypes.APPROVAL, entityId: 'appr-001', tenantId: TENANT, canonicalName: 'KYC Approval', status: 'pending', metadata: {} },
]

const SEED_EDGES = [
  { id: 'e-1', sourceEntityType: OntologyEntityTypes.USER, sourceEntityId: 'usr-001', targetEntityType: OntologyEntityTypes.ORGANIZATION, targetEntityId: 'org-001', relationshipType: RelationshipTypes.BELONGS_TO, metadata: {} },
  { id: 'e-2', sourceEntityType: OntologyEntityTypes.CASE, sourceEntityId: 'case-001', targetEntityType: OntologyEntityTypes.ORGANIZATION, targetEntityId: 'org-001', relationshipType: RelationshipTypes.BELONGS_TO, metadata: {} },
  { id: 'e-3', sourceEntityType: OntologyEntityTypes.DOCUMENT, sourceEntityId: 'doc-001', targetEntityType: OntologyEntityTypes.CASE, targetEntityId: 'case-001', relationshipType: RelationshipTypes.REFERENCES, metadata: {} },
  { id: 'e-4', sourceEntityType: OntologyEntityTypes.WORKFLOW, sourceEntityId: 'wf-001', targetEntityType: OntologyEntityTypes.CASE, targetEntityId: 'case-001', relationshipType: RelationshipTypes.DEPENDS_ON, metadata: {} },
  { id: 'e-5', sourceEntityType: OntologyEntityTypes.APPROVAL, sourceEntityId: 'appr-001', targetEntityType: OntologyEntityTypes.DOCUMENT, targetEntityId: 'doc-001', relationshipType: RelationshipTypes.REFERENCES, metadata: {} },
  { id: 'e-6', sourceEntityType: OntologyEntityTypes.USER, sourceEntityId: 'usr-001', targetEntityType: OntologyEntityTypes.CASE, targetEntityId: 'case-001', relationshipType: RelationshipTypes.ASSIGNED_TO, metadata: {} },
] as const

const store = createInMemoryGraphStore()
let storeInitialized = false

async function initStore() {
  if (storeInitialized) return
  storeInitialized = true
  for (const n of SEED_NODES) await store.addNode(n)
  for (const e of SEED_EDGES) await store.addEdge(e)
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EntityGraphExplorer() {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [depth, setDepth] = useState(2)
  const [mode, setMode] = useState<'subgraph' | 'neighbors'>('subgraph')
  const [result, setResult] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => { initStore().then(() => setReady(true)) }, [])

  const handleTraverse = useCallback(async () => {
    const node = SEED_NODES[selectedIdx]
    if (!node) return

    if (mode === 'subgraph') {
      const subgraph = await buildEntitySubgraph(
        store, TENANT, node.entityType, node.entityId, depth,
      )
      setResult(subgraph ? JSON.stringify(subgraph, null, 2) : 'No subgraph found')
    } else {
      const neighbors = await getEntityNeighbors(
        store, TENANT, node.entityType, node.entityId,
      )
      setResult(JSON.stringify(neighbors, null, 2))
    }
  }, [selectedIdx, depth, mode])

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Entity Graph Explorer</h1>
      <p className="mb-6 text-gray-500">
        Explore entity relationships via BFS traversal.{' '}
        {SEED_NODES.length} entities, {SEED_EDGES.length} edges loaded.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase text-gray-400">
          Query
        </h2>
        <div className="flex flex-wrap gap-4">
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {SEED_NODES.map((n, i) => (
              <option key={i} value={i}>
                {n.entityType}: {n.canonicalName} ({n.entityType})
              </option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'subgraph' | 'neighbors')}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="subgraph">Build Subgraph</option>
            <option value="neighbors">Get Neighbors</option>
          </select>
          <input
            type="number"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            min={1}
            max={5}
            className="w-20 rounded border border-gray-300 px-3 py-2 text-sm"
            title="Traversal depth"
          />
          <button
            onClick={handleTraverse}
            disabled={!ready}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Traverse
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
            Entity Catalog
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-xs font-medium text-gray-400">Type</th>
                <th className="pb-2 text-xs font-medium text-gray-400">Name</th>
                <th className="pb-2 text-xs font-medium text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {SEED_NODES.map((n, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`cursor-pointer border-b border-gray-50 hover:bg-gray-50 ${
                    selectedIdx === i ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-1 py-1.5 font-mono text-xs text-blue-600">{n.entityType}</td>
                  <td className="px-1 py-1.5 text-gray-800">{n.canonicalName}</td>
                  <td className="px-1 py-1.5">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
            Result
          </h2>
          {result ? (
            <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-4 text-xs text-gray-700">
              {result}
            </pre>
          ) : (
            <div className="flex h-32 items-center justify-center text-gray-400">
              {ready ? 'Select an entity and click Traverse' : 'Initializing graph store…'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
