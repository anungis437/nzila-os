'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildEntitySubgraph,
  createInMemoryGraphStore,
  getEntityNeighbors,
  type EntityEdge,
  type EntityNode,
} from '@nzila/platform-entity-graph'
import {
  OntologyEntityTypes,
  RelationshipTypes,
  type OntologyEntityType,
  type RelationshipType,
} from '@nzila/platform-ontology'

const ENTITY_TYPE_VALUES = Object.values(OntologyEntityTypes) as OntologyEntityType[]
const RELATIONSHIP_TYPE_VALUES = Object.values(RelationshipTypes) as RelationshipType[]

// ── Explorer ────────────────────────────────────────────────────────────────

interface ExplorerProps {
  tenantId: string
  nodes: ReadonlyArray<EntityNode>
  edges: ReadonlyArray<EntityEdge>
}

export function EntityGraphExplorer({ tenantId, nodes, edges }: ExplorerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [depth, setDepth] = useState(2)
  const [mode, setMode] = useState<'subgraph' | 'neighbors'>('subgraph')
  const [result, setResult] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Hydrate an in-memory store mirror so traversal happens on the client
  // without round-tripping to the DB.
  const store = useMemo(() => createInMemoryGraphStore(), [])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const n of nodes) await store.addNode(n)
      for (const e of edges) await store.addEdge(e)
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [store, nodes, edges])

  async function traverse() {
    const node = nodes[selectedIdx]
    if (!node) return
    if (mode === 'subgraph') {
      const sub = await buildEntitySubgraph(
        store,
        tenantId,
        node.entityType,
        node.entityId,
        depth,
      )
      setResult(sub ? JSON.stringify(sub, null, 2) : 'No subgraph found')
    } else {
      const neighbors = await getEntityNeighbors(
        store,
        tenantId,
        node.entityType,
        node.entityId,
      )
      setResult(JSON.stringify(neighbors, null, 2))
    }
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-400">
        No nodes yet. Add a node above to start exploring.
      </div>
    )
  }

  return (
    <>
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
            {nodes.map((n, i) => (
              <option key={`${n.entityType}:${n.entityId}`} value={i}>
                {n.entityType}: {n.canonicalName} ({n.entityId})
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
            type="button"
            onClick={traverse}
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
            Entity Catalog ({nodes.length})
          </h2>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-xs font-medium text-gray-400">Type</th>
                  <th className="pb-2 text-xs font-medium text-gray-400">Name</th>
                  <th className="pb-2 text-xs font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n, i) => (
                  <tr
                    key={`${n.entityType}:${n.entityId}`}
                    onClick={() => setSelectedIdx(i)}
                    className={`cursor-pointer border-b border-gray-50 hover:bg-gray-50 ${
                      selectedIdx === i ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-1 py-1.5 font-mono text-xs text-blue-600">
                      {n.entityType}
                    </td>
                    <td className="px-1 py-1.5 text-gray-800">
                      {n.canonicalName}
                    </td>
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
              {ready
                ? 'Select an entity and click Traverse'
                : 'Loading graph…'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── New Node Dialog ─────────────────────────────────────────────────────────

interface NewEntityNodeDialogProps {
  orgId: string
}

export function NewEntityNodeDialog({ orgId }: NewEntityNodeDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [entityType, setEntityType] = useState<OntologyEntityType>(
    ENTITY_TYPE_VALUES[0],
  )
  const [entityId, setEntityId] = useState('')
  const [canonicalName, setCanonicalName] = useState('')
  const [status, setStatus] = useState('active')
  const [metadataText, setMetadataText] = useState('{}')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEntityType(ENTITY_TYPE_VALUES[0])
    setEntityId('')
    setCanonicalName('')
    setStatus('active')
    setMetadataText('{}')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    let metadata: Record<string, unknown> = {}
    try {
      const parsed = metadataText.trim() === '' ? {} : JSON.parse(metadataText)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('Metadata must be a JSON object')
        return
      }
      metadata = parsed as Record<string, unknown>
    } catch {
      setError('Metadata is not valid JSON')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entity-graph/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          entityType,
          entityId,
          canonicalName,
          status,
          metadata,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed (${res.status})`)
        return
      }
      reset()
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + New Node
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-xl space-y-3 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">New entity node</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Type</label>
                <select
                  value={entityType}
                  onChange={(e) =>
                    setEntityType(e.target.value as OntologyEntityType)
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {ENTITY_TYPE_VALUES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Entity ID
                </label>
                <input
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  required
                  maxLength={200}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                  placeholder="org-001"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">
                  Canonical name
                </label>
                <input
                  value={canonicalName}
                  onChange={(e) => setCanonicalName(e.target.value)}
                  required
                  maxLength={400}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Status</label>
                <input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  required
                  maxLength={64}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Metadata (JSON)
              </label>
              <textarea
                value={metadataText}
                onChange={(e) => setMetadataText(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs font-mono"
              />
            </div>
            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Create node'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// ── New Edge Dialog ─────────────────────────────────────────────────────────

interface NewEdgeDialogProps {
  orgId: string
  nodes: ReadonlyArray<EntityNode>
}

export function NewEdgeDialog({ orgId, nodes }: NewEdgeDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sourceIdx, setSourceIdx] = useState(0)
  const [targetIdx, setTargetIdx] = useState(Math.min(1, nodes.length - 1))
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    RELATIONSHIP_TYPE_VALUES[0],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (nodes.length < 2) {
    return (
      <button
        type="button"
        disabled
        title="Create at least two nodes first"
        className="inline-flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
      >
        + New Edge
      </button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const source = nodes[sourceIdx]
    const target = nodes[targetIdx]
    if (!source || !target) {
      setError('Pick both endpoints')
      return
    }
    if (
      source.entityType === target.entityType &&
      source.entityId === target.entityId
    ) {
      setError('Source and target must differ')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entity-graph/edges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          sourceEntityType: source.entityType,
          sourceEntityId: source.entityId,
          targetEntityType: target.entityType,
          targetEntityId: target.entityId,
          relationshipType,
          metadata: {},
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed (${res.status})`)
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        + New Edge
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-xl space-y-3 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">New relationship</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Source</label>
                <select
                  value={sourceIdx}
                  onChange={(e) => setSourceIdx(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {nodes.map((n, i) => (
                    <option key={`s-${n.entityType}:${n.entityId}`} value={i}>
                      {n.entityType}: {n.canonicalName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Relationship
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) =>
                    setRelationshipType(e.target.value as RelationshipType)
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {RELATIONSHIP_TYPE_VALUES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Target</label>
                <select
                  value={targetIdx}
                  onChange={(e) => setTargetIdx(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {nodes.map((n, i) => (
                    <option key={`t-${n.entityType}:${n.entityId}`} value={i}>
                      {n.entityType}: {n.canonicalName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Create edge'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
