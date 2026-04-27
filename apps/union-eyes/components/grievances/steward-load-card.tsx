/**
 * Steward Load Card & Workload List
 *
 * Shows workload visibility for stewards:
 * - StewardLoadCard: single-steward detail view
 * - StewardWorkloadList: multi-steward summary with overdue indicators
 *
 * Query model:
 *   SELECT steward_id, COUNT(*)
 *   FROM grievances
 *   WHERE status NOT IN ('RESOLVED','CLOSED')
 *   GROUP BY steward_id
 *
 * @module components/grievances/steward-load-card
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  Clock,
  TrendingUp,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type RepresentationProtocol,
  PROTOCOL_STEWARD_LED,
} from "@/lib/representation/protocol-types";

// ─── Types ────────────────────────────────────────────────────

export interface StewardWorkload {
  activeCases: number;
  overdueCases: number;
  avgDaysInState: number;
  casesThisWeek: number;
}

export interface StewardLoadCardProps {
  stewardName: string;
  workload: StewardWorkload;
  /** Per-org representation protocol — controls header label */
  protocol?: RepresentationProtocol;
  className?: string;
}

export interface StewardSummary {
  stewardId: string;
  stewardName: string;
  activeCases: number;
  overdueCases: number;
}

export interface StewardWorkloadListProps {
  stewards: StewardSummary[];
  organizationId: string;
  /** Per-org representation protocol — controls header label */
  protocol?: RepresentationProtocol;
  className?: string;
  onSelectSteward?: (stewardId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

export function computeLoadLevel(activeCases: number): "light" | "moderate" | "heavy" {
  if (activeCases >= 20) return "heavy";
  if (activeCases >= 10) return "moderate";
  return "light";
}

const LOAD_COLORS = {
  light: "text-green-600 bg-green-50 dark:bg-green-950/20",
  moderate: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
  heavy: "text-red-600 bg-red-50 dark:bg-red-950/20",
} as const;

// ─── Single Steward Card ──────────────────────────────────────

export function StewardLoadCard({
  stewardName,
  workload,
  protocol = PROTOCOL_STEWARD_LED,
  className,
}: StewardLoadCardProps) {
  const t = useTranslations("stewardLoad");
  const loadLevel = computeLoadLevel(workload.activeCases);
  const workloadLabel = `${protocol.representativeLabel} ${t("workloadSuffix")}`;

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{workloadLabel}</p>
          <p className="text-sm font-semibold mt-0.5">{stewardName}</p>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
            LOAD_COLORS[loadLevel]
          )}
        >
          {t(`loadLevels.${loadLevel}` as 'loadLevels.light')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={Briefcase} label={t("metrics.activeCases")} value={workload.activeCases} />
        <Metric icon={AlertTriangle} label={t("metrics.overdue")} value={workload.overdueCases} alert={workload.overdueCases > 0} />
        <Metric icon={Clock} label={t("metrics.avgDays")} value={workload.avgDaysInState} suffix="d" />
        <Metric icon={TrendingUp} label={t("metrics.assignedThisWeek")} value={workload.casesThisWeek} />
      </div>
    </Card>
  );
}

// ─── Multi-Steward Workload List ──────────────────────────────

export function StewardWorkloadList({
  stewards,
  organizationId: _organizationId,
  protocol = PROTOCOL_STEWARD_LED,
  className,
  onSelectSteward,
}: StewardWorkloadListProps) {
  const t = useTranslations("stewardLoad");
  const totalActive = stewards.reduce((sum, s) => sum + s.activeCases, 0);
  const totalOverdue = stewards.reduce((sum, s) => sum + s.overdueCases, 0);
  const workloadLabel = `${protocol.representativeLabel} ${t("workloadSuffix")}`;

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{workloadLabel}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("active", { count: totalActive })}</span>
          {totalOverdue > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">
              {t("overdueBadge", { count: totalOverdue })}
            </Badge>
          )}
        </div>
      </div>

      {stewards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t("noAssignments", { role: protocol.representativeLabel.toLowerCase() })}
        </p>
      ) : (
        <div className="space-y-1" role="list">
          {stewards.map((steward) => {
            const level = computeLoadLevel(steward.activeCases);
            return (
              <button
                key={steward.stewardId}
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors",
                  "hover:bg-muted/50",
                  onSelectSteward && "cursor-pointer"
                )}
                onClick={() => onSelectSteward?.(steward.stewardId)}
                role="listitem"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{steward.stewardName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(steward.activeCases === 1 ? 'activeCaseCount' : 'activeCaseCountPlural', { count: steward.activeCases })}
                  </p>
                </div>
                {steward.overdueCases > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{steward.overdueCases}</span>
                  </div>
                )}
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize",
                    LOAD_COLORS[level]
                  )}
                >
                  {t(`loadLevels.${level}` as 'loadLevels.light')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("p-1.5 rounded", alert ? "bg-red-100 dark:bg-red-900/30" : "bg-muted")}>
        <Icon className={cn("h-3.5 w-3.5", alert ? "text-red-600" : "text-muted-foreground")} />
      </div>
      <div>
        <p className={cn("text-lg font-bold tabular-nums", alert && "text-red-600")}>
          {value}{suffix}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}
