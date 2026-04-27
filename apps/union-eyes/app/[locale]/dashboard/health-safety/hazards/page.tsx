/**
 * Health & Safety - Hazards Management Page
 * 
 * Workplace hazard identification and tracking:
 * - Hazard reports list and grid view
 * - Priority-based filtering
 * - Status tracking and resolution
 * - Risk assessment
 * - Corrective action management
 * 
 * @page app/[locale]/dashboard/health-safety/hazards/page.tsx
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
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Download,
  TrendingDown,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Grid,
  List,
  Target,
} from "lucide-react";
import {
  HazardsList,
  HazardReportForm,
  CorrectiveActionTracker,
} from "@/components/health-safety";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

type HazardStatus = "reported" | "assessed" | "in-progress" | "resolved" | "closed";
type HazardPriority = "low" | "medium" | "high" | "critical";

export default function HazardsPage() {
  const t = useTranslations("healthSafetyHazardsPage");
  const router = useRouter();
  const organizationId = useOrganizationId();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HazardStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<HazardPriority | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showReportForm, setShowReportForm] = useState(false);

  // Summary statistics
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    critical: 0,
    avgResolutionTime: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/health-safety/hazards/stats?organizationId=${organizationId}`);
      if (res.ok) {
        const json = await res.json();
        setStats({
          total: json.total ?? 0,
          open: json.open ?? 0,
          inProgress: json.inProgress ?? json.in_progress ?? 0,
          resolved: json.resolved ?? 0,
          critical: json.critical ?? 0,
          avgResolutionTime: json.avgResolutionTime ?? json.avg_resolution_time ?? 0,
        });
      }
    } catch (error) {
      logger.error("Failed to load stats:", error);
      toast.error("Failed to load hazard statistics");
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStats();
    }
  }, [organizationId, loadStats]);

  const handleViewHazard = (hazardId: string) => {
    router.push(`/dashboard/health-safety/hazards/${hazardId}`);
  };

  const handleReportSubmit = async () => {
    try {
      await fetch('/api/v2/health-safety/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success("Hazard report submitted successfully");
      setShowReportForm(false);
      loadStats();
    } catch (error) {
      logger.error("Failed to submit hazard report:", error);
      toast.error("Failed to submit hazard report");
    }
  };

  const handleExportData = () => {
    toast.info("Exporting hazard data...");
    // Implement export functionality
  };

  if (!organizationId) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">{t("noOrgSelected")}</h2>
        <p className="text-muted-foreground">
          {t("noOrgMessage")}
        </p>
      </div>
    );
  }

  if (showReportForm) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <Button
              variant="ghost"
              onClick={() => setShowReportForm(false)}
              className="gap-2 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("backToHazards")}
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              {t("reportHazardTitle")}
            </h1>
          </motion.div>

          <HazardReportForm
            organizationId={organizationId}
            onSubmit={handleReportSubmit}
            onCancel={() => setShowReportForm(false)}
          />
        </div>
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
                <AlertTriangle className="h-8 w-8 text-orange-600" />
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
                onClick={() => setShowReportForm(true)}
                className="flex items-center gap-2 bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
              >
                <Plus className="h-4 w-4" />
                {t("reportHazardButton")}
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
              <CardTitle className="text-sm font-medium">{t("totalHazards")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("allTime")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("criticalPriority")}</CardTitle>
              <Target className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("immediateActionRequired")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("inProgress")}</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("beingAddressed")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("avgResolutionTime")}</CardTitle>
              <TrendingDown className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.avgResolutionTime}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("daysUnit")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters and View Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  {t("filtersTitle")}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as HazardStatus | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("statusPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatuses")}</SelectItem>
                    <SelectItem value="reported">{t("reported")}</SelectItem>
                    <SelectItem value="assessed">{t("assessed")}</SelectItem>
                    <SelectItem value="in-progress">{t("inProgress")}</SelectItem>
                    <SelectItem value="resolved">{t("resolved")}</SelectItem>
                    <SelectItem value="closed">{t("closed")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as HazardPriority | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("priorityPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allPriorities")}</SelectItem>
                    <SelectItem value="low">{t("low")}</SelectItem>
                    <SelectItem value="medium">{t("medium")}</SelectItem>
                    <SelectItem value="high">{t("high")}</SelectItem>
                    <SelectItem value="critical">{t("critical")}</SelectItem>
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
          <Tabs defaultValue="hazards" className="space-y-4">
            <TabsList className="grid w-full md:w-auto grid-cols-2">
              <TabsTrigger value="hazards" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("hazardReportsTab")}
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t("correctiveActionsTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hazards" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("allHazards")}</CardTitle>
                  <CardDescription>
                    {t("allHazardsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HazardsList
                    organizationId={organizationId}
                    onViewDetails={handleViewHazard}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>{t("correctiveActions")}</CardTitle>
                  <CardDescription>
                    {t("correctiveActionsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CorrectiveActionTracker
                    organizationId={organizationId}
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
