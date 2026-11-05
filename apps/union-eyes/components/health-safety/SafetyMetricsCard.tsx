/**
 * Safety Metrics Card Component
 * 
 * Displays individual safety KPI metrics with:
 * - Metric value
 * - Trend indicator
 * - Icon
 * - Description
 * - Color-coded variants
 * 
 * @module components/health-safety/SafetyMetricsCard
 */

"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SafetyMetricsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: "up" | "down" | "stable";
  /** Percent change, in either direction (its sign is not shown: `trend` says which way). null: no earlier figure to compare with. */
  trendValue?: number | null;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function SafetyMetricsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  description,
  variant = "default"
}: SafetyMetricsCardProps) {
  const variantStyles = {
    default: "border-gray-200 dark:border-gray-800",
    success: "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
    warning: "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20",
    danger: "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
  };

  const iconStyles = {
    default: "text-gray-600 dark:text-gray-400",
    success: "text-green-600 dark:text-green-400",
    warning: "text-orange-600 dark:text-orange-400",
    danger: "text-red-600 dark:text-red-400"
  };

  return (
    <Card className={cn(variantStyles[variant])}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {value}
              </span>
              {subtitle && (
                <span className="text-sm text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className={cn("rounded-full p-3", iconStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {trend && trendValue !== undefined && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend === "up" && (
              <>
                <TrendingUp className="h-3 w-3 text-red-600" />
                <span className="text-red-600 font-medium">{trendValue === null ? "Up" : `+${Math.abs(trendValue)}%`}</span>
              </>
            )}
            {trend === "down" && (
              <>
                <TrendingDown className="h-3 w-3 text-green-600" />
                <span className="text-green-600 font-medium">{trendValue === null ? "Down" : `-${Math.abs(trendValue)}%`}</span>
              </>
            )}
            {trend === "stable" && (
              <>
                <Minus className="h-3 w-3 text-gray-600" />
                <span className="text-gray-600 font-medium">No change</span>
              </>
            )}
            <span className="text-muted-foreground ml-1">vs. last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
