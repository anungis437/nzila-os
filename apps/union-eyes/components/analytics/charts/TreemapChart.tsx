/**
 * Treemap Chart Component
 * 
 * Hierarchical data visualization using nested rectangles
 * Size represents value, color can represent category or metric
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface TreemapChartProps {
  data: Array<{
    name: string;
    size: number;
    children?: Array<{
      name: string;
      size: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>;
  title?: string;
  colors?: string[];
  height?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNodeClick?: (data: any) => void;
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#14b8a6', '#f43f5e', '#6366f1', '#84cc16',
];

// ============================================================================
// Component
// ============================================================================

export function TreemapChart({
  data,
  title,
  colors = DEFAULT_COLORS,
  height = 500,
  onNodeClick,
}: TreemapChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-600">Value:</span>{' '}
            <span className="font-medium">{data.size?.toLocaleString()}</span>
          </p>
          {data.parent && (
            <p>
              <span className="text-gray-600">Parent:</span>{' '}
              <span className="font-medium">{data.parent}</span>
            </p>
          )}
          {data.percentage && (
            <p>
              <span className="text-gray-600">Percentage:</span>{' '}
              <span className="font-medium">{data.percentage.toFixed(1)}%</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomContent = (props: any) => {
    const { x, y, width, height, index, name, size } = props;
    
    if (width < 40 || height < 40) return null;

    const color = colors[index % colors.length];

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          onClick={() => onNodeClick?.(props)}
          className="cursor-pointer transition-opacity hover:opacity-80"
        />
        <text
          x={x + width / 2}
          y={y + height / 2 - 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
          fontWeight="600"
        >
          {name}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
        >
          {size?.toLocaleString()}
        </text>
      </g>
    );
  };

  // Calculate percentages
  const total = data.reduce((sum, item) => sum + item.size, 0);
  const dataWithPercentages = data.map(item => ({
    ...item,
    percentage: (item.size / total) * 100,
    children: item.children?.map(child => ({
      ...child,
      percentage: (child.size / item.size) * 100,
      parent: item.name,
    })),
  }));

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <Treemap
          data={dataWithPercentages}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#fff"
          // eslint-disable-next-line react-hooks/static-components
          content={<CustomContent />}
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

export default TreemapChart;

