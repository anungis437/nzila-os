/**
 * Advanced Analytics Dashboard
 * 
 * SPRINT 8: Advanced Features
 * 
 * Comprehensive analytics for marketing growth engine:
 * - Conversion funnel visualization
 * - Cohort analysis
 * - Trend detection
 * - Attribution tracking
 * - Real-time metrics
 */


export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  analyzePilotConversionFunnel,
  analyzePilotCohorts,
  analyzeTrends,
  analyzeAttribution,
  getRealTimeDashboard,
} from '@/lib/analytics/advanced-metrics';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Target,
  Activity,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default async function AdvancedAnalyticsPage() {
  // Fetch all analytics in parallel
  const [funnelMetrics, cohorts, trends, attribution, realTime] = await Promise.all([
    analyzePilotConversionFunnel(),
    analyzePilotCohorts(),
    analyzeTrends(30, 30), // Current 30d vs previous 30d
    analyzeAttribution(),
    getRealTimeDashboard(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="mt-2 text-gray-600">
            Deep insights into marketing performance and growth patterns
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {realTime.timestamp.toLocaleString()}
          </p>
        </div>

        {/* Real-Time Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Real-Time Status
            </CardTitle>
            <CardDescription>Live metrics from the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Pilots</p>
                <p className="text-3xl font-bold text-gray-900">{realTime.activePilots}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Applications</p>
                <p className="text-3xl font-bold text-orange-600">{realTime.pendingApplications}</p>
              </div>
              {realTime.recentActivity.map((activity) => (
                <div key={activity.type}>
                  <p className="text-sm text-gray-600 mb-1 capitalize">
                    {activity.type.replace('-', ' ')}s (24h)
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{activity.count}</p>
                  {activity.lastOccurrence && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {new Date(activity.lastOccurrence).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Health Indicators */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium text-gray-700 mb-3">Health Indicators</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {realTime.healthIndicators.map((indicator) => (
                  <div key={indicator.metric} className="flex items-center gap-3">
                    {indicator.status === 'healthy' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {indicator.status === 'warning' && <AlertCircle className="h-5 w-5 text-orange-600" />}
                    {indicator.status === 'critical' && <AlertCircle className="h-5 w-5 text-red-600" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{indicator.metric}</p>
                      <p className="text-xs text-gray-600">
                        {indicator.value} (threshold: {indicator.threshold})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Analytics */}
        <Tabs defaultValue="funnel" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
            <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="attribution">Attribution</TabsTrigger>
          </TabsList>

          {/* Conversion Funnel */}
          <TabsContent value="funnel" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Pilot Application Conversion Funnel
                </CardTitle>
                <CardDescription>
                  Track applications through each stage from submission to completion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {funnelMetrics.map((stage, index) => (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{stage.stage}</p>
                            <p className="text-sm text-gray-600">
                              {stage.count} applications • {stage.conversionRate.toFixed(1)}% conversion
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {stage.dropOffRate > 0 && (
                            <Badge variant="outline" className="text-orange-600">
                              {stage.dropOffRate.toFixed(1)}% drop-off
                            </Badge>
                          )}
                          {stage.averageTimeInStage > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Avg: {stage.averageTimeInStage.toFixed(1)}h
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Visual bar */}
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all"
                          style={{ width: `${stage.conversionRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Key Insights */}
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-3">Key Insights</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Overall Conversion</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {funnelMetrics.length > 0 && funnelMetrics[0].count > 0
                          ? ((funnelMetrics[funnelMetrics.length - 1].count / funnelMetrics[0].count) * 100).toFixed(1)
                          : 0}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Submitted → Completed</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Approval Rate</p>
                      <p className="text-2xl font-bold text-green-600">
                        {funnelMetrics.length > 2 && funnelMetrics[1].count > 0
                          ? ((funnelMetrics[2].count / funnelMetrics[1].count) * 100).toFixed(1)
                          : 0}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Review → Approved</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Biggest Drop-off</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {Math.max(...funnelMetrics.map((s) => s.dropOffRate)).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Stage: {funnelMetrics.find((s) => s.dropOffRate === Math.max(...funnelMetrics.map((m) => m.dropOffRate)))?.stage}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cohort Analysis */}
          <TabsContent value="cohorts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Cohort Performance Analysis
                </CardTitle>
                <CardDescription>
                  Compare success rates across different organization types and characteristics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {cohorts.map((cohort) => (
                    <div key={cohort.cohortName} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{cohort.cohortName}</h3>
                          <p className="text-sm text-gray-600">{cohort.cohortSize} applications</p>
                        </div>
                        <Badge
                          variant={cohort.successRate > 60 ? 'default' : cohort.successRate > 40 ? 'secondary' : 'outline'}
                        >
                          {cohort.successRate.toFixed(1)}% success
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Avg Readiness</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {cohort.averageReadinessScore.toFixed(0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Avg Time to Approval</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {cohort.averageTimeToApproval.toFixed(1)}d
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Avg Members</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {cohort.characteristics.memberCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Sectors</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {cohort.characteristics.sectors.length}
                          </p>
                        </div>
                      </div>

                      {/* Success rate bar */}
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              cohort.successRate > 60
                                ? 'bg-green-600'
                                : cohort.successRate > 40
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${cohort.successRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Trend Analysis (30-Day Comparison)
                </CardTitle>
                <CardDescription>
                  Current period vs previous period performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trends.map((trend) => (
                    <div key={trend.metric} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{trend.metric}</h4>
                          <p className="text-sm text-gray-600">{trend.interpretation}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {trend.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-600" />}
                            {trend.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-600" />}
                            {trend.trend === 'stable' && <Minus className="h-5 w-5 text-gray-600" />}
                            <span
                              className={`text-lg font-bold ${
                                trend.trend === 'up'
                                  ? 'text-green-600'
                                  : trend.trend === 'down'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {trend.percentageChange > 0 ? '+' : ''}
                              {trend.percentageChange.toFixed(1)}%
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              trend.momentum === 'accelerating'
                                ? 'border-green-600 text-green-600'
                                : trend.momentum === 'decelerating'
                                ? 'border-red-600 text-red-600'
                                : 'border-gray-600 text-gray-600'
                            }
                          >
                            {trend.momentum}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-gray-600">Current Period</p>
                          <p className="text-xl font-semibold text-gray-900">
                            {trend.currentValue.toFixed(1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Previous Period</p>
                          <p className="text-xl font-semibold text-gray-500">
                            {trend.previousValue.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attribution */}
          <TabsContent value="attribution" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-orange-600" />
                  Marketing Attribution
                </CardTitle>
                <CardDescription>
                  Which marketing channels drive pilot applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {attribution.map((source) => (
                    <div key={source.source} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{source.source}</h4>
                          <p className="text-sm text-gray-600">
                            {source.conversions} conversions • {source.attributionPercentage}% of total
                          </p>
                        </div>
                        <Badge variant="outline">{source.successRate.toFixed(1)}% success</Badge>
                      </div>

                      {/* Attribution bar */}
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                        <div
                          className="bg-orange-600 h-3 rounded-full transition-all"
                          style={{ width: `${source.attributionPercentage}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600">Avg Readiness</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {source.averageReadiness.toFixed(0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Conversions</p>
                          <p className="text-lg font-semibold text-gray-900">{source.conversions}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Key Insight */}
                <div className="mt-6 pt-6 border-t">
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-orange-900 mb-2">Top Performing Channel</p>
                    <p className="text-lg font-bold text-orange-600">
                      {attribution.length > 0 ? attribution[0].source : 'N/A'}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      Drives {attribution.length > 0 ? attribution[0].attributionPercentage : 0}% of all pilot
                      applications with {attribution.length > 0 ? attribution[0].successRate.toFixed(1) : 0}% success
                      rate
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Export & Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Export & Integration</CardTitle>
            <CardDescription>Download analytics data or integrate with external tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Export to CSV
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                Export to PDF
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                Schedule Report
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                API Documentation
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
