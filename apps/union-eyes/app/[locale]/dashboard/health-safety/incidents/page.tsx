/**
 * Health & Safety - Incidents Management Page
 * 
 * Workplace incident tracking:
 * - Incident list with its own search and filters
 * - Statistics and trends for the chosen period (unknown figures are shown as dashes)
 * - Incident reporting
 *
 * No incident detail page exists, so listed incidents cannot be opened.
 * 
 * @page app/[locale]/dashboard/health-safety/incidents/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import Link from "next/link";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Plus,
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
import { useStats } from "@/components/health-safety/use-stats";
import { StatsLoadFailed } from "@/components/health-safety/stats-load-failed";
import { countOrNull, requiredCount } from "@/lib/client/row-fields";

type DateRange = "7d" | "30d" | "90d" | "12m";

const RANGE_LABEL_KEYS = {
  "7d": "last7Days",
  "30d": "last30Days",
  "90d": "last90Days",
  "12m": "last12Months",
} as const;

interface IncidentStats {
  total: number;
  investigating: number;
  closed: number;
  /** Days from report to closing; null when no incident in the period has been closed. */
  avgResolutionTime: number | null;
}

function toIncidentStats(data: Record<string, unknown>): IncidentStats {
  return {
    total: requiredCount(data, "total"),
    investigating: requiredCount(data, "investigating"),
    closed: requiredCount(data, "closed"),
    avgResolutionTime: countOrNull(data, "avgResolutionTime"),
  };
}

export default function IncidentsPage() {
  const t = useTranslations("healthSafetyIncidentsPage");
  const organizationId = useOrganizationId();

  // The period applies to the statistics and the trends. The list has its own search and filters.
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const { outcome, reload: reloadStats } = useStats(
    `/api/health-safety/incidents/stats?period=${dateRange}`,
    toIncidentStats,
    organizationId ?? "",
    Boolean(organizationId),
  );
  const stats = outcome?.kind === "ready" ? outcome.stats : null;
  // Loading is "…"; a figure that could not be read, or that the route could not give, is "—": neither is a count of zero.
  const figure = (value: number | null | undefined) => (outcome === null ? "…" : value === null || value === undefined ? "—" : value);

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
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/dashboard/health-safety">
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Link>
            </Button>
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
              <Button className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" asChild>
                <Link href="/dashboard/health-safety/incidents/new">
                  <Plus className="h-4 w-4" />
                  {t("reportIncidentButton")}
                </Link>
              </Button>
            </div>
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
              <CardTitle className="text-sm font-medium">{t("totalIncidents")}</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{figure(stats?.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t(RANGE_LABEL_KEYS[dateRange])}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("underInvestigation")}</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{figure(stats?.investigating)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("activeCases")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("closed")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{figure(stats?.closed)}</div>
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
              <div className="text-3xl font-bold">{figure(stats?.avgResolutionTime)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("daysUnit")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Period of the statistics and trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("dateRangePlaceholder")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                <SelectTrigger className="w-full md:w-[240px]" aria-label={t("dateRangePlaceholder")}>
                  <SelectValue placeholder={t("dateRangePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">{t("last7Days")}</SelectItem>
                  <SelectItem value="30d">{t("last30Days")}</SelectItem>
                  <SelectItem value="90d">{t("last90Days")}</SelectItem>
                  <SelectItem value="12m">{t("last12Months")}</SelectItem>
                </SelectContent>
              </Select>
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
                  <IncidentListTable organizationId={organizationId} />
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
