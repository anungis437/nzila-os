/**
 * Organization Analytics Dashboard Component
 * Shows an organization's member and claims figures
 *
 * Reads GET /api/organizations/{id}/analytics, which answers plain JSON { data: analytics }. Every member and claims figure can be null: the route
 * withholds a family of figures for a group smaller than its minimum, so that no individual can be identified, and some figures are undefined (the
 * growth of an organization with no members last month, the resolution time when no claim has been resolved). A null is shown as a dash, with the reason
 * the route gave, never as 0, "0%", "null days" or "N/A". A call that failed is an error with a retry.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, TrendingUp, AlertCircle, Loader2, Building2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { isRecord, readApiError } from "@/lib/client/api-envelope";
import { ApiShapeError, asRecord, countOrNull, optionalString, requiredCount, requiredString } from "@/lib/client/row-fields";

interface OrganizationAnalytics {
  organizationName: string;
  organizationType: string | null;
  suppression: { minimumGroupSize: number; members: boolean; claims: boolean };

  // Member metrics
  totalMembers: number | null;
  activeMembers: number | null;
  newMembersThisMonth: number | null;
  memberGrowthRate: number | null;

  // Claims metrics
  totalClaims: number | null;
  activeClaims: number | null;
  resolvedClaims: number | null;
  claimsThisMonth: number | null;
  avgResolutionDays: number | null;

  // Hierarchy metrics
  childOrganizations: number;
}

interface OrganizationAnalyticsProps {
  organizationId: string;
  className?: string;
}

function flag(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new ApiShapeError(`${key} is not a boolean`);
  return value;
}

function toAnalytics(body: unknown): OrganizationAnalytics {
  if (!isRecord(body)) throw new ApiShapeError("no analytics");
  const row = asRecord(body.data, "analytics");
  const suppression = asRecord(row.suppression, "suppression");
  return {
    organizationName: requiredString(row, "organizationName"),
    organizationType: optionalString(row, "organizationType"),
    suppression: {
      minimumGroupSize: requiredCount(suppression, "minimumGroupSize"),
      members: flag(suppression, "members"),
      claims: flag(suppression, "claims"),
    },
    totalMembers: countOrNull(row, "totalMembers"),
    activeMembers: countOrNull(row, "activeMembers"),
    newMembersThisMonth: countOrNull(row, "newMembersThisMonth"),
    memberGrowthRate: countOrNull(row, "memberGrowthRate"),
    totalClaims: countOrNull(row, "totalClaims"),
    activeClaims: countOrNull(row, "activeClaims"),
    resolvedClaims: countOrNull(row, "resolvedClaims"),
    claimsThisMonth: countOrNull(row, "claimsThisMonth"),
    avgResolutionDays: countOrNull(row, "avgResolutionDays"),
    childOrganizations: requiredCount(row, "childOrganizations"),
  };
}

async function loadAnalytics(organizationId: string): Promise<OrganizationAnalytics> {
  const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/analytics`);
  if (!response.ok) throw new Error(await readApiError(response, `The analytics could not be loaded (HTTP ${response.status}).`));
  return toAnalytics(await response.json());
}

const UNKNOWN = "—";

const formatNumber = (value: number | null) => (value === null ? UNKNOWN : value.toLocaleString());

const formatPercentage = (rate: number | null) => {
  if (rate === null) return UNKNOWN;
  return `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
};

/** A share of a whole, undefined (a dash) when either is unknown or the whole is empty. */
const formatShare = (part: number | null, whole: number | null) =>
  part === null || whole === null || whole === 0 ? UNKNOWN : `${((part / whole) * 100).toFixed(1)}%`;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; analytics: OrganizationAnalytics }
  | { status: "failed"; message: string };

export function OrganizationAnalytics({
  organizationId,
  className
}: OrganizationAnalyticsProps) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: LoadState } | null>(null);
  const key = `${organizationId}#${attempt}`;

  const load = useCallback(() => {
    let cancelled = false;
    loadAnalytics(organizationId).then(
      (analytics) => {
        if (!cancelled) setLoaded({ key, state: { status: "ready", analytics } });
      },
      (failure: unknown) => {
        logger.error("Failed to load the organization analytics", failure);
        if (!cancelled) setLoaded({ key, state: { status: "failed", message: failure instanceof Error ? failure.message : "The analytics could not be loaded." } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [organizationId, key]);

  useEffect(() => load(), [load]);

  const state: LoadState = loaded !== null && loaded.key === key ? loaded.state : { status: "loading" };

  if (state.status === "loading") {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 role="status" aria-label="Loading analytics" className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (state.status === "failed") {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div role="alert" className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { analytics } = state;
  const { suppression } = analytics;
  const withheld: string[] = [];
  if (suppression.members) withheld.push("member");
  if (suppression.claims) withheld.push("claims");

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{analytics.organizationName}</h2>
        <p className="text-muted-foreground">
          {analytics.organizationType !== null && `${analytics.organizationType.charAt(0).toUpperCase()}${analytics.organizationType.slice(1)} `}Analytics
        </p>
      </div>

      {withheld.length > 0 && (
        <p role="note" className="text-sm text-muted-foreground border rounded-md p-3">
          The {withheld.join(" and ")} figures are not shown for a group smaller than {suppression.minimumGroupSize}, so that no individual can be identified.
        </p>
      )}

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Members"
          value={formatNumber(analytics.totalMembers)}
          change={analytics.memberGrowthRate === null ? undefined : formatPercentage(analytics.memberGrowthRate)}
          changeType={analytics.memberGrowthRate !== null && analytics.memberGrowthRate < 0 ? "negative" : "positive"}
          icon={<Users className="w-4 h-4" />}
          description={`${formatNumber(analytics.newMembersThisMonth)} new this month`}
        />

        <MetricCard
          title="Active Claims"
          value={formatNumber(analytics.activeClaims)}
          icon={<FileText className="w-4 h-4" />}
          description={`${formatNumber(analytics.totalClaims)} total claims`}
        />

        <MetricCard
          title="Resolution Time"
          value={analytics.avgResolutionDays === null ? UNKNOWN : `${analytics.avgResolutionDays} days`}
          icon={<Activity className="w-4 h-4" />}
          description={analytics.avgResolutionDays === null && !suppression.claims ? "No claim has been resolved yet" : "Average resolution time"}
        />

        <MetricCard
          title="Child Organizations"
          value={formatNumber(analytics.childOrganizations)}
          icon={<Building2 className="w-4 h-4" />}
          description="Direct children only"
        />
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Member Status</CardTitle>
                <CardDescription>Distribution of member statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active</span>
                    <Badge variant="default">{formatNumber(analytics.activeMembers)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total</span>
                    <Badge variant="outline">{formatNumber(analytics.totalMembers)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">New This Month</span>
                    <Badge variant="secondary">{formatNumber(analytics.newMembersThisMonth)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth Metrics</CardTitle>
                <CardDescription>Member growth trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Growth Rate</span>
                    <Badge variant={analytics.memberGrowthRate !== null && analytics.memberGrowthRate < 0 ? "destructive" : "default"}>
                      {formatPercentage(analytics.memberGrowthRate)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Activity Rate</span>
                    <Badge variant="outline">{formatShare(analytics.activeMembers, analytics.totalMembers)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Claims Overview</CardTitle>
                <CardDescription>Current claims status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Claims</span>
                    <Badge variant="default">{formatNumber(analytics.activeClaims)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Resolved</span>
                    <Badge variant="secondary">{formatNumber(analytics.resolvedClaims)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">This Month</span>
                    <Badge variant="outline">{formatNumber(analytics.claimsThisMonth)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Claims metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Resolution</span>
                    <Badge variant="outline">{analytics.avgResolutionDays === null ? UNKNOWN : `${analytics.avgResolutionDays} days`}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Resolution Rate</span>
                    <Badge variant="outline">{formatShare(analytics.resolvedClaims, analytics.totalClaims)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative";
  icon: React.ReactNode;
  description?: string;
}

function MetricCard({ title, value, change, changeType, icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={cn(
            "text-xs flex items-center gap-1 mt-1",
            changeType === "negative" ? "text-red-600" : "text-green-600"
          )}>
            <TrendingUp className="w-3 h-3" />
            {change}
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
