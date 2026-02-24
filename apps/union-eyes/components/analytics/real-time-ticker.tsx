/**
 * Analytics Real-Time Ticker Component
 * 
 * Live metrics display with:
 * - Real-time data updates via WebSocket/polling
 * - Animated value transitions
 * - Multiple metric support
 * - Trend indicators (up/down arrows)
 * - Color-coded changes
 * - Sparkline charts
 * - Configurable refresh intervals
 * - Responsive layout
 * 
 * @module components/analytics/real-time-ticker
 */

"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Vote,
  Award,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricData {
  id: string;
  label: string;
  value: number;
  previousValue?: number;
  icon?: React.ReactNode;
  format?: "number" | "currency" | "percentage";
  unit?: string;
  trend?: "up" | "down" | "neutral";
  changePercentage?: number;
  sparklineData?: number[];
  color?: string;
}

interface RealTimeTickerProps {
  metrics: MetricData[];
  refreshInterval?: number; // milliseconds
  onRefresh?: () => Promise<MetricData[]>;
  showSparklines?: boolean;
  compact?: boolean;
}

export function RealTimeTicker({
  metrics: initialMetrics,
  refreshInterval = 5000,
  onRefresh,
  showSparklines = true,
  compact = false,
}: RealTimeTickerProps) {
  const [metrics, setMetrics] = useState<MetricData[]>(initialMetrics);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (onRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(async () => {
        await handleRefresh();
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh, refreshInterval]);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const newMetrics = await onRefresh();
      setMetrics((prevMetrics) =>
        newMetrics.map((newMetric) => {
          const oldMetric = prevMetrics.find((m) => m.id === newMetric.id);
          return {
            ...newMetric,
            previousValue: oldMetric?.value,
          };
        })
      );
      setLastUpdate(new Date());
    } catch (_error) {
} finally {
      setIsRefreshing(false);
    }
  };

  const manualRefresh = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    await handleRefresh();
    if (onRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(handleRefresh, refreshInterval);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {metrics.map((metric) => (
          <CompactMetricCard key={metric.id} metric={metric} />
        ))}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={manualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Live Metrics</h3>
          <Badge variant="secondary" className="text-xs animate-pulse">
            LIVE
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last updated:{" "}
            {lastUpdate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={manualRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            showSparkline={showSparklines}
          />
        ))}
      </div>
    </div>
  );
}

// Full Metric Card
function MetricCard({
  metric,
  showSparkline,
}: {
  metric: MetricData;
  showSparkline: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(metric.previousValue || metric.value);

  useEffect(() => {
    // Animate value change
    const duration = 1000; // 1 second
    const steps = 30;
    const stepDuration = duration / steps;
    const valueChange = metric.value - displayValue;
    const stepValue = valueChange / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(metric.value);
        clearInterval(interval);
      } else {
        setDisplayValue((prev) => prev + stepValue);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric.value]);

  const formatValue = (value: number): string => {
    switch (metric.format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case "percentage":
        return `${value.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat("en-US").format(Math.round(value));
    }
  };

  const getTrendIcon = () => {
    if (!metric.trend || metric.trend === "neutral") {
      return <Minus className="w-4 h-4" />;
    }
    return metric.trend === "up" ? (
      <TrendingUp className="w-4 h-4" />
    ) : (
      <TrendingDown className="w-4 h-4" />
    );
  };

  const getTrendColor = () => {
    if (!metric.trend || metric.trend === "neutral") return "text-muted-foreground";
    return metric.trend === "up" ? "text-green-500" : "text-red-500";
  };

  return (
    <Card className={metric.color ? `border-l-4 ${metric.color}` : ""}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            {metric.icon}
            <span className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                  {getTrendIcon()}
                  {metric.changePercentage !== undefined && (
                    <span className="text-xs font-medium">
                      {Math.abs(metric.changePercentage).toFixed(1)}%
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {metric.trend === "up" ? "Increased" : metric.trend === "down" ? "Decreased" : "No change"}{" "}
                  {metric.changePercentage !== undefined &&
                    `by ${Math.abs(metric.changePercentage).toFixed(1)}%`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-1">
          <div className="text-3xl font-bold">
            {formatValue(displayValue)}
            {metric.unit && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {metric.unit}
              </span>
            )}
          </div>

          {metric.previousValue !== undefined && (
            <div className="text-xs text-muted-foreground">
              Previous: {formatValue(metric.previousValue)}
            </div>
          )}
        </div>

        {showSparkline && metric.sparklineData && metric.sparklineData.length > 0 && (
          <div className="mt-4">
            <Sparkline
              data={metric.sparklineData}
              color={metric.trend === "up" ? "#22c55e" : metric.trend === "down" ? "#ef4444" : "#6b7280"}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact Metric Card
function CompactMetricCard({ metric }: { metric: MetricData }) {
  const formatValue = (value: number): string => {
    switch (metric.format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          notation: "compact",
        }).format(value);
      case "percentage":
        return `${value.toFixed(0)}%`;
      default:
        return new Intl.NumberFormat("en-US", {
          notation: "compact",
        }).format(value);
    }
  };

  const getTrendIcon = () => {
    if (!metric.trend || metric.trend === "neutral") return null;
    return metric.trend === "up" ? (
      <TrendingUp className="w-3 h-3 text-green-500" />
    ) : (
      <TrendingDown className="w-3 h-3 text-red-500" />
    );
  };

  return (
    <Card className="shrink-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {metric.icon && <div className="text-muted-foreground">{metric.icon}</div>}
          <div>
            <div className="text-xs text-muted-foreground">{metric.label}</div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">{formatValue(metric.value)}</span>
              {getTrendIcon()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sparkline Chart
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 200;
  const height = 40;
  const padding = 2;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="w-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Predefined metric icons
export const MetricIcons = {
  members: <Users className="w-5 h-5" />,
  documents: <FileText className="w-5 h-5" />,
  revenue: <DollarSign className="w-5 h-5" />,
  events: <Calendar className="w-5 h-5" />,
  votes: <Vote className="w-5 h-5" />,
  certifications: <Award className="w-5 h-5" />,
  activity: <Activity className="w-5 h-5" />,
};

// Example usage with mock data generator
export function useRealtimeMetrics(fetchMetrics: () => Promise<MetricData[]>) {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await fetchMetrics();
      setMetrics(data);
      setLoading(false);
      return data;
    } catch (error) {
throw error;
    }
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { metrics, loading, refresh };
}

