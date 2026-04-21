import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type MetricStatus = "healthy" | "warning" | "critical" | "neutral";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  status?: MetricStatus;
  className?: string;
}

const statusBorderMap: Record<MetricStatus, string> = {
  healthy: "border-l-4 border-l-emerald-500",
  warning: "border-l-4 border-l-amber-400",
  critical: "border-l-4 border-l-red-500",
  neutral: "border-l-4 border-l-transparent",
};

const statusValueMap: Record<MetricStatus, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
  neutral: "text-foreground",
};

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  status = "neutral",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "metric-card hover-lift",
        statusBorderMap[status],
        className
      )}
    >
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className={cn("mt-1 text-2xl font-semibold", statusValueMap[status])}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {trend.direction === "up" && (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          )}
          {trend.direction === "down" && (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          {trend.direction === "flat" && (
            <Minus className="h-3 w-3 text-muted-foreground" />
          )}
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
