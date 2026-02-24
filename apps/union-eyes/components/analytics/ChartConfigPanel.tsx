/**
 * Chart Configuration Panel Component
 * 
 * Configuration interface for 19 chart types with live preview
 * Supports customization of colors, axes, labels, and more
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.2 - Report Builder UI Enhancement
 */

'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  TrendingUp,
  ScatterChart as ScatterChartIcon,
  Gauge,
  Filter,
  Circle,
  Square,
  Settings,
  Share2,
  Table,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================================================
// Types
// ============================================================================

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'bubble'
  | 'treemap'
  | 'funnel'
  | 'gauge'
  | 'waterfall'
  | 'sankey'
  | 'boxplot'
  | 'candlestick'
  | 'sunburst'
  | 'radar'
  | 'heatmap'
  | 'composed'
  | 'stacked_bar'
  | 'table';

export interface ChartConfig {
  type: ChartType;
  title?: string;
  subtitle?: string;
  xAxis?: {
    field: string;
    label?: string;
    showGrid?: boolean;
  };
  yAxis?: {
    fields: string[];
    label?: string;
    showGrid?: boolean;
    min?: number;
    max?: number;
  };
  colors?: string[];
  legend?: {
    show: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
  };
  tooltip?: {
    enabled: boolean;
    format?: string;
  };
  dataLabels?: {
    enabled: boolean;
    position?: 'top' | 'center' | 'bottom';
  };
  stacked?: boolean;
  horizontal?: boolean;
}

interface ChartConfigPanelProps {
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  availableFields: { id: string; name: string; type: string }[];
  className?: string;
}

// ============================================================================
// Chart Type Definitions
// ============================================================================

const CHART_TYPES: Array<{
  type: ChartType;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'basic' | 'advanced' | 'specialized';
}> = [
  {
    type: 'bar',
    name: 'Bar Chart',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Compare values across categories',
    category: 'basic',
  },
  {
    type: 'line',
    name: 'Line Chart',
    icon: <LineChartIcon className="w-5 h-5" />,
    description: 'Show trends over time',
    category: 'basic',
  },
  {
    type: 'pie',
    name: 'Pie Chart',
    icon: <PieChartIcon className="w-5 h-5" />,
    description: 'Show proportions of a whole',
    category: 'basic',
  },
  {
    type: 'area',
    name: 'Area Chart',
    icon: <AreaChartIcon className="w-5 h-5" />,
    description: 'Show cumulative trends',
    category: 'basic',
  },
  {
    type: 'scatter',
    name: 'Scatter Plot',
    icon: <ScatterChartIcon className="w-5 h-5" />,
    description: 'Show correlation between variables',
    category: 'advanced',
  },
  {
    type: 'bubble',
    name: 'Bubble Chart',
    icon: <Circle className="w-5 h-5" />,
    description: '3D scatter with size dimension',
    category: 'advanced',
  },
  {
    type: 'treemap',
    name: 'Treemap',
    icon: <Square className="w-5 h-5" />,
    description: 'Hierarchical data visualization',
    category: 'advanced',
  },
  {
    type: 'funnel',
    name: 'Funnel Chart',
    icon: <Filter className="w-5 h-5" />,
    description: 'Show stages in a process',
    category: 'specialized',
  },
  {
    type: 'gauge',
    name: 'Gauge Chart',
    icon: <Gauge className="w-5 h-5" />,
    description: 'Display single metric with target',
    category: 'specialized',
  },
  {
    type: 'waterfall',
    name: 'Waterfall Chart',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Show cumulative effects',
    category: 'specialized',
  },
  {
    type: 'sankey',
    name: 'Sankey Diagram',
    icon: <Share2 className="w-5 h-5" />,
    description: 'Visualize flow between nodes',
    category: 'specialized',
  },
  {
    type: 'boxplot',
    name: 'Box Plot',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Statistical distribution visualization',
    category: 'advanced',
  },
  {
    type: 'candlestick',
    name: 'Candlestick Chart',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Financial OHLC data visualization',
    category: 'specialized',
  },
  {
    type: 'sunburst',
    name: 'Sunburst Chart',
    icon: <Circle className="w-5 h-5" />,
    description: 'Radial hierarchical visualization',
    category: 'advanced',
  },
  {
    type: 'stacked_bar',
    name: 'Stacked Bar',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Compare parts across categories',
    category: 'basic',
  },
  {
    type: 'composed',
    name: 'Composed Chart',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Combine multiple chart types',
    category: 'advanced',
  },
  {
    type: 'radar',
    name: 'Radar Chart',
    icon: <Circle className="w-5 h-5" />,
    description: 'Multi-variable comparison',
    category: 'advanced',
  },
  {
    type: 'heatmap',
    name: 'Heatmap',
    icon: <Square className="w-5 h-5" />,
    description: 'Matrix of color-coded values',
    category: 'advanced',
  },
  {
    type: 'table',
    name: 'Data Table',
    icon: <Table className="w-5 h-5" />,
    description: 'Tabular data display',
    category: 'basic',
  },
];

// ============================================================================
// Color Schemes
// ============================================================================

const COLOR_SCHEMES: Array<{
  name: string;
  colors: string[];
}> = [
  {
    name: 'Default',
    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
  },
  {
    name: 'Professional',
    colors: ['#1e40af', '#dc2626', '#047857', '#b45309', '#6d28d9', '#be185d'],
  },
  {
    name: 'Pastel',
    colors: ['#93c5fd', '#fca5a5', '#6ee7b7', '#fcd34d', '#c4b5fd', '#f9a8d4'],
  },
  {
    name: 'Monochrome',
    colors: ['#1f2937', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
  },
  {
    name: 'Vibrant',
    colors: ['#06b6d4', '#f43f5e', '#84cc16', '#f97316', '#a855f7', '#ec4899'],
  },
];

// ============================================================================
// Component
// ============================================================================

export function ChartConfigPanel({
  config,
  onChange,
  availableFields,
  className,
}: ChartConfigPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('basic');

  // Filter chart types by category
  const filteredChartTypes = CHART_TYPES.filter(
    (ct) => selectedCategory === 'all' || ct.category === selectedCategory
  );

  // Update config
  const updateConfig = (updates: Partial<ChartConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Update nested config
  const updateNestedConfig = <K extends keyof ChartConfig>(
    key: K,
    updates: Partial<NonNullable<ChartConfig[K]>>
  ) => {
    onChange({
      ...config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key]: { ...(config[key] as any), ...updates },
    });
  };

  // Get numeric fields
  const numericFields = availableFields.filter(
    (f) => f.type === 'number' || f.type === 'integer' || f.type === 'decimal'
  );

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Chart Configuration
          </h3>
          <p className="text-sm text-gray-600">
            Customize your chart visualization
          </p>
        </div>

        <Tabs defaultValue="type" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="type">Type</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
          </TabsList>

          {/* Chart Type Tab */}
          <TabsContent value="type" className="space-y-4">
            <div>
              <Label>Chart Category</Label>
              <Tabs
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 w-full mt-2">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger value="specialized">Specialized</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-2 gap-3">
                {filteredChartTypes.map((chartType) => (
                  <Card
                    key={chartType.type}
                    className={`p-4 cursor-pointer transition-all ${
                      config.type === chartType.type
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => updateConfig({ type: chartType.type })}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded ${
                          config.type === chartType.type
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {chartType.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1">
                          {chartType.name}
                        </h4>
                        <p className="text-xs text-gray-600">
                          {chartType.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Data Configuration Tab */}
          <TabsContent value="data" className="space-y-4">
            <div>
              <Label htmlFor="chart-title">Chart Title</Label>
              <Input
                id="chart-title"
                placeholder="Enter chart title..."
                value={config.title || ''}
                onChange={(e) => updateConfig({ title: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="chart-subtitle">Subtitle (optional)</Label>
              <Input
                id="chart-subtitle"
                placeholder="Enter subtitle..."
                value={config.subtitle || ''}
                onChange={(e) => updateConfig({ subtitle: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* X-Axis Configuration */}
            {!['pie', 'gauge', 'treemap'].includes(config.type) && (
              <div>
                <Label htmlFor="x-axis">X-Axis Field</Label>
                <Select
                  value={config.xAxis?.field || ''}
                  onValueChange={(value) =>
                    updateNestedConfig('xAxis', { field: value })
                  }
                >
                  <SelectTrigger id="x-axis" className="mt-1">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="X-Axis label (optional)"
                  value={config.xAxis?.label || ''}
                  onChange={(e) =>
                    updateNestedConfig('xAxis', { label: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
            )}

            {/* Y-Axis Configuration */}
            {!['pie', 'gauge', 'treemap'].includes(config.type) && (
              <div>
                <Label htmlFor="y-axis">Y-Axis Fields</Label>
                <Select
                  value={config.yAxis?.fields?.[0] || ''}
                  onValueChange={(value) =>
                    updateNestedConfig('yAxis', { fields: [value] })
                  }
                >
                  <SelectTrigger id="y-axis" className="mt-1">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {numericFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Y-Axis label (optional)"
                  value={config.yAxis?.label || ''}
                  onChange={(e) =>
                    updateNestedConfig('yAxis', { label: e.target.value })
                  }
                  className="mt-2"
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input
                    type="number"
                    placeholder="Min value"
                    value={config.yAxis?.min ?? ''}
                    onChange={(e) =>
                      updateNestedConfig('yAxis', {
                        min: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Max value"
                    value={config.yAxis?.max ?? ''}
                    onChange={(e) =>
                      updateNestedConfig('yAxis', {
                        max: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Style Tab */}
          <TabsContent value="style" className="space-y-4">
            <div>
              <Label className="mb-3">Color Scheme</Label>
              <div className="space-y-2">
                {COLOR_SCHEMES.map((scheme) => (
                  <Card
                    key={scheme.name}
                    className={`p-3 cursor-pointer transition-all ${
                      JSON.stringify(config.colors) ===
                      JSON.stringify(scheme.colors)
                        ? 'ring-2 ring-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => updateConfig({ colors: scheme.colors })}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{scheme.name}</span>
                      <div className="flex gap-1">
                        {scheme.colors.map((color, idx) => (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded"
                            style={{backgroundColor: color}}
                          />
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <Label>Legend</Label>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm">Show Legend</span>
                <Switch
                  checked={config.legend?.show ?? true}
                  onCheckedChange={(checked) =>
                    updateNestedConfig('legend', { show: checked })
                  }
                />
              </div>

              {config.legend?.show !== false && (
                <Select
                  value={config.legend?.position || 'bottom'}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onValueChange={(value: any) =>
                    updateNestedConfig('legend', { position: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </TabsContent>

          {/* Options Tab */}
          <TabsContent value="options" className="space-y-4">
            <div>
              <Label>Tooltip</Label>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm">Enable Tooltip</span>
                <Switch
                  checked={config.tooltip?.enabled ?? true}
                  onCheckedChange={(checked) =>
                    updateNestedConfig('tooltip', { enabled: checked })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Data Labels</Label>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm">Show Data Labels</span>
                <Switch
                  checked={config.dataLabels?.enabled ?? false}
                  onCheckedChange={(checked) =>
                    updateNestedConfig('dataLabels', { enabled: checked })
                  }
                />
              </div>

              {config.dataLabels?.enabled && (
                <Select
                  value={config.dataLabels?.position || 'top'}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onValueChange={(value: any) =>
                    updateNestedConfig('dataLabels', { position: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {['bar', 'area', 'stacked_bar'].includes(config.type) && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Stacked</Label>
                  <Switch
                    checked={config.stacked ?? false}
                    onCheckedChange={(checked) =>
                      updateConfig({ stacked: checked })
                    }
                  />
                </div>
              </div>
            )}

            {config.type === 'bar' && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Horizontal</Label>
                  <Switch
                    checked={config.horizontal ?? false}
                    onCheckedChange={(checked) =>
                      updateConfig({ horizontal: checked })
                    }
                  />
                </div>
              </div>
            )}

            {!['pie', 'gauge'].includes(config.type) && (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Show X-Axis Grid</Label>
                    <Switch
                      checked={config.xAxis?.showGrid ?? true}
                      onCheckedChange={(checked) =>
                        updateNestedConfig('xAxis', { showGrid: checked })
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Show Y-Axis Grid</Label>
                    <Switch
                      checked={config.yAxis?.showGrid ?? true}
                      onCheckedChange={(checked) =>
                        updateNestedConfig('yAxis', { showGrid: checked })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Current Config Summary */}
        <Card className="p-4 bg-blue-50">
          <h4 className="text-sm font-semibold mb-2">Configuration Summary</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Chart Type:</span>
              <Badge variant="outline">
                {CHART_TYPES.find((ct) => ct.type === config.type)?.name}
              </Badge>
            </div>
            {config.xAxis?.field && (
              <div className="flex justify-between">
                <span className="text-gray-600">X-Axis:</span>
                <span className="font-medium">
                  {
                    availableFields.find((f) => f.id === config.xAxis?.field)
                      ?.name
                  }
                </span>
              </div>
            )}
            {config.yAxis?.fields && config.yAxis.fields.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Y-Axis:</span>
                <span className="font-medium">
                  {config.yAxis.fields.length} field(s)
                </span>
              </div>
            )}
            {config.colors && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Colors:</span>
                <div className="flex gap-1">
                  {config.colors.slice(0, 4).map((color, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded border"
                      style={{backgroundColor: color}}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Card>
  );
}

