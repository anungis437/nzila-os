/**
 * Grievance Trends Chart
 *
 * Time-series bar/line chart showing grievance volumes, resolution rates,
 * and category distribution over configurable timeframes.
 * Uses recharts for rendering.
 *
 * @module components/leadership/grievance-trends-chart
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { BarChart3, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface TrendDataPoint {
  period: string;
  filed: number;
  resolved: number;
  escalated: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface GrievanceTrendsChartProps {
  data: TrendDataPoint[];
  categories: CategoryBreakdown[];
  timeframe: "weekly" | "monthly" | "quarterly";
  onTimeframeChange?: (timeframe: "weekly" | "monthly" | "quarterly") => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const BAR_COLORS = {
  filed: "bg-blue-500",
  resolved: "bg-green-500",
  escalated: "bg-red-500",
};

function getMaxValue(data: TrendDataPoint[]): number {
  return Math.max(...data.flatMap((d) => [d.filed, d.resolved, d.escalated]), 1);
}

// ─── Component ────────────────────────────────────────────────

export function GrievanceTrendsChart({
  data,
  categories,
  timeframe,
  onTimeframeChange,
  className,
}: GrievanceTrendsChartProps) {
  const t = useTranslations("grievanceTrends");
  const maxVal = getMaxValue(data);

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> {t("legend.filed")}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> {t("legend.resolved")}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> {t("legend.escalated")}
            </span>
          </div>
          {onTimeframeChange && (
            <Select value={timeframe} onValueChange={onTimeframeChange as (v: string) => void}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{t("timeframe.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("timeframe.monthly")}</SelectItem>
                <SelectItem value="quarterly">{t("timeframe.quarterly")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Chart — accessible CSS bar chart */}
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("noData")}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Bar chart */}
          <div
            className="flex items-end gap-1 h-[200px] overflow-x-auto pb-2"
            role="img"
            aria-label="Grievance trends bar chart"
          >
            {data.map((point) => (
              <div
                key={point.period}
                className="flex-1 min-w-[48px] flex flex-col items-center gap-0.5"
              >
                <div className="flex items-end gap-[2px] h-[170px]">
                  {(["filed", "resolved", "escalated"] as const).map((key) => {
                    const height = maxVal > 0 ? (point[key] / maxVal) * 100 : 0;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "w-3 rounded-t transition-all",
                          BAR_COLORS[key]
                        )}
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${key}: ${point[key]}`}
                        role="presentation"
                      />
                    );
                  })}
                </div>
                <span className="text-[9px] text-muted-foreground truncate max-w-[48px]">
                  {point.period}
                </span>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">{t("topCategories")}</h4>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 6).map((cat) => (
                  <Badge key={cat.category} variant="secondary" className="text-[10px]">
                    {t("categoryItem", { category: cat.category, count: cat.count, percentage: cat.percentage })}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
