'use client';

/**
 * Analytics Dashboard
 * Q1 2025 - Advanced Analytics
 * 
 * Main analytics dashboard with customizable KPI widgets
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { MetricCard } from './metric-card';
import { TrendChart } from './trend-chart';
import { InsightsPanel } from './insights-panel';
import { KPIGrid } from './kpi-grid';
import { KPIBuilderDialog } from './kpi-builder-dialog';
import { ComparativeAnalysis } from './comparative-analysis';
import { useToast } from '@/components/ui/use-toast';

interface AnalyticsDashboardProps {
  organizationId: string;
}

export function AnalyticsDashboard({ organizationId }: AnalyticsDashboardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metrics, setMetrics] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kpis, setKPIs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [insights, setInsights] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trends, setTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      // Load metrics
      const metricsRes = await fetch('/api/analytics/metrics?limit=10');
      const metricsData = await metricsRes.json();
      if (metricsData.success) {
        setMetrics(metricsData.metrics);
      }

      // Load KPIs
      const kpisRes = await fetch('/api/analytics/kpis?isActive=true');
      const kpisData = await kpisRes.json();
      if (kpisData.success) {
        setKPIs(kpisData.kpis);
      }

      // Load insights
      const insightsRes = await fetch('/api/analytics/insights?status=new&limit=5');
      const insightsData = await insightsRes.json();
      if (insightsData.success) {
        setInsights(insightsData.insights);
      }

      // Load trends
      const trendsRes = await fetch('/api/analytics/trends?limit=5');
      const trendsData = await trendsRes.json();
      if (trendsData.success) {
        setTrends(trendsData.trends);
      }
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
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
      title: 'Dashboard Refreshed',
      description: 'All analytics data has been updated'
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor key metrics and insights for your organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDashboard}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <KPIBuilderDialog />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Claims This Month"
          value={metrics.find(m => m.metricType === 'claims_volume')?.metricValue || '0'}
          trend={metrics.find(m => m.metricType === 'claims_volume')?.trend}
          icon={TrendingUp}
          description="vs. last month"
        />
        <MetricCard
          title="Avg Resolution Time"
          value={`${metrics.find(m => m.metricType === 'resolution_time')?.metricValue || '0'} days`}
          trend={metrics.find(m => m.metricType === 'resolution_time')?.trend}
          icon={TrendingDown}
          description="vs. last month"
        />
        <MetricCard
          title="New Members"
          value={metrics.find(m => m.metricType === 'member_growth')?.metricValue || '0'}
          trend={metrics.find(m => m.metricType === 'member_growth')?.trend}
          icon={TrendingUp}
          description="vs. last month"
        />
        <MetricCard
          title="Active Insights"
          value={insights.length.toString()}
          trend="stable"
          icon={AlertCircle}
          description="requiring attention"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="kpis">Custom KPIs</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Claims Trend Chart */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Claims Volume Trend</CardTitle>
                <CardDescription>
                  Daily claims volume over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={metrics
                    .filter(m => m.metricType === 'claims_volume')
                    .map(m => ({
                      date: m.periodStart,
                      value: Number(m.metricValue)
                    }))}
                  type="line"
                />
              </CardContent>
            </Card>

            {/* Recent Insights */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Insights</CardTitle>
                <CardDescription>
                  AI-powered recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InsightsPanel insights={insights.slice(0, 3)} compact />
              </CardContent>
            </Card>
          </div>

          {/* Resolution Time Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Resolution Time Trend</CardTitle>
              <CardDescription>
                Average days to resolve claims
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={metrics
                  .filter(m => m.metricType === 'resolution_time')
                  .map(m => ({
                    date: m.periodStart,
                    value: Number(m.metricValue)
                  }))}
                type="area"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
              <CardDescription>
                Detected trends and patterns in your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trends.map((trend) => (
                  <div
                    key={trend.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">
                          {trend.detectedTrend}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({(Number(trend.trendStrength) * 100).toFixed(1)}% confidence)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trend.insights}
                      </p>
                      {trend.anomalyCount > 0 && (
                        <p className="text-sm text-orange-600">
                          {trend.anomalyCount} anomalies detected
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <InsightsPanel insights={insights} />
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <KPIGrid kpis={kpis} />
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <ComparativeAnalysis organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

