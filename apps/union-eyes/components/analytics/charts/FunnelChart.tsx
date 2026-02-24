/**
 * Funnel Chart Component
 * 
 * Visualizes stages in a conversion process with decreasing values
 * Commonly used for sales pipelines, conversion funnels, etc.
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FunnelChartProps {
  data: Array<{
    stage: string;
    value: number;
    color?: string;
  }>;
  title?: string;
  showValues?: boolean;
  showPercentages?: boolean;
  height?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStageClick?: (stage: any) => void;
}

// ============================================================================
// Default Colors
// ============================================================================

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
];

// ============================================================================
// Component
// ============================================================================

export function FunnelChart({
  data,
  title,
  showValues = true,
  showPercentages = true,
  height = 400,
  onStageClick,
}: FunnelChartProps) {
  // Calculate percentages based on first stage
  const firstValue = data[0]?.value || 1;
  const dataWithPercentages = data.map((item, index) => ({
    ...item,
    percentage: (item.value / firstValue) * 100,
    color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    dropoff: index > 0 ? data[index - 1].value - item.value : 0,
    dropoffPercentage: index > 0 
      ? ((data[index - 1].value - item.value) / data[index - 1].value) * 100 
      : 0,
  }));

  // Calculate widths (trapezoid effect)
  const maxWidth = 100;
  const minWidth = 20;

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-6 text-center">{title}</h3>}
      
      <div className="relative mx-auto" style={{ maxWidth: '600px', height }}>
        {dataWithPercentages.map((item, index) => {
          const width = minWidth + ((maxWidth - minWidth) * item.percentage) / 100;
          const marginTop = index === 0 ? 0 : 8;

          return (
            <div key={index} className="mb-2" style={{ marginTop }}>
              {/* Stage bar */}
              <div
                className="relative mx-auto cursor-pointer transition-all hover:brightness-110"
                style={{
                  width: `${width}%`,
                  height: `${(height - (data.length - 1) * 8) / data.length}px`,
                  backgroundColor: item.color,
                  clipPath: index === data.length - 1
                    ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                    : 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)',
                }}
                onClick={() => onStageClick?.(item)}
              >
                {/* Stage content */}
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="font-semibold">{item.stage}</div>
                    <div className="text-sm mt-1">
                      {showValues && (
                        <span>{item.value.toLocaleString()}</span>
                      )}
                      {showValues && showPercentages && ' • '}
                      {showPercentages && (
                        <span>{item.percentage.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dropoff indicator */}
              {index > 0 && item.dropoff > 0 && (
                <div className="text-center text-sm text-gray-500 mt-1">
                  ↓ {item.dropoff.toLocaleString()} ({item.dropoffPercentage.toFixed(1)}% dropoff)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary statistics */}
      <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {data[0]?.value.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600 mt-1">Started</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {data[data.length - 1]?.value.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600 mt-1">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {((data[data.length - 1]?.value / data[0]?.value) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">Conversion</div>
        </div>
      </div>
    </div>
  );
}

export default FunnelChart;

