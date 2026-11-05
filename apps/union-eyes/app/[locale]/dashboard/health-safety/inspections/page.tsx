/**
 * Health & Safety - Inspections Management Page
 * 
 * Workplace safety inspections tracking:
 * - Inspection schedule calendar
 * - Inspection details (checklist results, score, notes), opened from the calendar or from a finding
 * - Findings recorded by completed inspections
 * - Statistics read from the inspection statistics route (unknown figures are shown as dashes)
 *
 * Scheduling a new inspection is not offered: no screen for it exists.
 * 
 * @page app/[locale]/dashboard/health-safety/inspections/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { useLocale, useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import Link from "next/link";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  TrendingUp,
  FileText,
} from "lucide-react";
import {
  InspectionScheduleCalendar,
  InspectionReportViewer,
  InspectionFindingsCard,
} from "@/components/health-safety";
import type { InspectionFinding } from "@/components/health-safety/InspectionFindingsCard";
import { useStats } from "@/components/health-safety/use-stats";
import { StatsLoadFailed } from "@/components/health-safety/stats-load-failed";
import { ApiShapeError, asRecord, countOrNull, optionalString, requiredCount, requiredDate, requiredString } from "@/lib/client/row-fields";

const COPY = {
  en: {
    checklistPassed: "Checklist items passed",
    findingsFailed: "The findings could not be loaded.",
    retry: "Retry",
  },
  fr: {
    checklistPassed: "Éléments de la liste de contrôle réussis",
    findingsFailed: "Les constatations n’ont pas pu être chargées.",
    retry: "Réessayer",
  },
} as const;

interface InspectionStats {
  total: number;
  scheduled: number;
  completed: number;
  overdue: number;
  /** Checklist items passed over items checked; null when no inspection was scored. */
  complianceRate: number | null;
  /** Average score of the scored inspections; null when none was scored. */
  avgScore: number | null;
}

function toInspectionStats(data: Record<string, unknown>): InspectionStats {
  return {
    total: requiredCount(data, "total"),
    scheduled: requiredCount(data, "scheduled"),
    completed: requiredCount(data, "completed"),
    overdue: requiredCount(data, "overdue"),
    complianceRate: countOrNull(data, "complianceRate"),
    avgScore: countOrNull(data, "avgScore"),
  };
}

const FINDING_STATUSES: readonly string[] = ["completed", "pending_review", "approved"];

function toFindings(data: Record<string, unknown>): InspectionFinding[] {
  if (!Array.isArray(data.findings)) throw new ApiShapeError("no findings");
  return data.findings.map((value): InspectionFinding => {
    const row = asRecord(value, "finding");
    const status = requiredString(row, "status");
    if (!FINDING_STATUSES.includes(status)) throw new ApiShapeError("unknown finding status");
    return {
      id: requiredString(row, "id"),
      title: requiredString(row, "title"),
      date: requiredDate(row, "date"),
      location: optionalString(row, "location") ?? "",
      inspector: optionalString(row, "inspector") ?? "",
      complianceRate: countOrNull(row, "complianceRate"),
      passCount: requiredCount(row, "passCount"),
      failCount: requiredCount(row, "failCount"),
      naCount: requiredCount(row, "naCount"),
      criticalIssues: requiredCount(row, "criticalIssues"),
      status: status as InspectionFinding["status"],
    };
  });
}

export default function InspectionsPage() {
  const t = useTranslations("healthSafetyInspectionsPage");
  const copy = useLocale().toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  const organizationId = useOrganizationId();

  const [tab, setTab] = useState("calendar");
  const [selectedInspection, setSelectedInspection] = useState<string | null>(null);

  const enabled = Boolean(organizationId);
  const { outcome, reload: reloadStats } = useStats("/api/health-safety/inspections/stats", toInspectionStats, organizationId ?? "", enabled);
  const { outcome: findingsOutcome, reload: reloadFindings } = useStats("/api/health-safety/inspections/findings", toFindings, organizationId ?? "", enabled);
  const stats = outcome?.kind === "ready" ? outcome.stats : null;
  // Loading is "…"; a figure that could not be read, or that the route could not give, is "—": neither is a count of zero.
  const count = (value: number | null | undefined) => (outcome === null ? "…" : value === null || value === undefined ? "—" : value);
  const percent = (value: number | null | undefined) => (outcome === null ? "…" : value === null || value === undefined ? "—" : `${value}%`);

  // An inspection chosen on the calendar or from a finding is shown where its report is.
  const handleViewInspection = (inspectionId: string) => {
    setSelectedInspection(inspectionId);
    setTab("list");
  };

  if (!organizationId) {
    return (
      <div className="p-8 text-center">
        <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">{t("noOrgSelected")}</h2>
        <p className="text-muted-foreground">
          {t("noOrgMessage")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/dashboard/health-safety">
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Link>
            </Button>
          </div>
          
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-green-600" />
              {t("pageTitle")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t("pageSubtitle")}
            </p>
          </div>
        </motion.div>

        {outcome?.kind === "error" && <StatsLoadFailed message={outcome.message} onRetry={reloadStats} />}

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalInspections")}</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{count(stats?.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("scheduled")}: {count(stats?.scheduled)} · {t("completed")}: {count(stats?.completed)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("overdue")}</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{count(stats?.overdue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("requiresAttention")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("complianceRate")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{percent(stats?.complianceRate)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {copy.checklistPassed}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("avgScore")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{percent(stats?.avgScore)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("inspectionResults")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="grid w-full md:w-auto grid-cols-3">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                {t("calendarTab")}
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <FileText className="h-4 w-4" />
                {t("listViewTab")}
              </TabsTrigger>
              <TabsTrigger value="findings" className="gap-2">
                <AlertCircle className="h-4 w-4" />
                {t("findingsTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("inspectionSchedule")}</CardTitle>
                  <CardDescription>
                    {t("inspectionScheduleDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InspectionScheduleCalendar
                    organizationId={organizationId}
                    onViewInspection={handleViewInspection}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("allInspections")}</CardTitle>
                  <CardDescription>
                    {t("allInspectionsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedInspection ? (
                    <InspectionReportViewer
                      inspectionId={selectedInspection}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t("selectInspectionMessage")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="findings" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("recentFindings")}</CardTitle>
                  <CardDescription>
                    {t("recentFindingsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {findingsOutcome === null ? (
                      <Skeleton className="h-40 w-full" />
                    ) : findingsOutcome.kind === "error" ? (
                      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="font-medium">{copy.findingsFailed}</p>
                        <p className="text-sm text-muted-foreground">{findingsOutcome.message}</p>
                        <Button variant="outline" size="sm" onClick={reloadFindings}>
                          {copy.retry}
                        </Button>
                      </div>
                    ) : findingsOutcome.stats.length > 0 ? findingsOutcome.stats.map((finding) => (
                      <InspectionFindingsCard
                        key={finding.id}
                        finding={finding}
                        onViewDetails={handleViewInspection}
                      />
                    )) : (
                      <p className="text-center text-gray-500 py-8">{t("noFindingsMessage")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
