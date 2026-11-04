/**
 * Health & Safety Dashboard Component
 * 
 * Main H&S dashboard with:
 * - Key safety metrics and KPIs
 * - Incident trends and analytics
 * - Inspection status overview
 * - Critical alerts and notifications
 * - Quick action buttons
 * - Compliance tracking
 * 
 * @module components/health-safety/HealthSafetyDashboard
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle,
  AlertTriangle, 
  ClipboardCheck,
  FileWarning,
  CheckCircle2,
  RefreshCw,
  Plus
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger";
import { apiErrorMessage } from "@/lib/client/api-envelope";
import { SafetyMetricsCard } from "./SafetyMetricsCard";
import { IncidentTrendChart } from "./IncidentTrendChart";
import { IncidentListTable } from "./IncidentListTable";
import { InspectionScheduleCalendar } from "./InspectionScheduleCalendar";
import { HazardsList } from "./HazardsList";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface SafetyMetrics {
  totalIncidents: number;
  incidentTrend: "up" | "down" | "stable";
  /** Percent against the previous period; null when that period had no incident, so there is nothing to compare with. */
  incidentChange: number | null;
  openHazards: number;
  hazardTrend: "up" | "down" | "stable";
  /** Inspections scheduled in the period, up to today (those already completed included). */
  inspectionsDue: number;
  inspectionsCompleted: number;
  /** null when nothing was measured (no inspections in the period). */
  inspectionComplianceRate: number | null;
  /** null when no incident is on record. */
  daysWithoutIncident: number | null;
  criticalAlerts: number;
  /** null: training compliance is not measured. */
  trainingCompliance: number | null;
  /** Equipment below its reorder level. */
  ppeInventoryLow: number;
}

export interface HealthSafetyDashboardProps {
  organizationId: string;
  period?: "7d" | "30d" | "90d" | "12m";
}

const PERIOD_LABELS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
} as const;

const TRENDS: readonly unknown[] = ["up", "down", "stable"];
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isCountOrNull = (value: unknown): value is number | null => value === null || isCount(value);

/** The route's answer, checked: a figure it did not send is never shown as if it had been measured. */
function isSafetyMetrics(value: unknown): value is SafetyMetrics {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    isCount(m.totalIncidents) &&
    TRENDS.includes(m.incidentTrend) &&
    isCountOrNull(m.incidentChange) &&
    isCount(m.openHazards) &&
    TRENDS.includes(m.hazardTrend) &&
    isCount(m.inspectionsDue) &&
    isCount(m.inspectionsCompleted) &&
    isCountOrNull(m.inspectionComplianceRate) &&
    isCountOrNull(m.daysWithoutIncident) &&
    isCount(m.criticalAlerts) &&
    isCountOrNull(m.trainingCompliance) &&
    isCount(m.ppeInventoryLow)
  );
}

type Outcome = { kind: "ready"; metrics: SafetyMetrics } | { kind: "error"; message: string | null };

async function readMetrics(organizationId: string, period: string): Promise<Outcome> {
  try {
    const response = await fetch(`/api/health-safety/dashboard?organizationId=${organizationId}&period=${period}`);
    const body: unknown = await response.json();
    if (!response.ok) {
      return { kind: "error", message: apiErrorMessage(body, "") || null };
    }
    // withApi wraps the route's { success, metrics } as { success, data, timestamp }.
    const metrics = (body as { data?: { metrics?: unknown } } | null)?.data?.metrics;
    if (!isSafetyMetrics(metrics)) {
      logger.error("Health & safety dashboard answered with an unexpected body");
      return { kind: "error", message: null };
    }
    return { kind: "ready", metrics };
  } catch (error) {
    logger.error("Failed to load the health & safety dashboard", error);
    return { kind: "error", message: null };
  }
}

export function HealthSafetyDashboard({
  organizationId,
  period = "30d"
}: HealthSafetyDashboardProps) {
  const { toast } = useToast();
  const requestKey = `${organizationId}|${period}`;
  // The answer belongs to the organization and period it was read for: another one's is never shown while this one loads.
  const [loaded, setLoaded] = React.useState<{ key: string; outcome: Outcome } | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const latestRequest = React.useRef(0);

  const load = React.useCallback(async (): Promise<boolean> => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    const outcome = await readMetrics(organizationId, period);
    if (request !== latestRequest.current) return false;
    setLoaded({ key: requestKey, outcome });
    return outcome.kind === "ready";
  }, [organizationId, period, requestKey]);

  React.useEffect(() => {
    void load();
    return () => {
      latestRequest.current += 1;
    };
  }, [load]);

  async function refreshDashboard() {
    setIsRefreshing(true);
    const refreshed = await load();
    setIsRefreshing(false);
    if (refreshed) {
      toast({
        title: "Dashboard Refreshed",
        description: "Health & safety data has been updated"
      });
    }
  }

  function retry() {
    setLoaded(null);
    void load();
  }

  const outcome = loaded?.key === requestKey ? loaded.outcome : null;

  if (outcome === null) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading health & safety dashboard...</p>
        </div>
      </div>
    );
  }

  if (outcome.kind === "error") {
    return (
      <div role="alert" className="flex h-96 flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">The health &amp; safety dashboard could not be loaded.</p>
        {outcome.message ? <p className="text-sm text-muted-foreground">{outcome.message}</p> : null}
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  const { metrics } = outcome;
  const periodLabel = PERIOD_LABELS[period];
  const complianceRate = metrics.inspectionComplianceRate;
  const trainingRate = metrics.trainingCompliance;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshDashboard}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Critical Alerts */}
      {metrics.criticalAlerts > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400">
              You have {metrics.criticalAlerts} critical safety alert{metrics.criticalAlerts !== 1 ? 's' : ''} requiring immediate attention.
            </p>
            <Button variant="destructive" size="sm" className="mt-3" asChild>
              <Link href="/dashboard/health-safety/incidents">View incidents</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SafetyMetricsCard
          title="Total Incidents"
          value={metrics.totalIncidents}
          trend={metrics.incidentTrend}
          trendValue={metrics.incidentChange}
          icon={FileWarning}
          description={periodLabel}
          variant={metrics.totalIncidents === 0 || metrics.incidentTrend === "down" ? "success" : "warning"}
        />
        <SafetyMetricsCard
          title="Open Hazards"
          value={metrics.openHazards}
          icon={AlertTriangle}
          description="Requires action"
          variant={metrics.openHazards === 0 ? "success" : "warning"}
        />
        <SafetyMetricsCard
          title="Inspection Compliance"
          value={complianceRate === null ? "—" : `${complianceRate}%`}
          subtitle={metrics.inspectionsDue > 0 ? `${metrics.inspectionsCompleted} of ${metrics.inspectionsDue}` : undefined}
          icon={ClipboardCheck}
          description={complianceRate === null ? "No inspections scheduled in this period" : "Scheduled inspections completed"}
          variant={complianceRate === null ? "default" : complianceRate >= 90 ? "success" : "warning"}
        />
        <SafetyMetricsCard
          title="Days Without Incident"
          value={metrics.daysWithoutIncident ?? '—'}
          icon={CheckCircle2}
          description={metrics.daysWithoutIncident === null ? "No incident on record" : "Since the latest incident"}
        />
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="hazards">Hazards</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Incident Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Trends</CardTitle>
              <CardDescription>
                Incident frequency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentTrendChart 
                organizationId={organizationId} 
                period={period}
              />
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Training Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trainingRate === null ? 'Not measured' : `${trainingRate}%`}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {trainingRate === null ? "Safety training completion is not recorded" : "Members up-to-date with safety training"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Inspections Scheduled</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.inspectionsDue}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.inspectionsCompleted} completed · {periodLabel.toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">PPE Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", metrics.ppeInventoryLow > 0 && "text-orange-600")}>
                  {metrics.ppeInventoryLow}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Items below reorder level
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="incidents">
          <IncidentListTable organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="inspections">
          <InspectionScheduleCalendar organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="hazards">
          <HazardsList organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="compliance">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
                <CardDescription>
                  Safety compliance metrics and requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">OH&S Training Compliance</span>
                      <Badge variant={trainingRate !== null && trainingRate >= 90 ? "default" : "secondary"}>
                        {trainingRate === null ? 'Not measured' : `${trainingRate}%`}
                      </Badge>
                    </div>
                    {trainingRate !== null && <Progress value={trainingRate} className="h-2" />}
                    <p className="text-xs text-muted-foreground">Members with up-to-date safety training</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Inspection Compliance</span>
                      <Badge variant={complianceRate !== null && complianceRate >= 90 ? "default" : "secondary"}>
                        {complianceRate === null ? 'Not measured' : `${complianceRate}%`}
                      </Badge>
                    </div>
                    {complianceRate !== null && <Progress value={complianceRate} className="h-2" />}
                    <p className="text-xs text-muted-foreground">
                      {metrics.inspectionsDue === 0
                        ? "No inspections were scheduled in this period"
                        : `${metrics.inspectionsCompleted} of ${metrics.inspectionsDue} scheduled inspections completed`}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">PPE Inventory Status</span>
                      <Badge variant={metrics.ppeInventoryLow === 0 ? "default" : "secondary"}>
                        {metrics.ppeInventoryLow === 0 ? "None low" : `${metrics.ppeInventoryLow} low`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.ppeInventoryLow > 0
                        ? `${metrics.ppeInventoryLow} PPE item(s) below reorder level`
                        : "No PPE item is below its reorder level"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Days Without Incident</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", metrics.daysWithoutIncident !== null && "text-green-600")}>
                    {metrics.daysWithoutIncident ?? '—'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.daysWithoutIncident === null ? "No incident on record" : "Since the latest incident"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", metrics.criticalAlerts > 0 ? "text-red-600" : "text-green-600")}>
                    {metrics.criticalAlerts}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Open critical safety issues</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Open Hazards</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", metrics.openHazards > 0 ? "text-orange-600" : "text-green-600")}>
                    {metrics.openHazards}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Unresolved workplace hazards</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/dashboard/health-safety/incidents/new">
                <Plus className="h-4 w-4 mr-2" />
                Report Incident
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/health-safety/hazards?report=1">
                <Plus className="h-4 w-4 mr-2" />
                Report Hazard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
