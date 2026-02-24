/**
 * Federation Dashboard Component
 * 
 * Main provincial/territorial federation overview with:
 * - Federation-level KPIs and metrics
 * - Affiliate union status overview
 * - Remittance compliance tracking
 * - Regional activity summary
 * - Campaign and meeting tracking
 * - Quick actions
 * 
 * @module components/federation/FederationDashboard
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Download,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { FederationMetricsCard } from "./FederationMetricsCard";
import { FederationSelector } from "./FederationSelector";
import { cn } from "@/lib/utils";

export interface FederationMetrics {
  totalAffiliates: number;
  affiliateTrend: "up" | "down" | "stable";
  affiliateChange: number;
  totalMembers: number;
  memberTrend: "up" | "down" | "stable";
  memberChange: number;
  remittanceCompliance: number;
  remittanceComplianceTrend: "up" | "down" | "stable";
  overdueRemittances: number;
  upcomingMeetings: number;
  activeCampaigns: number;
  pendingOnboarding: number;
  monthlyRemittanceReceived: number;
  monthlyRemittanceExpected: number;
  averageResponseTime: number;
  resourcesShared: number;
}

export interface FederationDashboardProps {
  federationId?: string;
  period?: "7d" | "30d" | "90d" | "12m";
  userRole?: string;
}

export function FederationDashboard({
  federationId: initialFederationId,
  period = "30d",
  userRole
}: FederationDashboardProps) {
  const { toast } = useToast();
  const [federationId, setFederationId] = React.useState(initialFederationId);
  const [metrics, setMetrics] = React.useState<FederationMetrics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedPeriod, setSelectedPeriod] = React.useState(period);

  React.useEffect(() => {
    if (federationId) {
      loadDashboardData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId, selectedPeriod]);

  async function loadDashboardData() {
    if (!federationId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/federation/dashboard?federationId=${federationId}&period=${selectedPeriod}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      } else {
        throw new Error(data.error || "Failed to load metrics");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load federation dashboard",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDashboard() {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
    toast({
      title: "Dashboard Refreshed",
      description: "Federation data has been updated"
    });
  }

  async function exportReport() {
    try {
      const response = await fetch(
        `/api/federation/reports/export?federationId=${federationId}&period=${selectedPeriod}`,
        { method: 'POST' }
      );
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `federation-report-${selectedPeriod}.pdf`;
      a.click();
      
      toast({
        title: "Report Exported",
        description: "Your federation report has been downloaded"
      });
    } catch (_error) {
      toast({
        title: "Export Failed",
        description: "Unable to export report",
        variant: "destructive"
      });
    }
  }

  if (!federationId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Select a Federation</h3>
          <p className="text-sm text-muted-foreground">
            Choose a federation to view its dashboard
          </p>
        </div>
        <FederationSelector
          value={federationId}
          onChange={setFederationId}
          userRole={userRole}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading federation dashboard...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">No Data Available</h3>
          <p className="text-sm text-muted-foreground">
            Unable to load federation metrics
          </p>
          <Button onClick={loadDashboardData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const complianceRate = Math.round((metrics.remittanceCompliance / 100) * 100);
  const remittancePercentage = metrics.monthlyRemittanceExpected > 0
    ? Math.round((metrics.monthlyRemittanceReceived / metrics.monthlyRemittanceExpected) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Federation Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Provincial/territorial federation overview
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <FederationSelector
            value={federationId}
            onChange={setFederationId}
            userRole={userRole}
          />
          <Button
            onClick={refreshDashboard}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Period:</span>
        <div className="flex gap-1">
          {[
            { value: "7d", label: "7 Days" },
            { value: "30d", label: "30 Days" },
            { value: "90d", label: "90 Days" },
            { value: "12m", label: "12 Months" }
          ].map(({ value, label }) => (
            <Button
              key={value}
              onClick={() => setSelectedPeriod(value as typeof period)}
              variant={selectedPeriod === value ? "default" : "outline"}
              size="sm"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FederationMetricsCard
          title="Affiliate Unions"
          value={metrics.totalAffiliates}
          subtitle="unions"
          trend={metrics.affiliateTrend}
          trendValue={metrics.affiliateChange}
          icon={Building2}
          description={`${metrics.pendingOnboarding} pending onboarding`}
          variant={metrics.pendingOnboarding > 0 ? "warning" : "default"}
        />
        <FederationMetricsCard
          title="Total Members"
          value={metrics.totalMembers.toLocaleString()}
          trend={metrics.memberTrend}
          trendValue={metrics.memberChange}
          icon={Users}
          description="Across all affiliates"
          variant="default"
        />
        <FederationMetricsCard
          title="Remittance Compliance"
          value={`${complianceRate}%`}
          trend={metrics.remittanceComplianceTrend}
          trendValue={Math.abs(complianceRate - 100)}
          icon={DollarSign}
          description={`${metrics.overdueRemittances} overdue`}
          variant={complianceRate >= 90 ? "success" : complianceRate >= 70 ? "warning" : "danger"}
        />
        <FederationMetricsCard
          title="Active Campaigns"
          value={metrics.activeCampaigns}
          subtitle="campaigns"
          icon={FileText}
          description={`${metrics.upcomingMeetings} meetings scheduled`}
          variant="default"
        />
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Remittance Summary
          </CardTitle>
          <CardDescription>
            Period: {selectedPeriod}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Received</span>
              <span className="text-2xl font-bold">
                ${metrics.monthlyRemittanceReceived.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm">Expected</span>
              <span className="text-lg">
                ${metrics.monthlyRemittanceExpected.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  remittancePercentage >= 90 ? "bg-green-600" :
                  remittancePercentage >= 70 ? "bg-orange-600" : "bg-red-600"
                )}
                style={{ width: `${Math.min(remittancePercentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Collection Rate</span>
              <span className="font-medium">{remittancePercentage}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
          <TabsTrigger value="remittance">Remittance</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Resources Shared</span>
                  <Badge variant="secondary">{metrics.resourcesShared}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Response Time</span>
                  <Badge variant="secondary">{metrics.averageResponseTime}h</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Upcoming Meetings</span>
                  <Badge variant="secondary">{metrics.upcomingMeetings}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.overdueRemittances > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-md">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">
                      {metrics.overdueRemittances} overdue remittances
                    </span>
                  </div>
                )}
                {metrics.pendingOnboarding > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded-md">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-600">
                      {metrics.pendingOnboarding} affiliates pending onboarding
                    </span>
                  </div>
                )}
                {metrics.overdueRemittances === 0 && metrics.pendingOnboarding === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">
                      All systems operational
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Unions</CardTitle>
              <CardDescription>
                View and manage member unions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Use the Affiliate Management section for detailed views
                </p>
                <Button variant="outline" asChild>
                  <a href={`/federation/${federationId}/affiliates`}>
                    View All Affiliates
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remittance">
          <Card>
            <CardHeader>
              <CardTitle>Remittance Tracking</CardTitle>
              <CardDescription>
                Monitor provincial remittance payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Access detailed remittance dashboard
                </p>
                <Button variant="outline" asChild>
                  <a href={`/federation/${federationId}/remittance`}>
                    View Remittance Dashboard
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>Federation Activities</CardTitle>
              <CardDescription>
                Campaigns, meetings, and regional initiatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Upcoming Meetings</p>
                      <p className="text-sm text-muted-foreground">
                        {metrics.upcomingMeetings} scheduled
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/federation/${federationId}/meetings`}>View</a>
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Active Campaigns</p>
                      <p className="text-sm text-muted-foreground">
                        {metrics.activeCampaigns} in progress
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`/federation/${federationId}/campaigns`}>View</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/federation/${federationId}/affiliates/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Affiliate
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/federation/${federationId}/meetings/new`}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/federation/${federationId}/resources`}>
                <FileText className="h-4 w-4 mr-2" />
                Share Resources
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/federation/${federationId}/reports`}>
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
