'use client';

/**
 * Organizational Cognition Graph
 *
 * Interactive dependency graph showing knowledge propagation pathways,
 * governance overlays, and risk concentration visualization.
 *
 * Nodes represent organizational knowledge areas (not individuals).
 * Edges represent operational coupling and dependency relationships.
 *
 * Features:
 * - Click-to-expand: see downstream dependencies
 * - Propagation path highlighting
 * - Governance overlay
 * - Scenario/risk overlays
 * - Risk concentration heatmap
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface CognitionNode {
  id: string;
  label: string;
  nodeType: string;
  category: string;
  continuitySensitivity: 'low' | 'medium' | 'high' | 'critical';
  isSingleSource: boolean;
  frequency: number;
}

export interface CognitionEdge {
  sourceId: string;
  targetId: string;
  strength: number;
  edgeType: 'dependency' | 'governance' | 'operational';
}

export interface PropagationPath {
  path: string[];
  impactScore: number;
  disruptionScope: string;
}

export interface CognitionGraph {
  nodes: CognitionNode[];
  edges: CognitionEdge[];
  propagationPaths: PropagationPath[];
  bottlenecks: string[];
}

type OverlayMode = 'risk' | 'governance' | 'propagation' | 'none';

const SENSITIVITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

const TYPE_COLORS: Record<string, string> = {
  expertise: '#6366f1',
  system: '#8b5cf6',
  vendor: '#f59e0b',
  governance: '#3b82f6',
  procedure: '#10b981',
};

interface LayoutNode extends CognitionNode {
  x: number;
  y: number;
  radius: number;
}

function computeCognitionLayout(nodes: CognitionNode[], width: number, height: number): LayoutNode[] {
  if (nodes.length === 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const maxFreq = Math.max(...nodes.map((n) => n.frequency), 1);

  const types = [...new Set(nodes.map((n) => n.nodeType))];
  const typeCount = types.length;
  const angleStep = (2 * Math.PI) / typeCount;

  return nodes.map((node) => {
    const typeIdx = types.indexOf(node.nodeType);
    const typeNodes = nodes.filter((n) => n.nodeType === node.nodeType);
    const localIdx = typeNodes.indexOf(node);
    const baseAngle = typeIdx * angleStep - Math.PI / 2;
    const spread = angleStep * 0.6;
    const offset = typeNodes.length <= 1 ? 0 : (localIdx / (typeNodes.length - 1)) * spread - spread / 2;
    const angle = baseAngle + offset;

    // Single-source nodes at outer ring; well-covered nodes closer to center
    const minR = 90;
    const maxR = Math.min(cx, cy) * 0.85;
    const coverageR = node.isSingleSource ? maxR : minR + ((node.frequency / maxFreq) * (maxR - minR) * 0.4);

    const radius = Math.max(8, Math.min(22, 6 + node.frequency * 2));

    return {
      ...node,
      x: cx + coverageR * Math.cos(angle),
      y: cy + coverageR * Math.sin(angle),
      radius,
    };
  });
}

interface Props {
  graph: CognitionGraph;
  /** Which path to highlight (by index in propagationPaths) */
  highlightedPathIndex?: number | null;
  /** Active overlay mode */
  overlay?: OverlayMode;
  onNodeClick?: (node: CognitionNode) => void;
}

export function CognitionGraphViz({ graph, highlightedPathIndex = null, overlay = 'risk', onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 520 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState<{ sx: number; sy: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current?.parentElement) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({ width: entry.contentRect.width, height: Math.max(400, entry.contentRect.height) });
      }
    });
    observer.observe(svgRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  const layoutNodes = useMemo(
    () => computeCognitionLayout(graph.nodes, dimensions.width, dimensions.height),
    [graph.nodes, dimensions],
  );

  const nodeById = useMemo(() => new Map(layoutNodes.map((n) => [n.id, n])), [layoutNodes]);

  // Edges to show — if a node is expanded, highlight its direct edges
  const expandedEdges = useMemo(() => {
    if (!expandedNodeId) return new Set<string>();
    return new Set(
      graph.edges
        .filter((e) => e.sourceId === expandedNodeId || e.targetId === expandedNodeId)
        .map((e) => `${e.sourceId}::${e.targetId}`),
    );
  }, [expandedNodeId, graph.edges]);

  // Highlighted propagation path node IDs
  const highlightedNodeIds = useMemo(() => {
    if (highlightedPathIndex === null) return null;
    const path = graph.propagationPaths[highlightedPathIndex];
    return path ? new Set(path.path) : null;
  }, [highlightedPathIndex, graph.propagationPaths]);

  const bottleneckSet = useMemo(() => new Set(graph.bottlenecks), [graph.bottlenecks]);

  const getNodeColor = useCallback((node: CognitionNode): string => {
    if (overlay === 'risk') return SENSITIVITY_COLORS[node.continuitySensitivity] ?? '#6b7280';
    if (overlay === 'governance') return node.nodeType === 'governance' ? '#3b82f6' : '#e2e8f0';
    if (overlay === 'propagation') {
      return highlightedNodeIds?.has(node.id) ? '#f97316' : '#cbd5e1';
    }
    return TYPE_COLORS[node.nodeType] ?? '#6b7280';
  }, [overlay, highlightedNodeIds]);

  const getNodeOpacity = useCallback((node: CognitionNode): number => {
    if (highlightedNodeIds && !highlightedNodeIds.has(node.id)) return 0.3;
    if (expandedNodeId) {
      const isConnected = graph.edges.some((e) => e.sourceId === expandedNodeId && e.targetId === node.id || e.targetId === expandedNodeId && e.sourceId === node.id);
      if (node.id !== expandedNodeId && !isConnected) return 0.25;
    }
    return 1;
  }, [highlightedNodeIds, expandedNodeId, graph.edges]);

  const getEdgeColor = useCallback((edge: CognitionEdge): string => {
    const key = `${edge.sourceId}::${edge.targetId}`;
    if (expandedEdges.has(key)) return '#f97316';
    if (edge.edgeType === 'governance') return '#3b82f6';
    return '#cbd5e1';
  }, [expandedEdges]);

  const handleNodeClick = useCallback((node: CognitionNode) => {
    const id = node.id;
    setSelectedNodeId(id);
    setExpandedNodeId((prev) => (prev === id ? null : id));
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.25, Math.min(3, prev.scale * (e.deltaY > 0 ? 0.9 : 1.1))),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName !== 'svg' && (e.target as SVGElement).tagName !== 'rect') return;
    setPanning({ sx: e.clientX, sy: e.clientY, tx: transform.x, ty: transform.y });
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panning) return;
    setTransform((prev) => ({
      ...prev,
      x: panning.tx + (e.clientX - panning.sx),
      y: panning.ty + (e.clientY - panning.sy),
    }));
  }, [panning]);

  const handleMouseUp = useCallback(() => setPanning(null), []);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {overlay === 'risk' && Object.entries(SENSITIVITY_COLORS).map(([k, color]) => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ background: color }} className="inline-block w-3 h-3 rounded-full" />
            {k}
          </span>
        ))}
        {overlay === 'governance' && (
          <>
            <span className="flex items-center gap-1"><span style={{ background: '#3b82f6' }} className="inline-block w-3 h-3 rounded-full" />Governance</span>
            <span className="flex items-center gap-1"><span style={{ background: '#e2e8f0' }} className="inline-block w-3 h-3 rounded-full" />Other</span>
          </>
        )}
        {overlay === 'none' && Object.entries(TYPE_COLORS).map(([k, color]) => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ background: color }} className="inline-block w-3 h-3 rounded-full" />
            {k}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-orange-500 bg-transparent" />
          bottleneck
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-slate-400 border-dashed bg-transparent" />
          single-source
        </span>
      </div>

      {/* Graph SVG */}
      <div className="relative bg-slate-50 rounded-lg overflow-hidden" style={{ height: 520 }}>
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {graph.edges.map((edge) => {
              const src = nodeById.get(edge.sourceId);
              const tgt = nodeById.get(edge.targetId);
              if (!src || !tgt) return null;
              const color = getEdgeColor(edge);
              const key = `${edge.sourceId}::${edge.targetId}`;
              const isActive = expandedEdges.has(key);
              return (
                <line
                  key={key}
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  stroke={color}
                  strokeWidth={isActive ? 2 : Math.max(0.5, edge.strength)}
                  strokeOpacity={isActive ? 0.9 : 0.35}
                />
              );
            })}

            {/* Nodes */}
            {layoutNodes.map((node) => {
              const color = getNodeColor(node);
              const opacity = getNodeOpacity(node);
              const isSelected = node.id === selectedNodeId;
              const isBottleneck = bottleneckSet.has(node.id);
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  style={{ cursor: 'pointer', opacity }}
                  onClick={() => handleNodeClick(node)}
                >
                  {/* Bottleneck ring */}
                  {isBottleneck && (
                    <circle
                      r={node.radius + 6}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  )}
                  {/* Single-source ring */}
                  {node.isSingleSource && !isBottleneck && (
                    <circle
                      r={node.radius + 4}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                  )}
                  {/* Main node */}
                  <circle
                    r={node.radius}
                    fill={color}
                    stroke={isSelected ? '#0f172a' : 'white'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {/* Label */}
                  <text
                    textAnchor="middle"
                    dy={node.radius + 12}
                    fontSize={9}
                    fill="#475569"
                    fontFamily="system-ui, sans-serif"
                  >
                    {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom hint */}
        <div className="absolute bottom-2 right-3 text-xs text-slate-400 pointer-events-none">
          Scroll to zoom · Drag to pan · Click node to expand
        </div>
      </div>

      {/* Selected node detail panel */}
      {selectedNode && (
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: getNodeColor(selectedNode) }}
            />
            <span className="font-medium text-slate-800">{selectedNode.label}</span>
            {selectedNode.isSingleSource && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                single-source
              </span>
            )}
            {bottleneckSet.has(selectedNode.id) && (
              <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                bottleneck
              </span>
            )}
          </div>
          <div className="text-sm text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-500">Type</span><span>{selectedNode.nodeType}</span>
            <span className="text-slate-500">Sensitivity</span>
            <span style={{ color: SENSITIVITY_COLORS[selectedNode.continuitySensitivity] }}>
              {selectedNode.continuitySensitivity}
            </span>
            <span className="text-slate-500">Coverage frequency</span><span>{selectedNode.frequency}</span>
          </div>
          <p className="text-xs text-slate-500">
            {selectedNode.isSingleSource
              ? 'This knowledge area has single-source coverage — continuity risk if unavailable.'
              : `This knowledge area has ${selectedNode.frequency} coverage instances across interviews.`}
          </p>
        </div>
      )}
    </div>
  );
}
