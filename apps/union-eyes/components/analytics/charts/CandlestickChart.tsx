/**
 * Candlestick Chart Component
 * 
 * Financial chart showing OHLC (Open, High, Low, Close) data
 * Commonly used for stock prices, trading data
 * 
 * Created: December 5, 2025
 * Part of: Phase 2.3 - Advanced Visualizations
 */

'use client';

import React from 'react';
 
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Component
// ============================================================================

export function CandlestickChart({
  data,
  title,
  showGrid = true,
  showVolume: _showVolume = false,
  height = 500,
  positiveColor = '#10b981',
  negativeColor = '#ef4444',
}: CandlestickChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const isPositive = data.close >= data.open;

    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold mb-2">{data.date}</p>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Open:</span> <span className="font-medium">{data.open?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">High:</span> <span className="font-medium text-green-600">{data.high?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">Low:</span> <span className="font-medium text-red-600">{data.low?.toLocaleString()}</span></p>
          <p><span className="text-gray-600">Close:</span> <span className="font-medium">{data.close?.toLocaleString()}</span></p>
          <p className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(data.close - data.open).toLocaleString()} ({((data.close - data.open) / data.open * 100).toFixed(2)}%)
          </p>
          {data.volume && (
            <p><span className="text-gray-600">Volume:</span> <span className="font-medium">{data.volume?.toLocaleString()}</span></p>
          )}
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Candlestick = (props: any) => {
    const { x, _y, width, payload } = props;
    const yScale = props.yAxis.scale;
    
    const isPositive = payload.close >= payload.open;
    const color = isPositive ? positiveColor : negativeColor;
    
    const highY = yScale(payload.high);
    const lowY = yScale(payload.low);
    const openY = yScale(payload.open);
    const closeY = yScale(payload.close);
    
    const candleX = x + width / 4;
    const candleWidth = width / 2;
    const bodyTop = Math.min(openY, closeY);
    const _bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.abs(closeY - openY);

    return (
      <g>
        {/* Wick (high-low line) */}
        <line
          x1={x + width / 2}
          y1={highY}
          x2={x + width / 2}
          y2={lowY}
          stroke={color}
          strokeWidth={1}
        />
        
        {/* Body (open-close rectangle) */}
        <rect
          x={candleX}
          y={bodyTop}
          width={candleWidth}
          height={bodyHeight || 1}
          fill={isPositive ? color : '#fff'}
          stroke={color}
          strokeWidth={2}
        />
      </g>
    );
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          <XAxis 
            dataKey="date" 
            angle={-45} 
            textAnchor="end" 
            height={80}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis domain={['auto', 'auto']} />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Tooltip content={<CustomTooltip />} />
          <ComposedChart data={data}>
            {data.map((entry, index) => (
              <Candlestick key={index} {...entry} />
            ))}
          </ComposedChart>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary */}
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: positiveColor }} />
          <span className="text-gray-600">Bullish</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2" style={{ borderColor: negativeColor }} />
          <span className="text-gray-600">Bearish</span>
        </div>
      </div>
    </div>
  );
}

export default CandlestickChart;

