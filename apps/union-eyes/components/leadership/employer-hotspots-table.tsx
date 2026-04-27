/**
 * Employer Hotspots Table
 *
 * Ranked employer table for leadership showing grievance concentration,
 * category breakdown, trend direction, and last communication date.
 *
 * @module components/leadership/employer-hotspots-table
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Building2, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface EmployerHotspot {
  employerId: string;
  employerName: string;
  activeGrievances: number;
  resolvedThisQuarter: number;
  topCategory: string;
  trend: "increasing" | "decreasing" | "stable";
  avgResolutionDays: number;
  lastCommunicationDate?: string;
  overdueCases: number;
}

export interface EmployerHotspotsTableProps {
  employers: EmployerHotspot[];
  onViewEmployer?: (employerId: string) => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const TrendBadge = ({ trend }: { trend: EmployerHotspot["trend"] }) => {
  const t = useTranslations("leadershipDashboard.employerHotspots.trend");
  const config = {
    increasing: { icon: TrendingUp, label: t("increasing"), variant: "destructive" as const },
    decreasing: { icon: TrendingDown, label: t("decreasing"), variant: "secondary" as const },
    stable: { icon: Minus, label: t("stable"), variant: "outline" as const },
  };
  const { icon: Icon, label, variant } = config[trend];
  return (
    <Badge variant={variant} className="text-[10px] gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

// ─── Component ────────────────────────────────────────────────

export function EmployerHotspotsTable({
  employers,
  onViewEmployer,
  className,
}: EmployerHotspotsTableProps) {
  const t = useTranslations("leadershipDashboard.employerHotspots");
  const sorted = [...employers].sort((a, b) => b.activeGrievances - a.activeGrievances);

  return (
    <Card className={cn("p-4 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {t("employersTracked", { count: employers.length })}
        </span>
      </div>

      {employers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("noData")}
        </p>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">{t("columns.employer")}</TableHead>
                <TableHead className="text-center">{t("columns.active")}</TableHead>
                <TableHead className="text-center">{t("columns.overdue")}</TableHead>
                <TableHead className="text-center">{t("columns.resolvedQtr")}</TableHead>
                <TableHead>{t("columns.topCategory")}</TableHead>
                <TableHead className="text-center">{t("columns.avgDays")}</TableHead>
                <TableHead>{t("columns.trend")}</TableHead>
                <TableHead className="text-right">{t("columns.lastContact")}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((emp) => (
                <TableRow key={emp.employerId}>
                  <TableCell className="font-medium text-sm">
                    {emp.employerName}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "font-semibold",
                        emp.activeGrievances >= 5
                          ? "text-red-600"
                          : emp.activeGrievances >= 3
                            ? "text-amber-600"
                            : "text-foreground"
                      )}
                    >
                      {emp.activeGrievances}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {emp.overdueCases > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {emp.overdueCases}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{emp.resolvedThisQuarter}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {emp.topCategory}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {emp.avgResolutionDays}d
                  </TableCell>
                  <TableCell>
                    <TrendBadge trend={emp.trend} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {emp.lastCommunicationDate
                      ? new Date(emp.lastCommunicationDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {onViewEmployer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onViewEmployer(emp.employerId)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
