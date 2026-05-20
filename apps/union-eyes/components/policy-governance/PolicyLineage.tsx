'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LifecycleBadge } from './LifecycleBadge'

interface LineageNode {
  id: string
  data: {
    id: string
    semver: string
    name: string
    lifecycleStatus: string
    isHead: boolean
    isCurrent: boolean
  }
}

interface LineageEdge {
  id: string
  source: string
  target: string
  label: string
}

interface LineageGraph {
  policyFamilyId: string
  nodes: LineageNode[]
  edges: LineageEdge[]
}

const NODE_W = 180
const NODE_H = 72
const COL_GAP = 60
const ROW_GAP = 40

function layoutNodes(nodes: LineageNode[], edges: LineageEdge[]): Map<string, { x: number; y: number }> {
  // Topological order: nodes with no incoming edges first
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const e of edges) {
      if (e.source === id) {
        const deg = (inDegree.get(e.target) ?? 1) - 1
        inDegree.set(e.target, deg)
        if (deg === 0) queue.push(e.target)
      }
    }
  }
  // Any remaining (cycle-safe fallback)
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id)

  const positions = new Map<string, { x: number; y: number }>()
  order.forEach((id, i) => {
    positions.set(id, { x: i * (NODE_W + COL_GAP) + 20, y: 20 })
  })
  return positions
}

export default function PolicyLineage() {
  const [policyId, setPolicyId] = useState('')
  const [graph, setGraph] = useState<LineageGraph | null>(null)
  const [loading, setLoading] = useState(false)

  const loadLineage = useCallback(async () => {
    if (!policyId) return
    setLoading(true)
    const res = await fetch(`/api/governance/lifecycle/policies/${policyId}/lineage`)
    const data = await res.json()
    if (res.ok) setGraph(data)
    setLoading(false)
  }, [policyId])

  const positions = graph ? layoutNodes(graph.nodes, graph.edges) : new Map<string, { x: number; y: number }>()
  const svgWidth = graph ? (graph.nodes.length * (NODE_W + COL_GAP)) + 40 : 0
  const svgHeight = graph ? NODE_H + 60 : 0

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Policy ID (any version in the family)…"
          value={policyId}
          onChange={(e) => setPolicyId(e.target.value)}
          className="flex-1"
        />
        <Button onClick={loadLineage} disabled={!policyId || loading}>
          {loading ? 'Loading…' : 'Load Lineage'}
        </Button>
      </div>

      {graph && graph.nodes.length === 0 && (
        <p className="text-sm text-muted-foreground">No versions found.</p>
      )}

      {graph && graph.nodes.length > 0 && (
        <div className="overflow-x-auto border rounded-lg p-2 bg-muted/20">
          <svg
            width={svgWidth}
            height={svgHeight}
            className="overflow-visible"
            aria-label={`Lineage graph for policy family ${graph.policyFamilyId}`}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
              </marker>
            </defs>

            {/* Edges */}
            {graph.edges.map((e) => {
              const src = positions.get(e.source)
              const tgt = positions.get(e.target)
              if (!src || !tgt) return null
              const x1 = src.x + NODE_W
              const y1 = src.y + NODE_H / 2
              const x2 = tgt.x
              const y2 = tgt.y + NODE_H / 2
              const mx = (x1 + x2) / 2
              return (
                <g key={e.id}>
                  <path
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    className="stroke-muted-foreground"
                    strokeWidth={1.5}
                    markerEnd="url(#arrow)"
                  />
                </g>
              )
            })}

            {/* Nodes */}
            {graph.nodes.map((n) => {
              const pos = positions.get(n.id)!
              const { data: d } = n
              return (
                <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    className={d.isCurrent
                      ? 'fill-primary stroke-primary'
                      : 'fill-card stroke-border'}
                    strokeWidth={d.isHead ? 2 : 1}
                  />
                  <text
                    x={NODE_W / 2}
                    y={22}
                    textAnchor="middle"
                    className={`text-[11px] font-semibold ${d.isCurrent ? 'fill-primary-foreground' : 'fill-foreground'}`}
                    fontSize={11}
                    fill={d.isCurrent ? 'white' : undefined}
                  >
                    v{d.semver}
                  </text>
                  <text
                    x={NODE_W / 2}
                    y={40}
                    textAnchor="middle"
                    fontSize={9}
                    className="fill-muted-foreground"
                    fill="gray"
                  >
                    {d.lifecycleStatus}
                  </text>
                  {d.isHead && (
                    <text x={NODE_W / 2} y={57} textAnchor="middle" fontSize={8} fill="#10b981">
                      HEAD
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
