/**
 * Sunburst Chart Component
 * 
 * Hierarchical data visualization with radial layout
 * Shows part-to-whole relationships across multiple levels
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
  color?: string;
}

export interface SunburstChartProps {
  data: SunburstNode;
  title?: string;
  colors?: string[];
  height?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNodeClick?: (node: any) => void;
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
// Helper Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenHierarchy(node: SunburstNode, level: number = 0, colors: string[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = [];
  
  if (node.children && node.children.length > 0) {
    node.children.forEach((child, index) => {
      result.push({
        name: child.name,
        value: child.value || child.children?.reduce((sum, c) => sum + (c.value || 0), 0) || 1,
        level,
        color: child.color || colors[(level * 3 + index) % colors.length],
      });
      result.push(...flattenHierarchy(child, level + 1, colors));
    });
  }
  
  return result;
}

// ============================================================================
// Component
// ============================================================================

export function SunburstChart({
  data,
  title,
  colors = DEFAULT_COLORS,
  height = 500,
  onNodeClick,
}: SunburstChartProps) {
  const [selectedLevel, setSelectedLevel] = React.useState<number | null>(null);
  
  // Flatten hierarchy into levels
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const levels: any[][] = [];
  let currentLevel = flattenHierarchy(data, 0, colors);
  
  while (currentLevel.length > 0) {
    const levelData = currentLevel.filter(node => node.level === levels.length);
    if (levelData.length === 0) break;
    levels.push(levelData);
    currentLevel = currentLevel.filter(node => node.level > levels.length - 1);
  }

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
            <span className="font-medium">{data.value?.toLocaleString()}</span>
          </p>
          <p>
            <span className="text-gray-600">Level:</span>{' '}
            <span className="font-medium">{data.level + 1}</span>
          </p>
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = (entry: any) => {
    if (entry.percent < 0.05) return ''; // Hide labels for small slices
    return entry.name;
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          {levels.map((levelData, levelIndex) => {
            const innerRadius = 30 + levelIndex * 60;
            const outerRadius = innerRadius + 50;
            const isSelected = selectedLevel === null || selectedLevel === levelIndex;

            return (
              <Pie
                key={levelIndex}
                data={levelData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2}
                label={renderLabel}
                opacity={isSelected ? 1 : 0.4}
                onClick={(data) => {
                  setSelectedLevel(selectedLevel === levelIndex ? null : levelIndex);
                  onNodeClick?.(data);
                }}
              >
                {levelData.map((entry, index) => (
                  <Cell
                    key={`cell-${levelIndex}-${index}`}
                    fill={entry.color}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
            );
          })}
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 mb-2">
          Click on any ring to highlight that level
        </p>
        <div className="flex justify-center gap-4 text-sm">
          {levels.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedLevel(selectedLevel === index ? null : index)}
              className={`px-3 py-1 rounded transition-colors ${
                selectedLevel === index || selectedLevel === null
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Level {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SunburstChart;

