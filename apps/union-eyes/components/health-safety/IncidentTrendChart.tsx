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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
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
import { logger } from "@/lib/logger";
import { ApiShapeError, isRecord, readApiError } from "@/lib/client/api-envelope";
import { asRecord, requiredCount, requiredString } from "@/lib/client/row-fields";

export interface IncidentTrendChartProps {
  organizationId: string;
  period?: "7d" | "30d" | "90d" | "12m";
  chartType?: "line" | "bar";
}

/** Incidents per day (per month over 12 months): minor is minor or near miss, major is moderate or serious, critical is critical or fatal. */
interface TrendData {
  date: string;
  minor: number;
  major: number;
  critical: number;
  total: number;
}

type Outcome = { kind: "ready"; data: TrendData[] } | { kind: "error"; message: string };

function toTrendPoint(value: unknown): TrendData {
  const row = asRecord(value, "trend point");
  return {
    date: requiredString(row, "date"),
    minor: requiredCount(row, "minor"),
    major: requiredCount(row, "major"),
    critical: requiredCount(row, "critical"),
    total: requiredCount(row, "total"),
  };
}

async function readTrend(period: string): Promise<TrendData[]> {
  const response = await fetch(`/api/health-safety/incidents/trends?period=${period}`);
  if (!response.ok) throw new Error(await readApiError(response, `The incident trends could not be loaded (status ${response.status}).`));
  // withApi wraps the route's array as { success, data: [...] }.
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no list");
  return body.data.map(toTrendPoint);
}

export function IncidentTrendChart({
  organizationId,
  period = "30d",
  chartType = "line"
}: IncidentTrendChartProps) {
  const [attempt, setAttempt] = React.useState(0);
  // The answer belongs to the organization and period it was read for: another one's is never drawn while this one loads.
  const [loaded, setLoaded] = React.useState<{ key: string; outcome: Outcome } | null>(null);
  const key = `${organizationId}|${period}|${attempt}`;

  React.useEffect(() => {
    let current = true;
    readTrend(period).then(
      (data) => {
        if (current) setLoaded({ key, outcome: { kind: "ready", data } });
      },
      (error: unknown) => {
        logger.error("Failed to load incident trends", error);
        if (current) setLoaded({ key, outcome: { kind: "error", message: error instanceof Error ? error.message : "The incident trends could not be loaded." } });
      },
    );
    return () => {
      current = false;
    };
  }, [key, period]);

  const outcome = loaded?.key === key ? loaded.outcome : null;

  if (outcome === null) {
    return (
      <div className="h-[300px] w-full">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (outcome.kind === "error") {
    return (
      <div role="alert" className="h-[300px] w-full flex flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">The incident trends could not be loaded.</p>
        <p className="text-sm text-muted-foreground">{outcome.message}</p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  const data = outcome.data;

  if (data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">No incidents were recorded in this period</p>
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
              name="Minor or near miss"
            />
            <Line 
              type="monotone" 
              dataKey="major" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Moderate or serious"
            />
            <Line 
              type="monotone" 
              dataKey="critical" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Critical or fatal"
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
            <Bar dataKey="minor" fill="#10b981" name="Minor or near miss" />
            <Bar dataKey="major" fill="#f59e0b" name="Moderate or serious" />
            <Bar dataKey="critical" fill="#ef4444" name="Critical or fatal" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
