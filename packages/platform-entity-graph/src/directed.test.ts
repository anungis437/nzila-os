import { describe, expect, it } from 'vitest'
import { traverseDirected, type DirectedEdge, type DirectedGraphPort, type DirectedNode } from './directed'

describe('opt-in directed graph traversal', () => {
  const edges: DirectedEdge[] = [
    { key: 'ab', from: 'A', to: 'B', relation: 'DEPENDS_ON' },
    { key: 'bc', from: 'B', to: 'C', relation: 'DEPENDS_ON' },
    { key: 'ca', from: 'C', to: 'A', relation: 'DEPENDS_ON' },
    { key: 'ad', from: 'A', to: 'D', relation: 'DEPENDS_ON' },
  ]
  function port(order: DirectedEdge[]): DirectedGraphPort<DirectedNode, DirectedEdge> {
    return { node: async key => ({ key, lifecycle: 'ACTIVE' }),
      neighbors: async (key, direction) => ({ complete: true,
        edges: order.filter(e => (direction === 'incoming' ? e.to : e.from) === key) }) }
  }
  const options = { direction: 'outgoing' as const, depthLimit: 10, nodeBudget: 100, edgeBudget: 100 }
  it('is identical across three insertion orders and reports cycles', async () => {
    const first = await traverseDirected(port(edges), 'A', options)
    expect(first.cycles).toHaveLength(1)
    expect(await traverseDirected(port([...edges].reverse()), 'A', options)).toEqual(first)
    expect(await traverseDirected(port([edges[2]!, edges[0]!, edges[3]!, edges[1]!]), 'A', options)).toEqual(first)
  })
  it('bounds node, edge and depth budgets with explicit incomplete results', async () => {
    for (const limits of [{ nodeBudget: 1 }, { edgeBudget: 1 }, { depthLimit: 1 }]) {
      expect(await traverseDirected(port(edges), 'A', { ...options, ...limits })).toMatchObject({ complete: false, truncated: true })
    }
  })
  it('rejects invalid limits/direction and does not emit unresolved keys', async () => {
    await expect(traverseDirected(port(edges), 'A', { ...options, depthLimit: 0 })).rejects.toThrow('INVALID_TRAVERSAL_LIMIT')
    const p = port(edges)
    p.node = async key => key === 'D' ? undefined : { key, lifecycle: 'ACTIVE' }
    const result = await traverseDirected(p, 'A', options)
    expect(result.complete).toBe(false)
    expect(result.nodes.some(n => n.key === 'D')).toBe(false)
    expect(result.edges.some(e => e.key === 'ad')).toBe(false)
  })
})
