/**
 * Health & Safety - Incidents Management Page
 * 
 * Comprehensive incident tracking and management:
 * - Incident list table with filtering
 * - Search and advanced filtering
 * - Status tracking and updates
 * - Detailed incident views
 * - Trend analysis
 * 
 * @page app/[locale]/dashboard/health-safety/incidents/page.tsx
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
  FileWarning,
  Search,
  Filter,
  Plus,
  Download,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import {
  IncidentListTable,
  IncidentTrendChart,
} from "@/components/health-safety";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

type IncidentStatus = "reported" | "investigating" | "resolved" | "closed";
type IncidentSeverity = "minor" | "moderate" | "serious" | "critical";

export default function IncidentsPage() {
  const t = useTranslations("healthSafetyIncidentsPage");
  const router = useRouter();
  const organizationId = useOrganizationId();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "all">("all");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "12m">("30d");

  // Summary statistics
  const [stats, setStats] = useState({
    total: 0,
    reported: 0,
    investigating: 0,
    resolved: 0,
    closed: 0,
    avgResolutionTime: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/health-safety/incidents/stats?organizationId=${organizationId}&period=${dateRange}`);
      if (res.ok) {
        const json = await res.json();
        setStats({
          total: json.total ?? 0,
          reported: json.reported ?? 0,
          investigating: json.investigating ?? 0,
          resolved: json.resolved ?? 0,
          closed: json.closed ?? 0,
          avgResolutionTime: json.avgResolutionTime ?? json.avg_resolution_time ?? 0,
        });
      }
    } catch (error) {
      logger.error("Failed to load stats:", error);
      toast.error("Failed to load incident statistics");
    }
  }, [organizationId, dateRange]);

  useEffect(() => {
    if (organizationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStats();
    }
  }, [organizationId, dateRange, loadStats]);

  const handleViewIncident = (incidentId: string) => {
    router.push(`/dashboard/health-safety/incidents/${incidentId}`);
  };

  const handleExportData = () => {
    toast.info("Exporting incident data...");
    // Implement export functionality
  };

  if (!organizationId) {
    return (
      <div className="p-8 text-center">
        <FileWarning className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
                <FileWarning className="h-8 w-8 text-blue-600" />
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
              <Link href="/dashboard/health-safety/incidents/new">
                <Button className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <Plus className="h-4 w-4" />
                  {t("reportIncidentButton")}
                </Button>
              </Link>
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
              <CardTitle className="text-sm font-medium">{t("totalIncidents")}</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("lastPeriod", { period: dateRange })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("underInvestigation")}</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.investigating}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("activeCases")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("resolved")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("thisPeriod")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("avgResolutionTime")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgResolutionTime}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("daysUnit")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters and Search */}
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

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as IncidentStatus | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("statusPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatuses")}</SelectItem>
                    <SelectItem value="reported">{t("reported")}</SelectItem>
                    <SelectItem value="investigating">{t("investigating")}</SelectItem>
                    <SelectItem value="resolved">{t("resolved")}</SelectItem>
                    <SelectItem value="closed">{t("closed")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as IncidentSeverity | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("severityPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allSeverities")}</SelectItem>
                    <SelectItem value="minor">{t("minor")}</SelectItem>
                    <SelectItem value="moderate">{t("moderate")}</SelectItem>
                    <SelectItem value="serious">{t("serious")}</SelectItem>
                    <SelectItem value="critical">{t("critical")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={(value) => setDateRange(value as "7d" | "30d" | "90d" | "12m")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("dateRangePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">{t("last7Days")}</SelectItem>
                    <SelectItem value="30d">{t("last30Days")}</SelectItem>
                    <SelectItem value="90d">{t("last90Days")}</SelectItem>
                    <SelectItem value="12m">{t("last12Months")}</SelectItem>
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
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList className="grid w-full md:w-auto grid-cols-2">
              <TabsTrigger value="list" className="gap-2">
                <FileWarning className="h-4 w-4" />
                {t("incidentListTab")}
              </TabsTrigger>
              <TabsTrigger value="trends" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("trendsTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("allIncidents")}</CardTitle>
                  <CardDescription>
                    {t("allIncidentsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IncidentListTable
                    organizationId={organizationId}
                    onViewDetails={handleViewIncident}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("incidentTrends")}</CardTitle>
                  <CardDescription>
                    {t("incidentTrendsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IncidentTrendChart
                    organizationId={organizationId}
                    period={dateRange}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
