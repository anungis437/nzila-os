/**
 * Waterfall Chart Component
 * 
 * Shows cumulative effect of sequential positive and negative values
 * Commonly used for financial analysis, variance analysis
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface WaterfallChartProps {
  data: Array<{
    name: string;
    value: number;
    isTotal?: boolean;
  }>;
  title?: string;
  showGrid?: boolean;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  totalColor?: string;
}

// ============================================================================
// Component
// ============================================================================

export function WaterfallChart({
  data,
  title,
  showGrid = true,
  height = 400,
  positiveColor = '#10b981',
  negativeColor = '#ef4444',
  totalColor = '#3b82f6',
}: WaterfallChartProps) {
  // Calculate cumulative values
  let cumulative = 0;
  const chartData = data.map((item, _index) => {
    const start = cumulative;
    const value = item.value;
    const end = item.isTotal ? value : cumulative + value;
    
    if (!item.isTotal) {
      // eslint-disable-next-line react-hooks/immutability
      cumulative += value;
    }

    return {
      name: item.name,
      value: Math.abs(value),
      start: item.isTotal ? 0 : start,
      end: end,
      actualValue: value,
      isTotal: item.isTotal || false,
      isPositive: value >= 0,
    };
  });

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
            <span className="font-medium">
              {data.isPositive ? '+' : ''}{data.actualValue.toLocaleString()}
            </span>
          </p>
          {!data.isTotal && (
            <p>
              <span className="text-gray-600">Running Total:</span>{' '}
              <span className="font-medium">{data.end.toLocaleString()}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getBarColor = (entry: any) => {
    if (entry.isTotal) return totalColor;
    return entry.isPositive ? positiveColor : negativeColor;
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            payload={[
              { value: 'Increase', type: 'square', color: positiveColor },
              { value: 'Decrease', type: 'square', color: negativeColor },
              { value: 'Total', type: 'square', color: totalColor },
            ]}
          />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey="value" stackId="a">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WaterfallChart;

