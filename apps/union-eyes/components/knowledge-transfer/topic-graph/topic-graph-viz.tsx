'use client';

/**
 * Interactive Organizational Topic Graph
 *
 * Visualizes operational knowledge relationships across published exit interviews.
 * Nodes represent topics/expertise areas. Edges represent co-occurrence
 * across interviews (organizational coupling).
 *
 * Design principles:
 * - Calm, organizational visual language
 * - Risk intensity through opacity and size, not aggressive colors
 * - Node click reveals details — no pop-ups cluttering the graph
 * - Category-based clustering for clarity
 *
 * This shows ORGANIZATIONAL KNOWLEDGE STRUCTURE, not employee relationships.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TopicNode {
  id: string;
  label: string;
  frequency: number;
  contributingRoles: string[];
  category: string;
}

export interface TopicEdge {
  source: string;
  target: string;
  weight: number;
}

export interface TopicGraph {
  organizationId: string;
  generatedAt: string;
  nodes: TopicNode[];
  edges: TopicEdge[];
  isolatedNodes: string[];
  wellDistributedTopics: string[];
  concentrationClusters: Array<{ topics: string[]; risk: 'low' | 'medium' | 'high' }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  system: '#6366f1',
  vendor: '#f59e0b',
  governance: '#3b82f6',
  compliance: '#ef4444',
  general: '#6b7280',
  operational: '#10b981',
};

const CATEGORY_LABELS: Record<string, string> = {
  system: 'Systems & Tools',
  vendor: 'Vendor Relationships',
  governance: 'Governance',
  compliance: 'Compliance & Legal',
  general: 'General',
  operational: 'Operational',
};

interface LayoutNode extends TopicNode {
  x: number;
  y: number;
  radius: number;
}

function computeLayout(nodes: TopicNode[], width: number, height: number): LayoutNode[] {
  if (nodes.length === 0) return [];

  const cx = width / 2;
  const cy = height / 2;
  const maxFreq = Math.max(...nodes.map((n) => n.frequency), 1);

  // Group by category
  const categories = [...new Set(nodes.map((n) => n.category))];
  const angleStep = (2 * Math.PI) / categories.length;

  const result: LayoutNode[] = [];

  for (const [catIdx, category] of categories.entries()) {
    const catNodes = nodes.filter((n) => n.category === category);
    const baseAngle = catIdx * angleStep - Math.PI / 2;
    const sectorSpread = angleStep * 0.7;

    catNodes.forEach((node, nodeIdx) => {
      const t =
        catNodes.length === 1
          ? 0
          : (nodeIdx / (catNodes.length - 1)) * sectorSpread - sectorSpread / 2;
      const angle = baseAngle + t;

      // More frequent nodes are closer to center
      const minR = 100;
      const maxR = Math.min(cx, cy) * 0.82;
      const r = maxR - (node.frequency / maxFreq) * (maxR - minR);

      const radius = Math.max(6, Math.min(20, 5 + node.frequency * 2.5));

      result.push({
        ...node,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        radius,
      });
    });
  }

  return result;
}

function buildEdgePath(
  source: LayoutNode,
  target: LayoutNode,
): string {
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  // Slight curve via quadratic bezier
  const cx = mx + (target.y - source.y) * 0.15;
  const cy = my - (target.x - source.x) * 0.15;
  return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
}

interface Props {
  graph: TopicGraph;
  /** Active category filter — null = show all */
  categoryFilter?: string | null;
  onNodeClick?: (node: TopicNode) => void;
}

export function TopicGraphViz({ graph, categoryFilter = null, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 500 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; tx: number; ty: number } | null>(null);

  // Observe container size
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 400),
        });
      }
    });
    observer.observe(svgRef.current.parentElement!);
    return () => observer.disconnect();
  }, []);

  const filteredNodes = useMemo(
    () =>
      categoryFilter
        ? graph.nodes.filter((n) => n.category === categoryFilter)
        : graph.nodes,
    [graph.nodes, categoryFilter],
  );

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      graph.edges.filter(
        (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
      ),
    [graph.edges, filteredNodeIds],
  );

  const layoutNodes = useMemo(
    () => computeLayout(filteredNodes, dimensions.width, dimensions.height),
    [filteredNodes, dimensions],
  );

  const nodeById = useMemo(
    () => new Map(layoutNodes.map((n) => [n.id, n])),
    [layoutNodes],
  );

  const isIsolated = useMemo(
    () => new Set(graph.isolatedNodes.map((label) => label.replace(/\s+/g, '_'))),
    [graph.isolatedNodes],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * scaleFactor)),
    }));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== svgRef.current && !(e.target as SVGElement).classList.contains('graph-bg')) return;
      setPanning({ startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y });
    },
    [transform],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!panning) return;
      setTransform((prev) => ({
        ...prev,
        x: panning.tx + (e.clientX - panning.startX),
        y: panning.ty + (e.clientY - panning.startY),
      }));
    },
    [panning],
  );

  const handleMouseUp = useCallback(() => setPanning(null), []);

  function handleNodeClick(node: LayoutNode) {
    setSelectedNode(node.id === selectedNode ? null : node.id);
    onNodeClick?.(node);
  }

  function resetView() {
    setTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNode(null);
  }

  const selectedNodeData = selectedNode ? nodeById.get(selectedNode) : null;

  return (
    <div className="relative w-full h-full select-none">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full rounded-lg bg-slate-50/50 border border-slate-200 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Transparent background rect for pan detection */}
        <rect
          className="graph-bg"
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
        />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          <g opacity={0.35}>
            {filteredEdges.map((edge) => {
              const src = nodeById.get(edge.source);
              const tgt = nodeById.get(edge.target);
              if (!src || !tgt) return null;
              const strokeWidth = Math.min(edge.weight * 0.6, 3);
              const isHighlighted =
                selectedNode === edge.source || selectedNode === edge.target;
              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={buildEdgePath(src, tgt)}
                  stroke={isHighlighted ? '#6366f1' : '#94a3b8'}
                  strokeWidth={isHighlighted ? strokeWidth + 1 : strokeWidth}
                  fill="none"
                  opacity={isHighlighted ? 0.8 : 0.4}
                />
              );
            })}
          </g>

          {/* Nodes */}
          {layoutNodes.map((node) => {
            const color = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.general;
            const isSelected = selectedNode === node.id;
            const isConnected =
              selectedNode != null &&
              filteredEdges.some(
                (e) =>
                  (e.source === selectedNode && e.target === node.id) ||
                  (e.target === selectedNode && e.source === node.id),
              );
            const dim = selectedNode != null && !isSelected && !isConnected;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                className="cursor-pointer"
                onClick={() => handleNodeClick(node)}
                opacity={dim ? 0.25 : 1}
              >
                {/* Glow ring for selected */}
                {isSelected && (
                  <circle
                    r={node.radius + 5}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.4}
                  />
                )}

                {/* Isolation indicator */}
                {isIsolated.has(node.id) && !isSelected && (
                  <circle
                    r={node.radius + 3}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    opacity={0.6}
                  />
                )}

                <circle
                  r={node.radius}
                  fill={color}
                  fillOpacity={isSelected ? 1 : 0.75}
                  stroke={isSelected ? color : 'white'}
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Label — only show if node is large enough or selected */}
                {(node.radius >= 10 || isSelected) && (
                  <text
                    y={node.radius + 12}
                    textAnchor="middle"
                    fontSize={isSelected ? 11 : 9}
                    fill={isSelected ? '#1e293b' : '#64748b'}
                    fontWeight={isSelected ? '600' : '400'}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setTransform((p) => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }))}
          className="w-7 h-7 rounded border bg-white text-slate-600 text-sm hover:bg-slate-50 flex items-center justify-center shadow-sm"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setTransform((p) => ({ ...p, scale: Math.max(p.scale * 0.8, 0.3) }))}
          className="w-7 h-7 rounded border bg-white text-slate-600 text-sm hover:bg-slate-50 flex items-center justify-center shadow-sm"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          className="w-7 h-7 rounded border bg-white text-slate-600 text-xs hover:bg-slate-50 flex items-center justify-center shadow-sm"
          aria-label="Reset view"
        >
          ↺
        </button>
      </div>

      {/* Node detail panel */}
      {selectedNodeData && (
        <div className="absolute bottom-3 left-3 max-w-xs rounded-lg border bg-white shadow-md p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: CATEGORY_COLORS[selectedNodeData.category] ?? '#6b7280' }}
            />
            <span className="font-semibold text-slate-800">{selectedNodeData.label}</span>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="ml-auto text-slate-400 hover:text-slate-600 text-xs"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <span className="text-slate-600">Category:</span>{' '}
              {CATEGORY_LABELS[selectedNodeData.category] ?? selectedNodeData.category}
            </p>
            <p>
              <span className="text-slate-600">Coverage:</span>{' '}
              {selectedNodeData.frequency} interview{selectedNodeData.frequency !== 1 ? 's' : ''}
            </p>
            {selectedNodeData.contributingRoles.length > 0 && (
              <p>
                <span className="text-slate-600">Roles:</span>{' '}
                {selectedNodeData.contributingRoles.join(', ')}
              </p>
            )}
            {isIsolated.has(selectedNodeData.id) && (
              <p className="text-amber-600 font-medium">
                ⚠ Single-source — only one interview covers this area
              </p>
            )}
          </div>
        </div>
      )}

      {/* Category legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-xs">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) =>
            filteredNodes.some((n) => n.category === cat),
          )
          .map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: color }}
              />
              <span className="text-slate-500">{CATEGORY_LABELS[cat] ?? cat}</span>
            </div>
          ))}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-block w-2 h-2 rounded-full border border-amber-400 border-dashed" />
          <span className="text-slate-500">Isolated knowledge</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Container that fetches graph data and renders the interactive visualization.
 */
export function TopicGraphContainer({
  initialGraph,
}: {
  initialGraph?: TopicGraph;
}) {
  const [graph, setGraph] = useState<TopicGraph | null>(initialGraph ?? null);
  const [loading, setLoading] = useState(!initialGraph);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopicNode | null>(null);

  useEffect(() => {
    if (initialGraph) return;
    async function load() {
      try {
        const res = await fetch('/api/exit-interviews/topic-graph', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load topic graph');
        const payload = await res.json() as { data: TopicGraph };
        setGraph(payload.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [initialGraph]);

  const categories = useMemo(
    () => [...new Set(graph?.nodes.map((n) => n.category) ?? [])],
    [graph],
  );

  if (loading) {
    return (
      <div className="w-full h-96 rounded-lg border bg-slate-50 animate-pulse flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Building topic graph…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load topic graph.
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">No topic data yet</p>
        <p className="mt-1">Publish exit interviews to generate the organizational knowledge graph.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            categoryFilter === null
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All topics
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? 'text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            style={
              categoryFilter === cat
                ? { background: CATEGORY_COLORS[cat] ?? '#6b7280' }
                : {}
            }
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}

        <div className="ml-auto text-xs text-muted-foreground">
          {graph.nodes.length} topics · {graph.edges.length} connections
          {graph.isolatedNodes.length > 0 && (
            <span className="ml-2 text-amber-600">
              · {graph.isolatedNodes.length} isolated
            </span>
          )}
        </div>
      </div>

      {/* Graph */}
      <div style={{ height: 520 }}>
        <TopicGraphViz
          graph={graph}
          categoryFilter={categoryFilter}
          onNodeClick={(node) => setSelectedNode(node)}
        />
      </div>

      {/* Stats strip */}
      {graph.concentrationClusters.length > 0 && (
        <div className="rounded-md border bg-amber-50 border-amber-200 p-3 text-xs text-amber-800">
          <span className="font-medium">Concentration clusters detected: </span>
          {graph.concentrationClusters
            .slice(0, 3)
            .map((c) => c.topics.join(' ↔ '))
            .join(' · ')}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Node size reflects interview coverage. Dashed circles indicate single-source knowledge areas.
        Scroll to zoom · drag to pan.
        Last generated {new Date(graph.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
