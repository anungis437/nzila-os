/**
 * Chart Component Types
 * 
 * TypeScript type definitions for all chart components
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

// ScatterChart types
export interface ScatterChartProps {
  data: Array<{
    x: number;
    y: number;
    z?: number;
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

// BubbleChart types
export interface BubbleChartProps {
  data: Array<{
    x: number;
    y: number;
    z: number;
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

// TreemapChart types
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

// SankeyChart types
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

// BoxPlotChart types
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

// CandlestickChart types
export interface CandlestickData {
  date: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlestickChartProps {
  data: CandlestickData[];
  title?: string;
  showGrid?: boolean;
  showVolume?: boolean;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
}

// FunnelChart types
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

// WaterfallChart types
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

// GaugeChart types
export interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  title?: string;
  unit?: string;
  thresholds?: Array<{ value: number; color: string; label?: string }>;
  height?: number;
  showValue?: boolean;
}

// SunburstChart types
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

