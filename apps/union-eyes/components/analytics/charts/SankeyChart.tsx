/**
 * Sankey Diagram Component
 * 
 * Flow diagram showing quantities flowing between nodes
 * Useful for visualizing resource allocation, conversions, etc.
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  Sankey,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface SankeyChartProps {
  data: {
    nodes: Array<{ name: string }>;
    links: Array<{
      source: number;
      target: number;
      value: number;
    }>;
  };
  title?: string;
  height?: number;
  nodeColor?: string;
  linkOpacity?: number;
}

// ============================================================================
// Component
// ============================================================================

export function SankeyChart({
  data,
  title,
  height = 500,
  nodeColor = '#3b82f6',
  linkOpacity = 0.5,
}: SankeyChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0];

    // Node tooltip
    if (data.payload.name) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">{data.payload.name}</p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-gray-600">Total Value:</span>{' '}
              <span className="font-medium">{data.value?.toLocaleString()}</span>
            </p>
          </div>
        </div>
      );
    }

    // Link tooltip
    if (data.payload.source && data.payload.target) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceName = data.nodes.find((n: any) => n.index === data.payload.source)?.name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetName = data.nodes.find((n: any) => n.index === data.payload.target)?.name;

      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">Flow</p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-gray-600">From:</span>{' '}
              <span className="font-medium">{sourceName}</span>
            </p>
            <p>
              <span className="text-gray-600">To:</span>{' '}
              <span className="font-medium">{targetName}</span>
            </p>
            <p>
              <span className="text-gray-600">Value:</span>{' '}
              <span className="font-medium">{data.payload.value?.toLocaleString()}</span>
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customNode = (props: any) => {
    const { x, y, width, height, _index, payload } = props;
    const isOut = x + width + 6 > props.containerWidth;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={nodeColor}
          fillOpacity="0.8"
        />
        <text
          x={isOut ? x - 6 : x + width + 6}
          y={y + height / 2}
          textAnchor={isOut ? 'end' : 'start'}
          fontSize="14"
          fontWeight="600"
        >
          {payload.name}
        </text>
        <text
          x={isOut ? x - 6 : x + width + 6}
          y={y + height / 2 + 16}
          textAnchor={isOut ? 'end' : 'start'}
          fontSize="12"
          fill="#666"
        >
          {payload.value?.toLocaleString()}
        </text>
      </g>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customLink = (props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, _payload } = props;

    return (
      <path
        d={`
          M${sourceX},${sourceY + linkWidth / 2}
          C${sourceControlX},${sourceY + linkWidth / 2}
          ${targetControlX},${targetY + linkWidth / 2}
          ${targetX},${targetY + linkWidth / 2}
        `}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={linkWidth}
        strokeOpacity={linkOpacity}
        className="transition-opacity hover:stroke-opacity-80"
      />
    );
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <Sankey
          data={data}
          node={customNode}
          link={customLink}
          nodePadding={50}
          margin={{ top: 20, right: 150, bottom: 20, left: 150 }}
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Node size and link width represent flow volume</p>
      </div>
    </div>
  );
}

export default SankeyChart;

