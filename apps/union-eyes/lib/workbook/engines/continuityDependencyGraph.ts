/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Continuity Landscape
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Dependency Graph — produces an undirected adjacency view of
 * how named institutional dependencies relate (carriers ↔ processes ↔
 * governance bodies). Anti-surveillance: this graph is structural only.
 * No carrier names, no notes, no PII flow through this module.
 *
 * Pure, deterministic.
 */

export type DependencyNodeKind = 'carrier' | 'process' | 'governance_body';

export interface DependencyNode {
  readonly id: string;
  readonly kind: DependencyNodeKind;
  /** Optional non-PII label like "Carrier #3" or "Process A". Callers must avoid PII. */
  readonly label: string;
}

export interface DependencyEdge {
  readonly fromId: string;
  readonly toId: string;
  /** 1 = informational; 2 = procedural; 3 = load-bearing; 4 = institution-critical. */
  readonly weight: 1 | 2 | 3 | 4;
}

export interface DependencyGraphInput {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
}

export interface DependencyGraphResult {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
  readonly metrics: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly maxDegree: number;
    readonly meanDegree: number;
    /** Number of nodes whose removal would disconnect ≥1 load-bearing edge. */
    readonly criticalArticulationCount: number;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildDependencyGraph(
  input: DependencyGraphInput,
): DependencyGraphResult {
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  // Filter edges that reference unknown nodes — strict structural integrity.
  const edges = input.edges.filter(
    (e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId) && e.fromId !== e.toId,
  );

  const degree = new Map<string, number>();
  for (const n of input.nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.fromId, (degree.get(e.fromId) ?? 0) + 1);
    degree.set(e.toId, (degree.get(e.toId) ?? 0) + 1);
  }

  const degrees = Array.from(degree.values());
  const maxDegree = degrees.reduce((a, b) => (b > a ? b : a), 0);
  const meanDegree =
    degrees.length === 0 ? 0 : degrees.reduce((a, b) => a + b, 0) / degrees.length;

  const criticalArticulationCount = countCriticalArticulations(input.nodes, edges);

  return {
    nodes: input.nodes,
    edges,
    metrics: {
      nodeCount: input.nodes.length,
      edgeCount: edges.length,
      maxDegree,
      meanDegree: round2(meanDegree),
      criticalArticulationCount,
    },
  };
}

/**
 * Counts nodes whose removal severs at least one load-bearing or
 * institution-critical edge between two remaining nodes.
 *
 * O(n × (n + e)). Acceptable for workbook-scale graphs (< ~200 nodes).
 */
function countCriticalArticulations(
  nodes: readonly DependencyNode[],
  edges: readonly DependencyEdge[],
): number {
  let count = 0;
  const loadBearingPairs = edges.filter((e) => e.weight >= 3);
  if (loadBearingPairs.length === 0) return 0;

  for (const candidate of nodes) {
    const remainingEdges = edges.filter(
      (e) => e.fromId !== candidate.id && e.toId !== candidate.id,
    );
    const reachable = new Map<string, Set<string>>();
    for (const n of nodes) {
      if (n.id === candidate.id) continue;
      reachable.set(n.id, bfs(n.id, candidate.id, remainingEdges));
    }
    const severed = loadBearingPairs.some((e) => {
      if (e.fromId === candidate.id || e.toId === candidate.id) return false;
      const set = reachable.get(e.fromId);
      return !set || !set.has(e.toId);
    });
    if (severed) count += 1;
  }
  return count;
}

function bfs(
  startId: string,
  exclude: string,
  edges: readonly DependencyEdge[],
): Set<string> {
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const e of edges) {
      const next =
        e.fromId === current
          ? e.toId
          : e.toId === current
            ? e.fromId
            : null;
      if (next === null || next === exclude || visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}
