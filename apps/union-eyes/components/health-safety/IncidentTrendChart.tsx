/**
 * Incident Trend Chart Component
 * 
 * Displays incident frequency trends over time with:
 * - Line/bar chart visualization
 * - Multiple incident types
 * - Period selection
 * - Responsive design
 * 
 * @module components/health-safety/IncidentTrendChart
 */

"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

export interface IncidentTrendChartProps {
  organizationId: string;
  period?: "7d" | "30d" | "90d" | "12m";
  chartType?: "line" | "bar";
}

interface TrendData {
  date: string;
  minor: number;
  major: number;
  critical: number;
  total: number;
}

export function IncidentTrendChart({
  organizationId,
  period = "30d",
  chartType = "line"
}: IncidentTrendChartProps) {
  const { toast } = useToast();
  const [data, setData] = React.useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadTrendData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/health-safety/incidents/trends?organizationId=${organizationId}&period=${period}`
      );

      if (!response.ok) {
        throw new Error("Failed to load trend data");
      }

      const result = await response.json();
      if (result.success) {
        setData(Array.isArray(result.data) ? result.data : []);
      } else {
        throw new Error(result.error);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load incident trends",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, period, toast]);

  React.useEffect(() => {
    loadTrendData();
  }, [loadTrendData]);

  if (isLoading) {
    return (
      <div className="h-[300px] w-full">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">No incident data available</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {chartType === "line" ? (
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="minor" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Minor"
            />
            <Line 
              type="monotone" 
              dataKey="major" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Major"
            />
            <Line 
              type="monotone" 
              dataKey="critical" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Critical"
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '6px'
              }}
            />
            <Legend />
            <Bar dataKey="minor" fill="#10b981" name="Minor" />
            <Bar dataKey="major" fill="#f59e0b" name="Major" />
            <Bar dataKey="critical" fill="#ef4444" name="Critical" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
