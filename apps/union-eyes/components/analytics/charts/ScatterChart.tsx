/**
 * Scatter Chart Component
 * 
 * Visualizes correlation between two variables with optional drill-down
 * Supports color coding by category and bubble sizing
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface ScatterChartProps {
  data: Array<{
    x: number;
    y: number;
    z?: number; // Optional size dimension
    category?: string;
    name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  title?: string;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPointClick?: (data: any) => void;
  height?: number;
  xDomain?: [number | 'auto', number | 'auto'];
  yDomain?: [number | 'auto', number | 'auto'];
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

// ============================================================================
// Component
// ============================================================================

export function ScatterChart({
  data,
  xAxisLabel,
  yAxisLabel,
  title,
  colors = DEFAULT_COLORS,
  showGrid = true,
  showLegend = true,
  onPointClick,
  height = 400,
  xDomain,
  yDomain,
}: ScatterChartProps) {
  // Group data by category if category field exists
  const categories = Array.from(new Set(data.map(d => d.category).filter(Boolean))) as string[];
  const hasCategories = categories.length > 0;

  // Prepare data series by category
  const dataSeries = hasCategories
    ? categories.map((category, index) => ({
        name: category,
        data: data.filter(d => d.category === category),
        color: colors[index % colors.length],
      }))
    : [{
        name: 'Data',
        data: data,
        color: colors[0],
      }];

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        {data.name && (
          <p className="font-semibold mb-2">{data.name}</p>
        )}
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-600">{xAxisLabel || 'X'}:</span>{' '}
            <span className="font-medium">{data.x?.toLocaleString()}</span>
          </p>
          <p>
            <span className="text-gray-600">{yAxisLabel || 'Y'}:</span>{' '}
            <span className="font-medium">{data.y?.toLocaleString()}</span>
          </p>
          {data.z !== undefined && (
            <p>
              <span className="text-gray-600">Size:</span>{' '}
              <span className="font-medium">{data.z?.toLocaleString()}</span>
            </p>
          )}
          {data.category && (
            <p>
              <span className="text-gray-600">Category:</span>{' '}
              <span className="font-medium">{data.category}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  // Handle point click
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (data: any) => {
    if (onPointClick) {
      onPointClick(data);
    }
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsScatterChart
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          
          <XAxis
            type="number"
            dataKey="x"
            name={xAxisLabel || 'X'}
            label={{
              value: xAxisLabel || 'X Axis',
              position: 'insideBottom',
              offset: -10,
            }}
            domain={xDomain}
          />
          
          <YAxis
            type="number"
            dataKey="y"
            name={yAxisLabel || 'Y'}
            label={{
              value: yAxisLabel || 'Y Axis',
              angle: -90,
              position: 'insideLeft',
            }}
            domain={yDomain}
          />
          
          {data.some(d => d.z !== undefined) && (
            <ZAxis type="number" dataKey="z" range={[50, 400]} name="Size" />
          )}
          
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          
          {showLegend && hasCategories && (
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
          )}

          {dataSeries.map((series, _index) => (
            <Scatter
              key={series.name}
              name={series.name}
              data={series.data}
              fill={series.color}
              onClick={handleClick}
              cursor="pointer"
            />
          ))}
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export default ScatterChart;

