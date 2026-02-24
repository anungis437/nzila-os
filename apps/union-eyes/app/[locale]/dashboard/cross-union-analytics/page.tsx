"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  FileText, 
  Scale, 
  Users, 
  Eye, 
  Download,
  GitCompare,
  Building2,
  BarChart3,
  Calendar
} from "lucide-react";
import { StatCard } from "@/components/analytics/StatCard";
import { TopItemsList } from "@/components/analytics/TopItemsList";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { DistributionChart } from "@/components/analytics/DistributionChart";
import { TrendChart } from "@/components/analytics/TrendChart";

export default function CrossUnionAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "clauses" | "precedents" | "organizations">("overview");
  
  // Filters
  const [dateRange, setDateRange] = useState("30");
  const [sector, setSector] = useState<string>("all");
  const [organizationLevel, setOrganizationLevel] = useState<string>("all");
  
  // Data states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clauseStats, setClauseStats] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [precedentStats, setPrecedentStats] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orgActivity, setOrgActivity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const fromDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString();
        const toDate = new Date().toISOString();

        const params = new URLSearchParams({
          fromDate,
          toDate,
          ...(sector !== "all" && { sector }),
        });

        const [clauseRes, precedentRes, orgRes] = await Promise.all([
          fetch(`/api/analytics/clause-stats?${params}`),
          fetch(`/api/analytics/precedent-stats?${params}`),
          fetch(`/api/analytics/org-activity?${params}${organizationLevel !== "all" ? `&organizationLevel=${organizationLevel}` : ""}`),
        ]);

        const [clauseData, precedentData, orgData] = await Promise.all([
          clauseRes.json(),
          precedentRes.json(),
          orgRes.json(),
        ]);

        setClauseStats(clauseData);
        setPrecedentStats(precedentData);
        setOrgActivity(orgData);
      } catch (_error) {
} finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [mounted, dateRange, sector, organizationLevel]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Cross-Union Analytics</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Insights across shared clauses, precedents, and organization activity
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date Range:</span>
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-4">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sector:</span>
            </div>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                <SelectItem value="public">Public Sector</SelectItem>
                <SelectItem value="private">Private Sector</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="hospitality">Hospitality</SelectItem>
                <SelectItem value="construction">Construction</SelectItem>
                <SelectItem value="telecommunications">Telecommunications</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Org Level:</span>
            </div>
            <Select value={organizationLevel} onValueChange={setOrganizationLevel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="congress">Congress</SelectItem>
                <SelectItem value="federation">Federation</SelectItem>
                <SelectItem value="union">Union</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clauses">Clause Library</TabsTrigger>
          <TabsTrigger value="precedents">Precedents</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Clauses"
              value={clauseStats?.statistics?.totalClauses || 0}
              icon={FileText}
              description={`${clauseStats?.statistics?.uniqueOrgs || 0} organizations`}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Precedents"
              value={precedentStats?.statistics?.totalPrecedents || 0}
              icon={Scale}
              description={`${precedentStats?.statistics?.uniqueArbitrators || 0} arbitrators`}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Views"
              value={
                (clauseStats?.statistics?.totalViews || 0) +
                (precedentStats?.statistics?.totalViews || 0)
              }
              icon={Eye}
              description="Across all resources"
              iconColor="text-green-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Cross-Org Activity"
              value={orgActivity?.statistics?.totalCrossOrgAccesses || 0}
              icon={Users}
              description={`${orgActivity?.statistics?.uniqueAccessorOrgs || 0} organizations`}
              iconColor="text-orange-600"
              isLoading={isLoading}
            />
          </div>

          {/* Activity Trend */}
          <TrendChart
            title="Daily Activity Trend"
            data={orgActivity?.dailyActivity || []}
            series={[
              { dataKey: "totalAccesses", name: "Total Accesses", color: "#3b82f6" },
              { dataKey: "clauseAccesses", name: "Clause Accesses", color: "#10b981" },
              { dataKey: "precedentAccesses", name: "Precedent Accesses", color: "#8b5cf6" },
            ]}
            type="area"
            isLoading={isLoading}
            height={300}
          />

          {/* Distribution Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <DistributionChart
              title="Clause Types Distribution"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clauseStats?.clauseTypeDistribution?.map((item: any) => ({
                  name: item.clauseType,
                  value: item.count,
                })) || []
              }
              type="bar"
              isLoading={isLoading}
              height={300}
            />
            <DistributionChart
              title="Precedent Outcomes"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                precedentStats?.outcomeDistribution?.map((item: any) => ({
                  name: item.outcome,
                  value: item.count,
                })) || []
              }
              type="pie"
              isLoading={isLoading}
              height={300}
            />
          </div>

          {/* Recent Activity */}
          <ActivityFeed
            title="Recent Cross-Organization Activity"
            activities={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              clauseStats?.recentActivity?.map((activity: any) => ({
                id: activity.id,
                accessType: activity.accessType,
                resourceTitle: activity.clauseTitle || "Unknown",
                resourceType: "clause",
                userOrganization: activity.userOrganization?.name || "Unknown",
                resourceOwnerOrganization: activity.resourceOwnerOrganization?.name || "Unknown",
                timestamp: activity.accessedAt,
              })) || []
            }
            isLoading={isLoading}
            maxHeight={400}
          />
        </TabsContent>

        {/* Clause Library Tab */}
        <TabsContent value="clauses" className="space-y-6">
          {/* Clause Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Clauses"
              value={clauseStats?.statistics?.totalClauses || 0}
              icon={FileText}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Views"
              value={clauseStats?.statistics?.totalViews || 0}
              icon={Eye}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Citations"
              value={clauseStats?.statistics?.totalCitations || 0}
              icon={TrendingUp}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Comparisons"
              value={clauseStats?.statistics?.totalComparisons || 0}
              icon={GitCompare}
              iconColor="text-orange-600"
              isLoading={isLoading}
            />
          </div>

          {/* Most Cited and Viewed */}
          <div className="grid gap-4 md:grid-cols-2">
            <TopItemsList
              title="Most Cited Clauses"
              items={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clauseStats?.mostCited?.map((clause: any) => ({
                  id: clause.id,
                  title: clause.clauseTitle,
                  subtitle: clause.sourceOrganization?.name,
                  metric: clause.citationCount,
                  metricLabel: "citations",
                  secondaryMetric: clause.viewCount,
                  secondaryMetricLabel: "views",
                  badge: clause.clauseType,
                  badgeVariant: "secondary" as const,
                })) || []
              }
              isLoading={isLoading}
              maxItems={10}
            />
            <TopItemsList
              title="Most Viewed Clauses"
              items={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clauseStats?.mostViewed?.map((clause: any) => ({
                  id: clause.id,
                  title: clause.clauseTitle,
                  subtitle: clause.sourceOrganization?.name,
                  metric: clause.viewCount,
                  metricLabel: "views",
                  secondaryMetric: clause.citationCount,
                  secondaryMetricLabel: "citations",
                  badge: clause.sector,
                  badgeVariant: "outline" as const,
                })) || []
              }
              isLoading={isLoading}
              maxItems={10}
            />
          </div>

          {/* Clause Type and Sector Distribution */}
          <div className="grid gap-4 md:grid-cols-2">
            <DistributionChart
              title="Clause Types"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clauseStats?.clauseTypeDistribution?.map((item: any) => ({
                  name: item.clauseType,
                  value: item.count,
                })) || []
              }
              type="bar"
              isLoading={isLoading}
            />
            <DistributionChart
              title="Sector Distribution"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clauseStats?.sectorDistribution?.map((item: any) => ({
                  name: item.sector || "Unknown",
                  value: item.count,
                })) || []
              }
              type="pie"
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        {/* Precedents Tab */}
        <TabsContent value="precedents" className="space-y-6">
          {/* Precedent Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Precedents"
              value={precedentStats?.statistics?.totalPrecedents || 0}
              icon={Scale}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Views"
              value={precedentStats?.statistics?.totalViews || 0}
              icon={Eye}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Citations"
              value={precedentStats?.statistics?.totalCitations || 0}
              icon={TrendingUp}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Downloads"
              value={precedentStats?.statistics?.totalDownloads || 0}
              icon={Download}
              iconColor="text-orange-600"
              isLoading={isLoading}
            />
          </div>

          {/* Most Cited and Viewed */}
          <div className="grid gap-4 md:grid-cols-2">
            <TopItemsList
              title="Most Cited Precedents"
              items={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                precedentStats?.mostCited?.map((precedent: any) => ({
                  id: precedent.id,
                  title: `${precedent.caseNumber}: ${precedent.caseTitle}`,
                  subtitle: `${precedent.arbitratorName} - ${precedent.jurisdiction}`,
                  metric: precedent.citationCount,
                  metricLabel: "citations",
                  secondaryMetric: precedent.viewCount,
                  secondaryMetricLabel: "views",
                  badge: precedent.outcome,
                  badgeVariant: "secondary" as const,
                })) || []
              }
              isLoading={isLoading}
              maxItems={10}
            />
            <TopItemsList
              title="Most Viewed Precedents"
              items={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                precedentStats?.mostViewed?.map((precedent: any) => ({
                  id: precedent.id,
                  title: `${precedent.caseNumber}: ${precedent.caseTitle}`,
                  subtitle: `${precedent.arbitratorName} - ${precedent.jurisdiction}`,
                  metric: precedent.viewCount,
                  metricLabel: "views",
                  secondaryMetric: precedent.citationCount,
                  secondaryMetricLabel: "citations",
                  badge: precedent.precedentLevel,
                  badgeVariant: "outline" as const,
                })) || []
              }
              isLoading={isLoading}
              maxItems={10}
            />
          </div>

          {/* Distribution Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <DistributionChart
              title="Outcome Distribution"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                precedentStats?.outcomeDistribution?.map((item: any) => ({
                  name: item.outcome,
                  value: item.count,
                })) || []
              }
              type="pie"
              isLoading={isLoading}
            />
            <DistributionChart
              title="Grievance Types"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                precedentStats?.grievanceTypeDistribution?.map((item: any) => ({
                  name: item.grievanceType,
                  value: item.count,
                })) || []
              }
              type="bar"
              isLoading={isLoading}
            />
          </div>

          {/* Top Arbitrators */}
          <Card>
            <CardHeader>
              <CardTitle>Top Arbitrators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {precedentStats?.topArbitrators?.slice(0, 10).map((arb: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{arb.arbitratorName}</p>
                      <p className="text-sm text-muted-foreground">
                        {arb.count} cases â€¢ {arb.totalCitations} citations
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-green-600">
                        {arb.uphelds} upheld
                      </div>
                      <div className="text-muted-foreground">
                        {arb.dismissed} dismissed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-6">
          {/* Org Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Accesses"
              value={orgActivity?.statistics?.totalAccesses || 0}
              icon={Eye}
              iconColor="text-blue-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Active Organizations"
              value={orgActivity?.statistics?.uniqueAccessorOrgs || 0}
              icon={Building2}
              iconColor="text-green-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Cross-Org Accesses"
              value={orgActivity?.statistics?.totalCrossOrgAccesses || 0}
              icon={Users}
              iconColor="text-purple-600"
              isLoading={isLoading}
            />
            <StatCard
              title="Unique Users"
              value={orgActivity?.statistics?.uniqueUsers || 0}
              icon={Users}
              iconColor="text-orange-600"
              isLoading={isLoading}
            />
          </div>

          {/* Most Active and Top Contributors */}
          <div className="grid gap-4 md:grid-cols-2">
            <TopItemsList
              title="Most Active Organizations"
              items={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                orgActivity?.mostActiveOrgs?.map((org: any) => ({
                  id: org.organizationId,
                  title: org.organizationName,
                  subtitle: org.organizationLevel,
                  metric: org.totalAccesses,
                  metricLabel: "accesses",
                  secondaryMetric: org.views,
                  secondaryMetricLabel: "views",
                  badge: `${org.clauseAccesses} clauses â€¢ ${org.precedentAccesses} precedents`,
                  badgeVariant: "secondary" as const,
                })) || []
              }
              isLoading={isLoading}
              maxItems={10}
            />
            <TopItemsList
              title="Top Resource Contributors"
              items={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                orgActivity?.topContributors?.map((org: any) => ({
                  id: org.organizationId,
                  title: org.organizationName,
                  subtitle: org.organizationLevel,
                  metric: org.totalResources,
                  metricLabel: "resources",
                  secondaryMetric: org.clauseViews + org.precedentViews,
                  secondaryMetricLabel: "views",
                  badge: `${org.totalClauses} clauses â€¢ ${org.totalPrecedents} precedents`,
                  badgeVariant: "outline" as const,
                })) || []
              }
              isLoading={isLoading}
              maxItems={10}
            />
          </div>

          {/* Access Type Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <DistributionChart
              title="Access Type Breakdown"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                orgActivity?.accessTypeBreakdown?.map((item: any) => ({
                  name: item.accessType,
                  value: item.count,
                })) || []
              }
              type="pie"
              isLoading={isLoading}
            />
            <DistributionChart
              title="Organization Level Activity"
              data={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                orgActivity?.orgLevelBreakdown?.map((item: any) => ({
                  name: item.organizationLevel,
                  value: item.totalAccesses,
                })) || []
              }
              type="bar"
              isLoading={isLoading}
            />
          </div>

          {/* Sharing Adoption */}
          <Card>
            <CardHeader>
              <CardTitle>Sharing Settings Adoption</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground">Clause Sharing Enabled</p>
                  <p className="text-2xl font-bold mt-1">
                    {orgActivity?.sharingAdoption?.clauseSharingEnabled || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {orgActivity?.sharingAdoption?.totalOrgs || 0} orgs
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground">Precedent Sharing Enabled</p>
                  <p className="text-2xl font-bold mt-1">
                    {orgActivity?.sharingAdoption?.precedentSharingEnabled || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {orgActivity?.sharingAdoption?.totalOrgs || 0} orgs
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground">Analytics Sharing Enabled</p>
                  <p className="text-2xl font-bold mt-1">
                    {orgActivity?.sharingAdoption?.analyticsSharingEnabled || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {orgActivity?.sharingAdoption?.totalOrgs || 0} orgs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
