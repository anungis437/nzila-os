/**
 * CBA Clause Analytics Dashboard
 * 
 * Visualizes clause extraction analytics, AI performance metrics,
 * and precedent matching insights.
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';

interface ClauseTypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

interface AIPerformanceMetrics {
  date: string;
  extractionAccuracy: number;
  classificationAccuracy: number;
  processingTime: number;
}

interface PrecedentMatchStats {
  totalMatches: number;
  avgConfidence: number;
  byJurisdiction: Array<{
    jurisdiction: string;
    count: number;
  }>;
}

export function CBAClauseAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [clauseDistribution, setClauseDistribution] = useState<ClauseTypeDistribution[]>([]);
  const [aiPerformance, setAiPerformance] = useState<AIPerformanceMetrics[]>([]);
  const [precedentStats, setPrecedentStats] = useState<PrecedentMatchStats | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch clause type distribution
      const clauseRes = await fetch('/api/analytics/cba/clause-distribution');
      const clauseData = await clauseRes.json();
      setClauseDistribution(clauseData.distribution || []);

      // Fetch AI performance metrics
      const perfRes = await fetch('/api/analytics/cba/ai-performance');
      const perfData = await perfRes.json();
      setAiPerformance(perfData.metrics || []);

      // Fetch precedent matching stats
      const precRes = await fetch('/api/analytics/cba/precedent-stats');
      const precData = await precRes.json();
      setPrecedentStats(precData);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF6B9D', '#C8B6FF', '#FFD93D'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">CBA Intelligence Analytics</h2>
          <p className="text-muted-foreground">
            AI-powered clause extraction and precedent matching insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clauses Extracted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clauseDistribution.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {clauseDistribution.length} clause types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Extraction Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiPerformance.length > 0 
                ? `${(aiPerformance[aiPerformance.length - 1].extractionAccuracy * 100).toFixed(1)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precedent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {precedentStats?.totalMatches.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg confidence: {((precedentStats?.avgConfidence || 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clause Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Clause Type Distribution</CardTitle>
          <CardDescription>
            Breakdown of extracted clauses by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clauseDistribution}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ type, percentage }) => `${type}: ${percentage.toFixed(1)}%`}
                >
                  {clauseDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            {/* Bar Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clauseDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI Performance Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>AI Performance Metrics</CardTitle>
          <CardDescription>
            Extraction and classification accuracy trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aiPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip 
                formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="extractionAccuracy" 
                stroke="#8884d8" 
                name="Extraction Accuracy"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="classificationAccuracy" 
                stroke="#82ca9d" 
                name="Classification Accuracy"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Precedent Matches by Jurisdiction */}
      {precedentStats && (
        <Card>
          <CardHeader>
            <CardTitle>Precedent Matches by Jurisdiction</CardTitle>
            <CardDescription>
              Distribution of precedent matches across labor jurisdictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={precedentStats.byJurisdiction}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jurisdiction" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

