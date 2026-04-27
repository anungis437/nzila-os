/**
 * KPI Cards — Leadership Dashboard
 *
 * Top-level metrics for union leadership:
 * active grievances, resolved this month, triage time,
 * resolution time, arbitration count, overdue cases.
 *
 * @module components/leadership/kpi-cards
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Gavel,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface KpiMetric {
  label: string;
  value: number | string;
  previousValue?: number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  trendIsPositive?: boolean;
}

export interface KpiCardsProps {
  activeGrievances: number;
  resolvedThisMonth: number;
  avgTriageDays: number;
  avgResolutionDays: number;
  arbitrationCount: number;
  overdueCases: number;
  previousPeriod?: {
    activeGrievances?: number;
    resolvedThisMonth?: number;
    avgTriageDays?: number;
    avgResolutionDays?: number;
    arbitrationCount?: number;
    overdueCases?: number;
  };
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function computeTrend(current: number, previous?: number): "up" | "down" | "flat" {
  if (previous === undefined) return "flat";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function formatDelta(current: number, previous?: number): string {
  if (previous === undefined) return "";
  const diff = current - previous;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff}`;
}

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
};

// ─── Component ────────────────────────────────────────────────

export function KpiCards({
  activeGrievances,
  resolvedThisMonth,
  avgTriageDays,
  avgResolutionDays,
  arbitrationCount,
  overdueCases,
  previousPeriod,
  className,
}: KpiCardsProps) {
  const t = useTranslations("leadershipDashboard.kpi");
  const cards: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    delta: string;
    trend: "up" | "down" | "flat";
    trendPositive: boolean;
    accent: string;
  }> = [
    {
      icon: Briefcase,
      label: t("activeGrievances"),
      value: String(activeGrievances),
      delta: formatDelta(activeGrievances, previousPeriod?.activeGrievances),
      trend: computeTrend(activeGrievances, previousPeriod?.activeGrievances),
      trendPositive: activeGrievances <= (previousPeriod?.activeGrievances ?? activeGrievances),
      accent: "text-blue-600",
    },
    {
      icon: CheckCircle2,
      label: t("resolvedThisMonth"),
      value: String(resolvedThisMonth),
      delta: formatDelta(resolvedThisMonth, previousPeriod?.resolvedThisMonth),
      trend: computeTrend(resolvedThisMonth, previousPeriod?.resolvedThisMonth),
      trendPositive: resolvedThisMonth >= (previousPeriod?.resolvedThisMonth ?? resolvedThisMonth),
      accent: "text-green-600",
    },
    {
      icon: Clock,
      label: t("avgTimeToTriage"),
      value: `${avgTriageDays}d`,
      delta: formatDelta(avgTriageDays, previousPeriod?.avgTriageDays),
      trend: computeTrend(avgTriageDays, previousPeriod?.avgTriageDays),
      trendPositive: avgTriageDays <= (previousPeriod?.avgTriageDays ?? avgTriageDays),
      accent: "text-amber-600",
    },
    {
      icon: Clock,
      label: t("avgTimeToResolution"),
      value: `${avgResolutionDays}d`,
      delta: formatDelta(avgResolutionDays, previousPeriod?.avgResolutionDays),
      trend: computeTrend(avgResolutionDays, previousPeriod?.avgResolutionDays),
      trendPositive: avgResolutionDays <= (previousPeriod?.avgResolutionDays ?? avgResolutionDays),
      accent: "text-orange-600",
    },
    {
      icon: Gavel,
      label: t("arbitrations"),
      value: String(arbitrationCount),
      delta: formatDelta(arbitrationCount, previousPeriod?.arbitrationCount),
      trend: computeTrend(arbitrationCount, previousPeriod?.arbitrationCount),
      trendPositive: arbitrationCount <= (previousPeriod?.arbitrationCount ?? arbitrationCount),
      accent: "text-purple-600",
    },
    {
      icon: AlertTriangle,
      label: t("overdueCases"),
      value: String(overdueCases),
      delta: formatDelta(overdueCases, previousPeriod?.overdueCases),
      trend: computeTrend(overdueCases, previousPeriod?.overdueCases),
      trendPositive: overdueCases <= (previousPeriod?.overdueCases ?? overdueCases),
      accent: "text-red-600",
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4", className)}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", card.accent)} />
              <span className="text-xs text-muted-foreground font-medium">
                {card.label}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold tracking-tight">{card.value}</span>
              {card.delta && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    card.trendPositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  <TrendIcon trend={card.trend} />
                  {card.delta}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
