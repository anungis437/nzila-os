/**
 * Health & Safety - Hazards Management Page
 * 
 * Workplace hazard identification and tracking:
 * - Hazard reports, filtered by status and level, with search
 * - Statistics read from the hazard statistics route (unknown figures are shown as dashes)
 * - Hazard reporting, also reached with ?report=1 (the dashboard's "Report Hazard" action)
 *
 * No corrective-action tracker is offered: the corrective_actions table is neither declared in the schema nor authorised for the tenant runtime role.
 * No hazard detail page exists, so listed hazards cannot be opened.
 *
 * @page app/[locale]/dashboard/health-safety/hazards/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { useState } from "react";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Plus,
  TrendingDown,
  Clock,
  ArrowLeft,
  Target,
} from "lucide-react";
import {
  HazardsList,
  HazardReportForm,
} from "@/components/health-safety";
import { useStats } from "@/components/health-safety/use-stats";
import { StatsLoadFailed } from "@/components/health-safety/stats-load-failed";
import { countOrNull, requiredCount } from "@/lib/client/row-fields";
import { readApiError } from "@/lib/client/api-envelope";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

interface HazardStats {
  total: number;
  critical: number;
  inProgress: number;
  /** Days from report to resolution; null when no hazard has been resolved. */
  avgResolutionTime: number | null;
}

function toHazardStats(data: Record<string, unknown>): HazardStats {
  return {
    total: requiredCount(data, "total"),
    critical: requiredCount(data, "critical"),
    inProgress: requiredCount(data, "inProgress"),
    avgResolutionTime: countOrNull(data, "avgResolutionTime"),
  };
}

export default function HazardsPage() {
  const t = useTranslations("healthSafetyHazardsPage");
  const organizationId = useOrganizationId();
  const searchParams = useSearchParams();

  const [showReportForm, setShowReportForm] = useState(searchParams.get("report") === "1");

  const { outcome, reload: reloadStats } = useStats("/api/health-safety/hazards/stats", toHazardStats, organizationId ?? "", Boolean(organizationId));
  const stats = outcome?.kind === "ready" ? outcome.stats : null;
  // Loading is "…"; a figure that could not be read, or that the route could not give, is "—": neither is a count of zero.
  const figure = (value: number | null | undefined) => (outcome === null ? "…" : value === null || value === undefined ? "—" : value);

  const handleReportSubmit = async (data: Record<string, unknown>) => {
    // Blank optional fields are left out. The organization is the caller's own: it is never sent, and the route refuses a body that names one.
    const body = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== ""));
    try {
      const res = await fetch('/api/health-safety/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, `The hazard report could not be saved (status ${res.status}).`));
      }
    } catch (error) {
      logger.error("Failed to submit hazard report:", error);
      // The form shows this, and stays open with what was typed.
      throw error;
    }
    toast.success("Hazard report submitted successfully");
    setShowReportForm(false);
    reloadStats();
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
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                {t("pageTitle")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t("pageSubtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3">
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
              <CardTitle className="text-sm font-medium">{t("totalHazards")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{figure(stats?.total)}</div>
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
              <div className="text-3xl font-bold text-red-600">{figure(stats?.critical)}</div>
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
              <div className="text-3xl font-bold text-blue-600">{figure(stats?.inProgress)}</div>
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
              <div className="text-3xl font-bold text-green-600">{figure(stats?.avgResolutionTime)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("daysUnit")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Hazard list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("allHazards")}</CardTitle>
              <CardDescription>
                {t("allHazardsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HazardsList organizationId={organizationId} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
