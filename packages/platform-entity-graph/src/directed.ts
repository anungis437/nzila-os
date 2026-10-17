export interface DirectedNode { key: string, lifecycle: string }
export interface DirectedEdge { key: string, from: string, to: string, relation: string }
export interface DirectedGraphPort<N extends DirectedNode, E extends DirectedEdge> {
  node(key: string): Promise<N | undefined>
  neighbors(key: string, direction: 'incoming' | 'outgoing'): Promise<{ edges: E[], complete: boolean }>
}
export interface DirectedTraversal<N, E> {
  nodes: N[]
  edges: E[]
  paths: { to: string, edges: string[] }[]
  cycles: string[][]
  complete: boolean
  truncated: boolean
  visibilityDisposition: 'COMPLETE' | 'RESTRICTED_OR_UNRESOLVED'
}

/** The port must authorize endpoints and redact hidden edges before returning them. */
export async function traverseDirected<N extends DirectedNode, E extends DirectedEdge>(
  port: DirectedGraphPort<N, E>, seed: string,
  options: { direction: 'incoming' | 'outgoing', depthLimit: number, nodeBudget: number, edgeBudget: number },
): Promise<DirectedTraversal<N, E>> {
  if (!Number.isInteger(options.depthLimit) || options.depthLimit < 1 || options.depthLimit > 100
    || !Number.isInteger(options.nodeBudget) || options.nodeBudget < 1 || options.nodeBudget > 1000
    || !Number.isInteger(options.edgeBudget) || options.edgeBudget < 1 || options.edgeBudget > 10000) {
    throw new Error('INVALID_TRAVERSAL_LIMIT')
  }
  const start = await port.node(seed)
  if (!start) throw new Error('GRAPH_SEED_UNAVAILABLE')
  const nodes = new Map<string, N>([[seed, start]])
  const edges = new Map<string, E>()
  const paths = new Map<string, string[]>([[seed, []]])
  let complete = true
  let truncated = false
  const queue = [{ key: seed, depth: 0 }]
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!
    const adjacent = await port.neighbors(current.key, options.direction)
    complete &&= adjacent.complete
    for (const edge of adjacent.edges.sort((a, b) => a.key.localeCompare(b.key))) {
      const next = options.direction === 'incoming' ? edge.from : edge.to
      if ((options.direction === 'incoming' ? edge.to : edge.from) !== current.key) {
        throw new Error('GRAPH_DIRECTION_INTEGRITY_ERROR')
      }
      if (edges.has(edge.key)) continue
      if (current.depth >= options.depthLimit || edges.size >= options.edgeBudget
        || (!nodes.has(next) && nodes.size >= options.nodeBudget)) {
        truncated = true
        complete = false
        continue
      }
      const node = nodes.get(next) ?? await port.node(next)
      if (!node) { complete = false; continue }
      edges.set(edge.key, edge)
      if (!nodes.has(next)) {
        nodes.set(next, node)
        paths.set(next, [...paths.get(current.key)!, edge.key])
        queue.push({ key: next, depth: current.depth + 1 })
      }
    }
  }
  const cycles: string[][] = []
  const visited = new Set<string>()
  const active: string[] = []
  const sortedEdges = [...edges.values()].sort((a, b) => a.key.localeCompare(b.key))
  function visit(key: string): void {
    const index = active.indexOf(key)
    if (index !== -1) { cycles.push([...active.slice(index), key]); return }
    if (visited.has(key)) return
    active.push(key)
    for (const edge of sortedEdges.filter(e => (options.direction === 'incoming' ? e.to : e.from) === key)) {
      visit(options.direction === 'incoming' ? edge.from : edge.to)
    }
    active.pop()
    visited.add(key)
  }
  visit(seed)
  return {
    nodes: [...nodes.values()].sort((a, b) => a.key.localeCompare(b.key)), edges: sortedEdges,
    paths: [...paths].sort(([a], [b]) => a.localeCompare(b)).map(([to, path]) => ({ to, edges: path })),
    cycles, complete, truncated, visibilityDisposition: complete ? 'COMPLETE' : 'RESTRICTED_OR_UNRESOLVED',
  }
}
