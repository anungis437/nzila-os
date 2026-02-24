'use client';

/**
 * Trend Chart Component
 * Renders line, area, or bar charts for trend visualization
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';

interface TrendChartProps {
  data: Array<{ date: string | Date; value: number }>;
  type?: 'line' | 'area' | 'bar';
  color?: string;
  height?: number;
}

export function TrendChart({
  data,
  type = 'line',
  color = '#3b82f6',
  height = 300
}: TrendChartProps) {
  const formattedData = useMemo(() => {
    return data.map(item => ({
      date: typeof item.date === 'string' ? new Date(item.date) : item.date,
      value: item.value,
      formattedDate: format(
        typeof item.date === 'string' ? new Date(item.date) : item.date,
        'MMM dd'
      )
    }));
  }, [data]);

  if (!formattedData || formattedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    );
  }

  const commonProps = {
    width: '100%',
    height,
    data: formattedData,
    margin: { top: 5, right: 30, left: 20, bottom: 5 }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">{payload[0].payload.formattedDate}</p>
          <p className="text-sm text-primary">
            Value: {payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  switch (type) {
    case 'area':
      return (
        <ResponsiveContainer {...commonProps}>
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="formattedDate"
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis className="text-xs" stroke="currentColor" />
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer {...commonProps}>
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="formattedDate"
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis className="text-xs" stroke="currentColor" />
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    default: // line
      return (
        <ResponsiveContainer {...commonProps}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="formattedDate"
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis className="text-xs" stroke="currentColor" />
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );
  }
}

