/**
 * Compliance Summary Card
 *
 * High-level compliance snapshot for leadership:
 * deadline adherence, response rates, documentation completeness,
 * and recent compliance alerts.
 *
 * @module components/leadership/compliance-summary-card
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Clock, FileText, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface ComplianceMetrics {
  deadlineAdherence: number; // percentage 0-100
  avgResponseTime: number;   // days
  documentationRate: number; // percentage 0-100
  openAlerts: number;
}

export interface ComplianceAlert {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
}

export interface ComplianceSummaryCardProps {
  metrics: ComplianceMetrics;
  alerts: ComplianceAlert[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function adherenceColor(pct: number): string {
  if (pct >= 90) return "text-green-600";
  if (pct >= 70) return "text-amber-600";
  return "text-red-600";
}

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

// ─── Component ────────────────────────────────────────────────

export function ComplianceSummaryCard({
  metrics,
  alerts,
  className,
}: ComplianceSummaryCardProps) {
  const t = useTranslations("leadershipDashboard.compliance");
  const gauges: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
  }> = [
    {
      icon: Clock,
      label: t("deadlineAdherence"),
      value: `${metrics.deadlineAdherence}%`,
      color: adherenceColor(metrics.deadlineAdherence),
    },
    {
      icon: ShieldCheck,
      label: t("avgResponseTime"),
      value: `${metrics.avgResponseTime}d`,
      color: metrics.avgResponseTime <= 5 ? "text-green-600" : "text-amber-600",
    },
    {
      icon: FileText,
      label: t("documentationRate"),
      value: `${metrics.documentationRate}%`,
      color: adherenceColor(metrics.documentationRate),
    },
    {
      icon: AlertTriangle,
      label: t("openAlerts"),
      value: String(metrics.openAlerts),
      color: metrics.openAlerts === 0 ? "text-green-600" : "text-red-600",
    },
  ];

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("title")}</h3>
      </div>

      {/* Metric gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {gauges.map((g) => {
          const Icon = g.icon;
          return (
            <div
              key={g.label}
              className="flex flex-col items-center text-center p-3 rounded-md border"
            >
              <Icon className={cn("h-5 w-5 mb-1", g.color)} />
              <span className={cn("text-xl font-bold", g.color)}>{g.value}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {g.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t("recentAlerts")}
          </h4>
          <div className="space-y-1.5">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-2 text-xs p-2 rounded-md border"
              >
                <Badge
                  variant={SEVERITY_VARIANT[alert.severity] ?? "outline"}
                  className="text-[9px] py-0 px-1.5 shrink-0"
                >
                  {alert.severity}
                </Badge>
                <span className="truncate flex-1">{alert.title}</span>
                <span className="text-muted-foreground shrink-0">
                  {new Date(alert.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
