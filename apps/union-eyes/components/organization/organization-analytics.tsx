/**
 * Organization Analytics Dashboard Component
 * Shows member distribution, claims metrics, and financial data across hierarchy
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, AlertCircle, Loader2, Building2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrganizationAnalytics {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  
  // Member metrics
  totalMembers: number;
  activeMembers: number;
  newMembersThisMonth: number;
  memberGrowthRate: number;
  
  // Claims metrics
  totalClaims: number;
  activeClaims: number;
  resolvedClaims: number;
  claimsThisMonth: number;
  avgResolutionDays: number;
  
  // Financial metrics (if available)
  totalRevenue?: number;
  monthlyRevenue?: number;
  outstandingDues?: number;
  
  // Hierarchy metrics
  childOrganizations: number;
  descendantMembers?: number;
  
  // Status distribution
  membersByStatus?: Record<string, number>;
  claimsByStatus?: Record<string, number>;
}

interface OrganizationAnalyticsProps {
  organizationId: string;
  includeDescendants?: boolean;
  className?: string;
}

export function OrganizationAnalytics({ 
  organizationId, 
  includeDescendants = false,
  className 
}: OrganizationAnalyticsProps) {
  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (includeDescendants) params.append('include_descendants', 'true');
      
      const response = await fetch(`/api/organizations/${organizationId}/analytics?${params}`);
      if (!response.ok) throw new Error("Failed to load analytics");
      
      const data = await response.json();
      setAnalytics(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [organizationId, includeDescendants]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-sm text-destructive">{error || "No data available"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return "N/A";
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return "N/A";
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
  };

  const formatPercentage = (rate: number | undefined) => {
    if (rate === undefined) return "N/A";
    const sign = rate > 0 ? "+" : "";
    return `${sign}${rate.toFixed(1)}%`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{analytics.organizationName}</h2>
        <p className="text-muted-foreground">
          {analytics.organizationType.charAt(0).toUpperCase() + analytics.organizationType.slice(1)} Analytics
          {includeDescendants && " (including all child organizations)"}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Members"
          value={formatNumber(analytics.totalMembers)}
          change={formatPercentage(analytics.memberGrowthRate)}
          changeType={analytics.memberGrowthRate >= 0 ? "positive" : "negative"}
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
          value={`${analytics.avgResolutionDays} days`}
          icon={<Activity className="w-4 h-4" />}
          description="Average resolution time"
        />
        
        <MetricCard
          title="Child Organizations"
          value={formatNumber(analytics.childOrganizations)}
          icon={<Building2 className="w-4 h-4" />}
          description={includeDescendants && analytics.descendantMembers 
            ? `${formatNumber(analytics.descendantMembers)} total members`
            : "Direct children only"
          }
        />
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          {analytics.totalRevenue !== undefined && (
            <TabsTrigger value="financial">Financial</TabsTrigger>
          )}
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
                    <Badge variant={analytics.memberGrowthRate >= 0 ? "default" : "destructive"}>
                      {formatPercentage(analytics.memberGrowthRate)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Activity Rate</span>
                    <Badge variant="outline">
                      {((analytics.activeMembers / analytics.totalMembers) * 100).toFixed(1)}%
                    </Badge>
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
                    <Badge variant="outline">{analytics.avgResolutionDays} days</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Resolution Rate</span>
                    <Badge variant="outline">
                      {((analytics.resolvedClaims / analytics.totalClaims) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {analytics.totalRevenue !== undefined && (
          <TabsContent value="financial" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>Financial overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Revenue</span>
                      <Badge variant="default">{formatCurrency(analytics.totalRevenue)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">This Month</span>
                      <Badge variant="secondary">{formatCurrency(analytics.monthlyRevenue)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Outstanding</CardTitle>
                  <CardDescription>Dues and arrears</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Outstanding Dues</span>
                      <Badge variant="outline">{formatCurrency(analytics.outstandingDues)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
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
            changeType === "positive" ? "text-green-600" : "text-red-600"
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

