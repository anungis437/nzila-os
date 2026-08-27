/**
 * Health & Safety - Inspections Management Page
 * 
 * Workplace safety inspections tracking and scheduling:
 * - Inspection schedule calendar
 * - Upcoming and overdue inspections
 * - Inspection checklist management
 * - Findings and corrective actions
 * - Compliance reporting
 * 
 * @page app/[locale]/dashboard/health-safety/inspections/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  Search,
  Filter,
  Plus,
  Download,
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
import { toast } from "sonner";
import { logger } from '@/lib/logger';

type InspectionStatus = "scheduled" | "in-progress" | "completed" | "overdue";
type InspectionType = "routine" | "compliance" | "incident-follow-up" | "spot-check";

export default function InspectionsPage() {
  const t = useTranslations("healthSafetyInspectionsPage");
  const router = useRouter();
  const organizationId = useOrganizationId();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<InspectionType | "all">("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter">("month");
  const [selectedInspection, setSelectedInspection] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [findings, setFindings] = useState<any[]>([]);

  // Summary statistics
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    completed: 0,
    overdue: 0,
    complianceRate: 0,
    avgScore: 0,
  });

  const loadFindings = useCallback(async () => {
    try {
      const res = await fetch(`/api/health-safety/inspections/findings?organizationId=${organizationId}`);
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) ? json : json?.findings ?? json?.data ?? [];
        setFindings(items);
      }
    } catch (error) {
      logger.error("Failed to load findings:", error);
    }
  }, [organizationId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/health-safety/inspections/stats?organizationId=${organizationId}`);
      if (res.ok) {
        const json = await res.json();
        setStats({
          total: json.total ?? 0,
          scheduled: json.scheduled ?? 0,
          completed: json.completed ?? 0,
          overdue: json.overdue ?? 0,
          complianceRate: json.complianceRate ?? json.compliance_rate ?? 0,
          avgScore: json.avgScore ?? json.avg_score ?? 0,
        });
      }
    } catch (error) {
      logger.error("Failed to load stats:", error);
      toast.error("Failed to load inspection statistics");
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStats();
       
      loadFindings();
    }
  }, [organizationId, dateRange, loadFindings, loadStats]);

  const handleScheduleInspection = () => {
    router.push("/dashboard/health-safety/inspections/new");
  };

  const handleViewInspection = (inspectionId: string) => {
    setSelectedInspection(inspectionId);
  };

  const handleExportData = () => {
    toast.info("Exporting inspection data...");
    // Implement export functionality
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
            <Link href="/dashboard/health-safety">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <ClipboardCheck className="h-8 w-8 text-green-600" />
                {t("pageTitle")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t("pageSubtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleExportData}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t("exportButton")}
              </Button>
              <Button
                onClick={handleScheduleInspection}
                className="flex items-center gap-2 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Plus className="h-4 w-4" />
                {t("scheduleInspectionButton")}
              </Button>
            </div>
          </div>
        </motion.div>

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
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("thisPeriod", { period: dateRange })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("overdue")}</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
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
              <div className="text-3xl font-bold text-green-600">{stats.complianceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("onTimeCompletion")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("avgScore")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.avgScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("inspectionResults")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t("filtersTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InspectionStatus | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("statusPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatuses")}</SelectItem>
                    <SelectItem value="scheduled">{t("scheduled")}</SelectItem>
                    <SelectItem value="in-progress">{t("inProgress")}</SelectItem>
                    <SelectItem value="completed">{t("completed")}</SelectItem>
                    <SelectItem value="overdue">{t("overdue")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as InspectionType | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allTypes")}</SelectItem>
                    <SelectItem value="routine">{t("routine")}</SelectItem>
                    <SelectItem value="compliance">{t("compliance")}</SelectItem>
                    <SelectItem value="incident-follow-up">{t("incidentFollowUp")}</SelectItem>
                    <SelectItem value="spot-check">{t("spotCheck")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={(value) => setDateRange(value as "week" | "month" | "quarter")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("dateRangePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">{t("thisWeek")}</SelectItem>
                    <SelectItem value="month">{t("thisMonth")}</SelectItem>
                    <SelectItem value="quarter">{t("thisQuarter")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Tabs defaultValue="calendar" className="space-y-4">
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
                    {findings.length > 0 ? findings.map((finding) => (
                      <InspectionFindingsCard
                        key={finding.id}
                        finding={finding}
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
