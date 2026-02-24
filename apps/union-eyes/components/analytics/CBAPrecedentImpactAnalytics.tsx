/**
 * CBA Precedent Impact Analytics
 * 
 * Analyzes the impact and outcomes of precedent matches,
 * showing success rates and trends.
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Award, Target } from 'lucide-react';

interface PrecedentOutcome {
  outcome: string;
  count: number;
  percentage: number;
  avgSettlementDays: number;
}

interface PrecedentTrend {
  month: string;
  matches: number;
  successful: number;
  successRate: number;
}

interface TopPrecedent {
  id: string;
  title: string;
  timesUsed: number;
  successRate: number;
  jurisdiction: string;
}

export function CBAPrecedentImpactAnalytics() {
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState<PrecedentOutcome[]>([]);
  const [trends, setTrends] = useState<PrecedentTrend[]>([]);
  const [topPrecedents, setTopPrecedents] = useState<TopPrecedent[]>([]);

  useEffect(() => {
    fetchImpactData();
  }, []);

  const fetchImpactData = async () => {
    setLoading(true);
    try {
      // Fetch outcome distribution
      const outcomeRes = await fetch('/api/analytics/cba/precedent-outcomes');
      const outcomeData = await outcomeRes.json();
      setOutcomes(outcomeData.outcomes || []);

      // Fetch trends over time
      const trendRes = await fetch('/api/analytics/cba/precedent-trends?period=12m');
      const trendData = await trendRes.json();
      setTrends(trendData.trends || []);

      // Fetch top precedents
      const topRes = await fetch('/api/analytics/cba/top-precedents?limit=10');
      const topData = await topRes.json();
      setTopPrecedents(topData.precedents || []);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const overallSuccessRate = trends.length > 0
    ? trends.reduce((sum, t) => sum + t.successRate, 0) / trends.length
    : 0;

  const trendDirection = trends.length >= 2
    ? trends[trends.length - 1].successRate - trends[trends.length - 2].successRate
    : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Precedent Impact Analytics</h2>
        <p className="text-muted-foreground">
          Track the effectiveness of precedent-based decisions
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Success Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(overallSuccessRate * 100).toFixed(1)}%
            </div>
            <div className="flex items-center text-xs">
              {trendDirection > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{(trendDirection * 100).toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{(trendDirection * 100).toFixed(1)}%</span>
                </>
              )}
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Precedents</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topPrecedents.reduce((sum, p) => sum + p.timesUsed, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Cases citing precedents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Settlement Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outcomes.length > 0
                ? Math.round(
                    outcomes.reduce((sum, o) => sum + o.avgSettlementDays, 0) / outcomes.length
                  )
                : 0}{' '}
              days
            </div>
            <p className="text-xs text-muted-foreground">
              For precedent-based cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topPrecedents.length > 0
                ? `${(topPrecedents[0].successRate * 100).toFixed(0)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {topPrecedents[0]?.title || 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outcome Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Precedent-Based Case Outcomes</CardTitle>
          <CardDescription>
            Distribution of outcomes when precedents are cited
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={outcomes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="outcome" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
              <Bar 
                yAxisId="right" 
                dataKey="percentage" 
                fill="#82ca9d" 
                name="Percentage"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Success Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Success Rate Trend</CardTitle>
          <CardDescription>
            Monthly success rate for precedent-based decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                domain={[0, 1]} 
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} 
              />
              <Tooltip 
                formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="successRate"
                stroke="#82ca9d"
                fillOpacity={1}
                fill="url(#colorSuccess)"
                name="Success Rate"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performing Precedents */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Precedents</CardTitle>
          <CardDescription>
            Most frequently cited precedents with highest success rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPrecedents.slice(0, 10).map((precedent, index) => (
              <div
                key={precedent.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{precedent.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{precedent.jurisdiction}</span>
                      <span>â€¢</span>
                      <span>Used {precedent.timesUsed} times</span>
                    </div>
                  </div>
                </div>
                <Badge
                  variant={precedent.successRate >= 0.8 ? 'default' : 'secondary'}
                  className="ml-2"
                >
                  {(precedent.successRate * 100).toFixed(0)}% success
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

