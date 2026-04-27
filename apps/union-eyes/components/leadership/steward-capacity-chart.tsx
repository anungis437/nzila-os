/**
 * Steward Capacity Chart
 *
 * Horizontal bar chart showing steward workload distribution,
 * overdue cases per steward, and capacity utilization.
 *
 * @module components/leadership/steward-capacity-chart
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Users, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface StewardCapacity {
  stewardId: string;
  stewardName: string;
  activeCases: number;
  overdueCases: number;
  avgDaysPerCase: number;
  resolvedThisMonth: number;
  capacityLimit: number;
}

export interface StewardCapacityChartProps {
  stewards: StewardCapacity[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function utilization(active: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((active / limit) * 100), 100);
}

function utilizationColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-green-500";
}

// ─── Component ────────────────────────────────────────────────

export function StewardCapacityChart({
  stewards,
  className,
}: StewardCapacityChartProps) {
  const t = useTranslations("leadershipDashboard.stewardCapacity");
  const sorted = [...stewards].sort((a, b) => {
    const ua = utilization(a.activeCases, a.capacityLimit);
    const ub = utilization(b.activeCases, b.capacityLimit);
    return ub - ua;
  });

  const totalActive = stewards.reduce((s, st) => s + st.activeCases, 0);
  const totalOverdue = stewards.reduce((s, st) => s + st.overdueCases, 0);
  const avgUtil =
    stewards.length > 0
      ? Math.round(
          stewards.reduce(
            (s, st) => s + utilization(st.activeCases, st.capacityLimit),
            0
          ) / stewards.length
        )
      : 0;

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{t("stewardsCount", { count: stewards.length })}</span>
          <span>·</span>
          <span>{t("activeCasesCount", { count: totalActive })}</span>
          {totalOverdue > 0 && (
            <>
              <span>·</span>
              <span className="text-red-600 font-medium">
                {t("overdueCount", { count: totalOverdue })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Avg utilization */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("avgUtilization")}</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", utilizationColor(avgUtil))}
            style={{ width: `${avgUtil}%` }}
          />
        </div>
        <span className="text-xs font-medium w-10 text-right">{avgUtil}%</span>
      </div>

      {/* Steward bars */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("noData")}
        </p>
      ) : (
        <div className="space-y-3" role="list" aria-label="Steward workload">
          {sorted.map((steward) => {
            const util = utilization(steward.activeCases, steward.capacityLimit);
            return (
              <div key={steward.stewardId} className="space-y-1" role="listitem">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate max-w-[160px]">
                    {steward.stewardName}
                  </span>
                  <div className="flex items-center gap-2">
                    {steward.overdueCases > 0 && (
                      <span className="flex items-center gap-0.5 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {steward.overdueCases}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {steward.activeCases}/{steward.capacityLimit}
                    </span>
                    <Badge
                      variant={util >= 90 ? "destructive" : util >= 70 ? "secondary" : "outline"}
                      className="text-[9px] py-0 px-1"
                    >
                      {util}%
                    </Badge>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", utilizationColor(util))}
                    style={{ width: `${util}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{t("perCase", { days: steward.avgDaysPerCase })}</span>
                  <span>{t("resolvedMonth", { count: steward.resolvedThisMonth })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
