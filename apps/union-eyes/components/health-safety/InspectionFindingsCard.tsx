/**
 * Inspection Findings Card Component
 * 
 * Summary card displaying key inspection findings with:
 * - Compliance rate
 * - Critical issues count
 * - Pass/fail/NA breakdown
 * - Quick navigation to details
 * 
 * @module components/health-safety/InspectionFindingsCard
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface InspectionFinding {
  id: string;
  title: string;
  date: Date;
  location: string;
  inspector: string;
  complianceRate: number | null;
  passCount: number;
  failCount: number;
  naCount: number;
  criticalIssues: number;
  status: "completed" | "pending_review" | "approved";
}

export interface InspectionFindingsCardProps {
  finding: InspectionFinding;
  onViewDetails?: (id: string) => void;
}

export function InspectionFindingsCard({
  finding,
  onViewDetails
}: InspectionFindingsCardProps) {
  const isGoodCompliance = finding.complianceRate !== null && finding.complianceRate >= 90;
  const hasCriticalIssues = finding.criticalIssues > 0;

  return (
    <Card className={cn(
      hasCriticalIssues && "border-red-200 dark:border-red-900"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{finding.title}</CardTitle>
            <CardDescription className="text-xs">
              {format(finding.date, "PPP")} • {finding.location}
            </CardDescription>
          </div>
          <Badge variant={
            finding.status === "approved" ? "default" :
            finding.status === "pending_review" ? "secondary" :
            "outline"
          }>
            {finding.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compliance Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Compliance Rate</span>
            <span className={cn(
              "font-bold",
              isGoodCompliance ? "text-green-600" : "text-orange-600"
            )}>
              {finding.complianceRate === null ? "—" : `${finding.complianceRate}%`}
            </span>
          </div>
          <Progress 
            value={finding.complianceRate ?? 0} 
            className={cn(
              "h-2",
              isGoodCompliance ? "bg-green-100" : "bg-orange-100"
            )}
          />
        </div>

        {/* Critical Issues Alert */}
        {hasCriticalIssues && (
          <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/30 dark:border-red-900">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm text-red-900 dark:text-red-100 font-medium">
              {finding.criticalIssues} critical issue{finding.criticalIssues !== 1 ? 's' : ''} found
            </span>
          </div>
        )}

        {/* Results Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-green-50 rounded-md dark:bg-green-950/30">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium text-green-900 dark:text-green-100">Pass</span>
            </div>
            <p className="text-lg font-bold text-green-600">{finding.passCount}</p>
          </div>

          <div className="p-2 bg-red-50 rounded-md dark:bg-red-950/30">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-3 w-3 text-red-600" />
              <span className="text-xs font-medium text-red-900 dark:text-red-100">Fail</span>
            </div>
            <p className="text-lg font-bold text-red-600">{finding.failCount}</p>
          </div>

          <div className="p-2 bg-gray-50 rounded-md dark:bg-gray-800">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MinusCircle className="h-3 w-3 text-gray-600" />
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">N/A</span>
            </div>
            <p className="text-lg font-bold text-gray-600">{finding.naCount}</p>
          </div>
        </div>

        {/* Inspector */}
        <div className="text-xs text-muted-foreground">
          Inspector: {finding.inspector}
        </div>

        {/* View Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onViewDetails?.(finding.id)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Full Report
        </Button>
      </CardContent>
    </Card>
  );
}
