/**
 * Bubble Chart Component
 * 
 * Three-dimensional scatter plot with bubble size representing a third variable
 * Supports interactive tooltips and category-based coloring
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface BubbleChartProps {
  data: Array<{
    x: number;
    y: number;
    z: number; // Bubble size
    category?: string;
    name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  zAxisLabel?: string;
  title?: string;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBubbleClick?: (data: any) => void;
  height?: number;
  zRange?: [number, number];
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

// ============================================================================
// Component
// ============================================================================

export function BubbleChart({
  data,
  xAxisLabel,
  yAxisLabel,
  zAxisLabel,
  title,
  colors = DEFAULT_COLORS,
  showGrid = true,
  showLegend = true,
  onBubbleClick,
  height = 400,
  zRange = [50, 800],
}: BubbleChartProps) {
  // Group by category
  const categories = Array.from(new Set(data.map(d => d.category).filter(Boolean))) as string[];
  const hasCategories = categories.length > 0;

  const dataSeries = hasCategories
    ? categories.map((category, index) => ({
        name: category,
        data: data.filter(d => d.category === category),
        color: colors[index % colors.length],
      }))
    : [{ name: 'Data', data: data, color: colors[0] }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        {data.name && <p className="font-semibold mb-2">{data.name}</p>}
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">{xAxisLabel || 'X'}:</span> <span className="font-medium">{data.x?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">{yAxisLabel || 'Y'}:</span> <span className="font-medium">{data.y?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">{zAxisLabel || 'Size'}:</span> <span className="font-medium">{data.z?.toLocaleString()}</span></p>
          {data.category && <p><span className="text-gray-600">Category:</span> <span className="font-medium">{data.category}</span></p>}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis type="number" dataKey="x" name={xAxisLabel || 'X'} label={{ value: xAxisLabel || 'X Axis', position: 'insideBottom', offset: -10 }} />
          <YAxis type="number" dataKey="y" name={yAxisLabel || 'Y'} label={{ value: yAxisLabel || 'Y Axis', angle: -90, position: 'insideLeft' }} />
          <ZAxis type="number" dataKey="z" range={zRange} name={zAxisLabel || 'Size'} />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          {showLegend && hasCategories && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
          {dataSeries.map(series => (
            <Scatter
              key={series.name}
              name={series.name}
              data={series.data}
              fill={series.color}
              fillOpacity={0.6}
              onClick={onBubbleClick}
              cursor="pointer"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BubbleChart;

