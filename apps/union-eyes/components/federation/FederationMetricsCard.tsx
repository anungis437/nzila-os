/**
 * Federation Metrics Card Component
 * 
 * Displays individual federation KPI metrics with:
 * - Metric value and subtitle
 * - Trend indicator (up/down/stable)
 * - Icon representation
 * - Description text
 * - Color-coded variants
 * 
 * @module components/federation/FederationMetricsCard
 */

"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FederationMetricsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function FederationMetricsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  description,
  variant = "default"
}: FederationMetricsCardProps) {
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

  const iconBgStyles = {
    default: "bg-gray-100 dark:bg-gray-800",
    success: "bg-green-100 dark:bg-green-900/30",
    warning: "bg-orange-100 dark:bg-orange-900/30",
    danger: "bg-red-100 dark:bg-red-900/30"
  };

  return (
    <Card className={cn(variantStyles[variant], "transition-all hover:shadow-md")}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1 mr-2">
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
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          <div className={cn(
            "rounded-full p-3 shrink-0",
            iconBgStyles[variant]
          )}>
            <Icon className={cn("h-5 w-5", iconStyles[variant])} />
          </div>
        </div>

        {trend && trendValue !== undefined && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend === "up" && (
              <>
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-green-600 font-medium">+{trendValue}%</span>
                <span className="text-muted-foreground ml-1">from last period</span>
              </>
            )}
            {trend === "down" && (
              <>
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span className="text-red-600 font-medium">-{trendValue}%</span>
                <span className="text-muted-foreground ml-1">from last period</span>
              </>
            )}
            {trend === "stable" && (
              <>
                <Minus className="h-3 w-3 text-gray-600" />
                <span className="text-gray-600 font-medium">No change</span>
                <span className="text-muted-foreground ml-1">from last period</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
