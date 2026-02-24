/**
 * Box Plot Chart Component
 * 
 * Statistical visualization showing distribution quartiles
 * Displays min, Q1, median, Q3, max, and outliers
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface BoxPlotData {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers?: number[];
}

export interface BoxPlotChartProps {
  data: BoxPlotData[];
  title?: string;
  showGrid?: boolean;
  height?: number;
  color?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateBoxPlotStats(values: number[]): Omit<BoxPlotData, 'category'> {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const q1Index = Math.floor(n * 0.25);
  const medianIndex = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);
  
  const q1 = sorted[q1Index];
  const median = sorted[medianIndex];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  
  const nonOutliers = sorted.filter(v => v >= lowerFence && v <= upperFence);
  const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
  
  return {
    min: Math.min(...nonOutliers),
    q1,
    median,
    q3,
    max: Math.max(...nonOutliers),
    outliers: outliers.length > 0 ? outliers : undefined,
  };
}

// ============================================================================
// Component
// ============================================================================

export function BoxPlotChart({
  data,
  title,
  showGrid = true,
  height = 400,
  color = '#3b82f6',
}: BoxPlotChartProps) {
  // Transform data for rendering
  const chartData = data.map(item => ({
    ...item,
    // For bar chart: show box from Q1 to Q3
    boxRange: [item.q1, item.q3],
    // Whiskers will be drawn separately
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">{data.category}</p>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Max:</span> <span className="font-medium">{data.max?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">Q3:</span> <span className="font-medium">{data.q3?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">Median:</span> <span className="font-medium">{data.median?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">Q1:</span> <span className="font-medium">{data.q1?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">Min:</span> <span className="font-medium">{data.min?.toLocaleString()}</span></p>
          {data.outliers && data.outliers.length > 0 && (
            <p><span className="text-gray-600">Outliers:</span> <span className="font-medium">{data.outliers.length}</span></p>
          )}
        </div>
      </div>
    );
  };

  // Custom box plot rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomBox = (props: any) => {
    const { x, _y, width, _height, payload } = props;
    const yScale = props.yAxis.scale;
    
    const minY = yScale(payload.min);
    const q1Y = yScale(payload.q1);
    const medianY = yScale(payload.median);
    const q3Y = yScale(payload.q3);
    const maxY = yScale(payload.max);
    
    const boxX = x + width / 4;
    const boxWidth = width / 2;

    return (
      <g>
        {/* Upper whisker */}
        <line x1={x + width / 2} y1={maxY} x2={x + width / 2} y2={q3Y} stroke={color} strokeWidth={1} />
        <line x1={boxX + boxWidth / 4} y1={maxY} x2={boxX + 3 * boxWidth / 4} y2={maxY} stroke={color} strokeWidth={1} />
        
        {/* Box */}
        <rect x={boxX} y={q3Y} width={boxWidth} height={q1Y - q3Y} fill={color} fillOpacity={0.6} stroke={color} strokeWidth={2} />
        
        {/* Median line */}
        <line x1={boxX} y1={medianY} x2={boxX + boxWidth} y2={medianY} stroke="#fff" strokeWidth={2} />
        
        {/* Lower whisker */}
        <line x1={x + width / 2} y1={q1Y} x2={x + width / 2} y2={minY} stroke={color} strokeWidth={1} />
        <line x1={boxX + boxWidth / 4} y1={minY} x2={boxX + 3 * boxWidth / 4} y2={minY} stroke={color} strokeWidth={1} />
      </g>
    );
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis dataKey="category" />
          <YAxis />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Bar dataKey="q3" shape={<CustomBox />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export { calculateBoxPlotStats };
export default BoxPlotChart;

