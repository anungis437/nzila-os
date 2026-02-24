'use client';

/**
 * CLC Remittance Analytics Dashboard
 * 
 * Comprehensive analytics dashboard for multi-year trend analysis, organization comparisons,
 * payment patterns, forecasting, and compliance monitoring for CLC per-capita remittances.
 * 
 * Features:
 * - Multi-year trend visualization (3, 5, 10 year views)
 * - Organization performance benchmarking
 * - Payment pattern analysis
 * - Forecasting and projections
 * - Compliance anomaly detection
 * - Executive summary cards
 * - Interactive charts and filters
 * 
 * Usage:
 * ```typescript
 * import CLCAnalyticsDashboard from '@/components/admin/clc-analytics-dashboard';
 * 
 * <CLCAnalyticsDashboard />
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  PieChart as _PieChartIcon,
  Activity,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AnnualComplianceReport {
  year: number;
  generatedAt: Date;
  summary: ComplianceSummary;
  organizationPerformance: OrganizationPerformance[];
  paymentPatterns: PaymentPatternAnalysis;
  complianceMetrics: ComplianceMetrics;
  anomalies: ComplianceAnomaly[];
  recommendations: string[];
}

interface ComplianceSummary {
  totalOrganizations: number;
  totalRemittances: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  complianceRate: number;
  averagePaymentDelay: number;
}

interface OrganizationPerformance {
  organizationId: string;
  organizationName: string;
  charterNumber: string;
  remittanceCount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueCount: number;
  averagePaymentDelay: number;
  complianceRate: number;
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high';
}

interface PaymentPatternAnalysis {
  monthlyDistribution: MonthlyPaymentStats[];
  averageProcessingTime: number;
  onTimePaymentRate: number;
  latePaymentRate: number;
  nonPaymentRate: number;
  seasonalTrends: SeasonalTrend[];
}

interface MonthlyPaymentStats {
  month: number;
  year: number;
  remittanceCount: number;
  totalAmount: number;
  paidCount: number;
  overdueCount: number;
  averageDelay: number;
}

interface SeasonalTrend {
  quarter: number;
  averageAmount: number;
  averageDelay: number;
  complianceRate: number;
}

interface ComplianceMetrics {
  onTimeSubmissionRate: number;
  onTimePaymentRate: number;
  averageSubmissionDelay: number;
  averagePaymentDelay: number;
  perfectComplianceOrgs: number;
  criticalNonComplianceOrgs: number;
}

interface ComplianceAnomaly {
  type: 'late_submission' | 'late_payment' | 'missing_remittance' | 'calculation_error' | 'payment_pattern_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  organizationId: string;
  organizationName: string;
  remittanceId?: string;
  period?: string;
  description: string;
  suggestedAction: string;
  detectedAt: Date;
}

interface MultiYearTrendAnalysis {
  years: number[];
  totalRemittancesTrend: YearlyMetric[];
  totalAmountTrend: YearlyMetric[];
  complianceRateTrend: YearlyMetric[];
  organizationGrowth: YearlyMetric[];
  forecastNextYear: ForecastMetrics;
  keyInsights: string[];
}

interface YearlyMetric {
  year: number;
  value: number;
  changeFromPrevious: number;
  changeFromPreviousAbsolute: number;
}

interface ForecastMetrics {
  year: number;
  forecastRemittances: number;
  forecastAmount: number;
  forecastComplianceRate: number;
  confidenceLevel: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CLCAnalyticsDashboard() {
  const { toast } = useToast();

  // State management
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [trendYears, setTrendYears] = useState<3 | 5 | 10>(5);
  const [annualReport, setAnnualReport] = useState<AnnualComplianceReport | null>(null);
  const [multiYearTrends, setMultiYearTrends] = useState<MultiYearTrendAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch annual compliance report
  const fetchAnnualReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/clc/analytics/annual-report?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch annual report');
      
      const data = await response.json();
      setAnnualReport(data);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to load annual compliance report',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedYear, toast]);

  // Fetch multi-year trends
  const fetchMultiYearTrends = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/clc/analytics/multi-year-trends?years=${trendYears}`);
      if (!response.ok) throw new Error('Failed to fetch multi-year trends');
      
      const data = await response.json();
      setMultiYearTrends(data);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to load multi-year trends',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [trendYears, toast]);

  // Initial data load
  useEffect(() => {
    fetchAnnualReport();
    fetchMultiYearTrends();
  }, [fetchAnnualReport, fetchMultiYearTrends]);

  // Export report
  const handleExportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      const response = await fetch(
        `/api/admin/clc/analytics/export?year=${selectedYear}&format=${format}`,
        { method: 'GET' }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clc-analytics-${selectedYear}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: `Report exported as ${format.toUpperCase()}`
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to export report',
        variant: 'destructive'
      });
    }
  };

  // Refresh data
  const handleRefresh = () => {
    fetchAnnualReport();
    fetchMultiYearTrends();
    toast({
      title: 'Refreshed',
      description: 'Analytics data updated'
    });
  };

  if (loading && !annualReport) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CLC Remittance Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive compliance reporting and trend analysis
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" onClick={() => handleExportReport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Critical Anomalies Alert */}
      {annualReport && annualReport.anomalies.filter(a => a.severity === 'critical').length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Critical Compliance Issues Detected</AlertTitle>
          <AlertDescription>
            {annualReport.anomalies.filter(a => a.severity === 'critical').length} critical anomalies 
            require immediate attention. Review the Anomalies tab for details.
          </AlertDescription>
        </Alert>
      )}

      {/* Executive Summary Cards */}
      {annualReport && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Remittances"
            value={annualReport.summary.totalRemittances.toLocaleString()}
            description={`${annualReport.summary.totalOrganizations} organizations`}
            icon={<Calendar className="h-4 w-4" />}
            trend={null}
          />
          
          <SummaryCard
            title="Total Amount"
            value={`$${annualReport.summary.totalAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
            description={`Paid: $${annualReport.summary.paidAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign className="h-4 w-4" />}
            trend={null}
          />
          
          <SummaryCard
            title="Compliance Rate"
            value={`${annualReport.summary.complianceRate.toFixed(1)}%`}
            description={`${annualReport.complianceMetrics.perfectComplianceOrgs} perfect orgs`}
            icon={<CheckCircle className="h-4 w-4" />}
            trend={annualReport.summary.complianceRate >= 90 ? 'up' : annualReport.summary.complianceRate >= 80 ? null : 'down'}
          />
          
          <SummaryCard
            title="Outstanding"
            value={`$${annualReport.summary.outstandingAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
            description={`Overdue: $${annualReport.summary.overdueAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
            icon={<AlertTriangle className="h-4 w-4" />}
            trend={annualReport.summary.outstandingAmount > 0 ? 'down' : 'up'}
          />
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Multi-Year Trends</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="patterns">Payment Patterns</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {annualReport && (
            <>
              {/* Compliance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Metrics - {selectedYear}</CardTitle>
                  <CardDescription>Key performance indicators for per-capita remittances</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="On-Time Submission"
                      value={`${annualReport.complianceMetrics.onTimeSubmissionRate.toFixed(1)}%`}
                      subtext={`Avg delay: ${annualReport.complianceMetrics.averageSubmissionDelay.toFixed(0)} days`}
                    />
                    <MetricCard
                      label="On-Time Payment"
                      value={`${annualReport.complianceMetrics.onTimePaymentRate.toFixed(1)}%`}
                      subtext={`Avg delay: ${annualReport.complianceMetrics.averagePaymentDelay.toFixed(0)} days`}
                    />
                    <MetricCard
                      label="Critical Non-Compliance"
                      value={annualReport.complianceMetrics.criticalNonComplianceOrgs.toString()}
                      subtext={`Organizations >30 days overdue`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Remittance Distribution</CardTitle>
                  <CardDescription>Volume and compliance by month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={annualReport.paymentPatterns.monthlyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={(month) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]}
                      />
                      <YAxis yAxisId="left" label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Amount ($)', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="remittanceCount" fill="#8884d8" name="Total Remittances" />
                      <Bar yAxisId="left" dataKey="paidCount" fill="#82ca9d" name="Paid Remittances" />
                      <Bar yAxisId="left" dataKey="overdueCount" fill="#ff6b6b" name="Overdue" />
                      <Line yAxisId="right" type="monotone" dataKey="totalAmount" stroke="#ff7300" name="Total Amount" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Payment Pattern Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Pattern Distribution</CardTitle>
                  <CardDescription>Breakdown of payment statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'On Time', value: annualReport.paymentPatterns.onTimePaymentRate },
                              { name: 'Late', value: annualReport.paymentPatterns.latePaymentRate },
                              { name: 'Not Paid', value: annualReport.paymentPatterns.nonPaymentRate }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill="#82ca9d" />
                            <Cell fill="#ffa500" />
                            <Cell fill="#ff6b6b" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col justify-center space-y-4">
                      <div>
                        <p className="text-sm font-medium">Average Processing Time</p>
                        <p className="text-2xl font-bold">{annualReport.paymentPatterns.averageProcessingTime.toFixed(1)} days</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Seasonal Patterns</p>
                        <div className="space-y-2 mt-2">
                          {annualReport.paymentPatterns.seasonalTrends.map((trend) => (
                            <div key={trend.quarter} className="flex justify-between text-sm">
                              <span>Q{trend.quarter}</span>
                              <span>{trend.complianceRate.toFixed(1)}% compliance</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>Automated compliance improvement suggestions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {annualReport.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Multi-Year Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {multiYearTrends && (
            <>
              {/* Trend Period Selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Multi-Year Trend Analysis</CardTitle>
                  <CardDescription>Historical performance and forecasting</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-medium">Period:</span>
                    <Button
                      variant={trendYears === 3 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTrendYears(3)}
                    >
                      3 Years
                    </Button>
                    <Button
                      variant={trendYears === 5 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTrendYears(5)}
                    >
                      5 Years
                    </Button>
                    <Button
                      variant={trendYears === 10 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTrendYears(10)}
                    >
                      10 Years
                    </Button>
                  </div>

                  {/* Remittance Count Trend */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Total Remittances Trend</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={multiYearTrends.totalRemittancesTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="value" stroke="#8884d8" name="Remittances" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Total Amount Trend */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Total Amount Trend</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={multiYearTrends.totalAmountTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                          <Legend />
                          <Line type="monotone" dataKey="value" stroke="#82ca9d" name="Total Amount" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Compliance Rate Trend */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Compliance Rate Trend</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={multiYearTrends.complianceRateTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Legend />
                          <Line type="monotone" dataKey="value" stroke="#ff7300" name="Compliance Rate %" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                  <CardDescription>Automated trend analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {multiYearTrends.keyInsights.map((insight, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Activity className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          {annualReport && (
            <Card>
              <CardHeader>
                <CardTitle>Organization Performance - {selectedYear}</CardTitle>
                <CardDescription>Ranked by total remittance amount</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>CLC Code</TableHead>
                      <TableHead className="text-right">Remittances</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annualReport.organizationPerformance.slice(0, 20).map((org) => (
                      <TableRow key={org.organizationId}>
                        <TableCell className="font-medium">{org.organizationName}</TableCell>
                        <TableCell>{org.charterNumber}</TableCell>
                        <TableCell className="text-right">{org.remittanceCount}</TableCell>
                        <TableCell className="text-right">${org.totalAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">${org.paidAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">${org.outstandingAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{org.overdueCount}</TableCell>
                        <TableCell className="text-right">{org.complianceRate.toFixed(1)}%</TableCell>
                        <TableCell>
                          {org.trend === 'improving' && <TrendingUp className="h-4 w-4 text-green-500" />}
                          {org.trend === 'declining' && <TrendingDown className="h-4 w-4 text-red-500" />}
                          {org.trend === 'stable' && <span className="text-gray-500">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            org.riskLevel === 'low' ? 'default' :
                            org.riskLevel === 'medium' ? 'secondary' : 'destructive'
                          }>
                            {org.riskLevel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payment Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          {annualReport && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Seasonal Compliance Trends</CardTitle>
                  <CardDescription>Quarterly performance analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={annualReport.paymentPatterns.seasonalTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" tickFormatter={(q) => `Q${q}`} />
                      <YAxis yAxisId="left" label={{ value: 'Compliance %', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg Delay (days)', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="complianceRate" fill="#82ca9d" name="Compliance Rate %" />
                      <Line yAxisId="right" type="monotone" dataKey="averageDelay" stroke="#ff7300" name="Avg Delay" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Payment Delays</CardTitle>
                  <CardDescription>Average days from due date to payment</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={annualReport.paymentPatterns.monthlyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={(month) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="averageDelay" fill="#ffa500" name="Average Delay (days)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          {annualReport && (
            <Card>
              <CardHeader>
                <CardTitle>Compliance Anomalies - {selectedYear}</CardTitle>
                <CardDescription>Detected issues requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {annualReport.anomalies.map((anomaly, index) => (
                    <Alert
                      key={index}
                      variant={anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'destructive' : 'default'}
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>
                        <div className="flex items-center justify-between">
                          <span>{anomaly.organizationName}</span>
                          <Badge variant={
                            anomaly.severity === 'critical' ? 'destructive' :
                            anomaly.severity === 'high' ? 'destructive' :
                            anomaly.severity === 'medium' ? 'secondary' : 'default'
                          }>
                            {anomaly.severity}
                          </Badge>
                        </div>
                      </AlertTitle>
                      <AlertDescription>
                        <p className="font-medium">{anomaly.description}</p>
                        <p className="text-sm mt-2">
                          <strong>Type:</strong> {anomaly.type.replace('_', ' ')} | 
                          <strong> Period:</strong> {anomaly.period || 'N/A'}
                        </p>
                        <p className="text-sm mt-2 text-blue-600">
                          <strong>Suggested Action:</strong> {anomaly.suggestedAction}
                        </p>
                      </AlertDescription>
                    </Alert>
                  ))}
                  
                  {annualReport.anomalies.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No compliance anomalies detected for {selectedYear}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          {multiYearTrends && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Next Year Forecast - {multiYearTrends.forecastNextYear.year}</CardTitle>
                  <CardDescription>
                    Confidence Level: {multiYearTrends.forecastNextYear.confidenceLevel}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Forecast Remittances"
                      value={multiYearTrends.forecastNextYear.forecastRemittances.toLocaleString()}
                      subtext="Expected submissions"
                    />
                    <MetricCard
                      label="Forecast Amount"
                      value={`$${multiYearTrends.forecastNextYear.forecastAmount.toLocaleString()}`}
                      subtext="Projected revenue"
                    />
                    <MetricCard
                      label="Forecast Compliance"
                      value={`${multiYearTrends.forecastNextYear.forecastComplianceRate.toFixed(1)}%`}
                      subtext="Expected rate"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Forecast Visualization</CardTitle>
                  <CardDescription>Historical data with projected next year</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={[
                        ...multiYearTrends.totalAmountTrend.map(t => ({ year: t.year, value: t.value, type: 'actual' })),
                        { 
                          year: multiYearTrends.forecastNextYear.year, 
                          value: multiYearTrends.forecastNextYear.forecastAmount, 
                          type: 'forecast' 
                        }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8884d8" 
                        strokeDasharray="5 5"
                        name="Total Amount"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SummaryCard({
  title,
  value,
  description,
  icon,
  trend
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="mt-2">
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  subtext
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

