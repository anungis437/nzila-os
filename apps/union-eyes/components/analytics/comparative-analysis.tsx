'use client';

/**
 * Comparative Analysis Component
 * Q1 2025 - Advanced Analytics
 * 
 * Cross-organization benchmarking and comparison
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ArrowUp, ArrowDown, Minus, RefreshCw } from 'lucide-react';

interface ComparativeAnalysisProps {
  organizationId: string;
}

interface ComparisonData {
  organizationName: string;
  metricValue: number;
  rank: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

interface GapAnalysis {
  metric: string;
  currentValue: number;
  benchmarkValue: number;
  gap: number;
  gapPercent: number;
  status: 'ahead' | 'behind' | 'on_par';
  recommendation: string;
}

export function ComparativeAnalysis({ organizationId }: ComparativeAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('claims_volume');
  const [timeRange, setTimeRange] = useState('30d');
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [industryBenchmark, setIndustryBenchmark] = useState<any>(null);

  useEffect(() => {
    fetchComparativeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedMetric, timeRange]);

  async function fetchComparativeData() {
    setLoading(true);
    try {
      // Fetch comparative analysis data
      const response = await fetch(
        `/api/analytics/comparative?organizationId=${organizationId}&metric=${selectedMetric}&timeRange=${timeRange}`
      );
      const data = await response.json();

      if (data.success) {
        setComparisonData(data.comparisonData || []);
        setGapAnalysis(data.gapAnalysis || []);
        setIndustryBenchmark(data.industryBenchmark || null);
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ahead':
        return 'bg-green-100 text-green-800';
      case 'behind':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-4">
        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claims_volume">Claims Volume</SelectItem>
            <SelectItem value="resolution_time">Resolution Time</SelectItem>
            <SelectItem value="member_growth">Member Growth</SelectItem>
            <SelectItem value="member_satisfaction">Member Satisfaction</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={fetchComparativeData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Industry Benchmark Card */}
      {industryBenchmark && (
        <Card>
          <CardHeader>
            <CardTitle>Industry Benchmark</CardTitle>
            <CardDescription>
              How you compare to industry average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Your Performance</p>
                <p className="text-2xl font-bold">{industryBenchmark.yourValue}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Industry Average</p>
                <p className="text-2xl font-bold">{industryBenchmark.industryAverage}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Percentile Rank</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{industryBenchmark.percentile}th</p>
                  <Badge className={getStatusColor(industryBenchmark.status)}>
                    {industryBenchmark.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peer Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Peer Comparison</CardTitle>
          <CardDescription>
            Compare your performance with similar organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comparisonData.length > 0 ? (
            <div className="space-y-4">
              {comparisonData.map((org, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <span className="font-bold text-primary">#{org.rank}</span>
                    </div>
                    <div>
                      <p className="font-medium">{org.organizationName}</p>
                      <p className="text-sm text-muted-foreground">
                        {org.percentile}th percentile
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-bold">{org.metricValue.toFixed(1)}</p>
                      <div className="flex items-center gap-1 text-sm">
                        {getTrendIcon(org.trend)}
                        <span
                          className={
                            org.changePercent > 0 ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {Math.abs(org.changePercent).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No comparison data available for this metric
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gap Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Gap Analysis</CardTitle>
          <CardDescription>
            Identify areas for improvement based on benchmarks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gapAnalysis.length > 0 ? (
            <div className="space-y-4">
              {gapAnalysis.map((gap, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{gap.metric}</h4>
                      <Badge className={getStatusColor(gap.status)} variant="secondary">
                        {gap.status === 'ahead' && 'Ahead of benchmark'}
                        {gap.status === 'behind' && 'Behind benchmark'}
                        {gap.status === 'on_par' && 'On par with benchmark'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Gap</p>
                      <p
                        className={`text-lg font-bold ${
                          gap.status === 'ahead' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {gap.status === 'ahead' ? '+' : ''}
                        {gap.gap.toFixed(1)} ({gap.gapPercent.toFixed(1)}%)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Your Value</p>
                      <p className="font-medium">{gap.currentValue.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Benchmark</p>
                      <p className="font-medium">{gap.benchmarkValue.toFixed(1)}</p>
                    </div>
                  </div>

                  {gap.recommendation && (
                    <div className="bg-muted/50 rounded p-3">
                      <p className="text-sm font-medium mb-1">Recommendation</p>
                      <p className="text-sm text-muted-foreground">
                        {gap.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No gap analysis available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

