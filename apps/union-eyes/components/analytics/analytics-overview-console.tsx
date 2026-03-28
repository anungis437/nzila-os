"use client";

import React from 'react';
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CheckCircle,
  Clock,
  Calendar,
  Award,
  Briefcase,
  Target,
  Download,
  Filter,
  ChevronDown,
} from "lucide-react";

type TimeRange = "7d" | "30d" | "90d" | "1y" | "all";
type MetricCategory = "cases" | "members" | "grievances" | "financial";

interface Metric {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ReactElement;
  color: string;
}

interface ChartDataPoint {
  month: string;
  cases: number;
  resolved: number;
  pending: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

interface AnalyticsOverviewConsoleProps {
  canViewTopPerformers?: boolean;
}

export function AnalyticsOverviewConsole({ canViewTopPerformers = false }: AnalyticsOverviewConsoleProps) {
  const t = useTranslations();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [_selectedCategory, _setSelectedCategory] = useState<MetricCategory>("cases");

  const timeRangeLabels: Record<TimeRange, string> = {
    "7d": t('analytics.last7Days'),
    "30d": t('analytics.last30Days'),
    "90d": t('analytics.last90Days'),
    "1y": t('analytics.lastYear'),
    "all": t('analytics.allTime'),
  };

  // Metrics from API
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [topStewards, setTopStewards] = useState<{ name: string; cases: number; resolved: number; rate: number }[]>([]);
  const [quickStats, setQuickStats] = useState({ openCases: 0, resolved: 0, avgResponseHrs: 0, activeStewards: 0, openPct: '0%', resolvedPct: '0%', stewardPct: '0%' });

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/analytics/overview?range=${timeRange}`);
      if (res.ok) {
        const raw = await res.json();
        // withApi wraps in { success, data: { metrics, ... }, timestamp }
        const data = raw.data ?? raw;
        if (data.metrics && Array.isArray(data.metrics)) {
          const iconMap: Record<string, React.ReactElement> = {
            'Total Cases': <FileText className="w-5 h-5" />,
            'Resolved': <CheckCircle className="w-5 h-5" />,
            'Active Members': <Users className="w-5 h-5" />,
            'Open Cases': <Clock className="w-5 h-5" />,
            'Avg Response Time': <TrendingUp className="w-5 h-5" />,
            'Resolution Rate': <Target className="w-5 h-5" />,
          };
          setMetrics(data.metrics.map((m: Record<string, unknown>) => ({
            label: (m.label as string) ?? '',
            value: String(m.value ?? 0),
            change: Number(m.change ?? 0),
            changeLabel: (m.changeLabel as string) ?? '',
            icon: iconMap[(m.label as string) ?? ''] ?? <BarChart3 className="w-5 h-5" />,
            color: (m.color as string) ?? 'text-blue-600 bg-blue-100',
          })));
        }
        if (data.chartData) setChartData(data.chartData);
        if (data.categoryBreakdown) setCategoryBreakdown(data.categoryBreakdown);
        if (data.topStewards) setTopStewards(data.topStewards);
        if (data.quickStats) {
          const qs = data.quickStats;
          setQuickStats({
            openCases: qs.openCases ?? 0,
            resolved: qs.resolved ?? 0,
            avgResponseHrs: qs.avgResponseHrs ?? 0,
            activeStewards: qs.activeStewards ?? 0,
            openPct: qs.openPct ?? '0%',
            resolvedPct: qs.resolvedPct ?? '0%',
            stewardPct: qs.stewardPct ?? '0%',
          });
        }
      }
    } catch { /* API not available */ }
  }, [timeRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    loadAnalytics();
  }, [loadAnalytics]);

  const maxCaseValue = Math.max(...chartData.map(d => d.cases));

  return (
    <div>
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{t('analytics.title')}</h1>
          </div>
          <p className="text-gray-600">{t('analytics.subtitle')}</p>
        </motion.div>

        {/* Time Range and Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">{t('analytics.timeRange')}:</span>
                  <div className="flex gap-1">
                    {(["7d", "30d", "90d", "1y", "all"] as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          timeRange === range
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {timeRangeLabels[range]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('common.filter')}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('analytics.exportReport')}</span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${metric.color}`}>
                      {metric.icon}
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      metric.change > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {metric.change > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>{Math.abs(metric.change)}%</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.label}</h3>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</p>
                  <p className="text-xs text-gray-500">{metric.changeLabel}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cases Trend Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  {t('analytics.casesTrend')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">{t('analytics.resolved')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-gray-600">{t('analytics.pending')}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {chartData.map((dataPoint) => (
                      <div key={dataPoint.month} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 font-medium w-12">{dataPoint.month}</span>
                          <div className="flex-1 mx-4 flex">
                            <div
                              className="h-8 bg-green-500 rounded-l transition-all hover:bg-green-600"
                              style={{ width: `${maxCaseValue > 0 ? (dataPoint.resolved / maxCaseValue) * 100 : 0}%` }}
                              title={`Resolved: ${dataPoint.resolved}`}
                            />
                            <div
                              className="h-8 bg-orange-500 rounded-r transition-all hover:bg-orange-600"
                              style={{ width: `${maxCaseValue > 0 ? (dataPoint.pending / maxCaseValue) * 100 : 0}%` }}
                              title={`Pending: ${dataPoint.pending}`}
                            />
                          </div>
                          <span className="text-gray-900 font-semibold w-8 text-right">{dataPoint.cases}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  {t('analytics.casesByCategory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryBreakdown.map((category) => (
                    <div key={category.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 font-medium">{category.category}</span>
                        <span className="text-gray-900 font-semibold">{category.count} ({category.percentage}%)</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${category.percentage}%` }}
                          transition={{ delay: 1 + categoryBreakdown.indexOf(category) * 0.1, duration: 0.5 }}
                          className={`h-full ${category.color} rounded-full`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Row */}
        <div className={`grid grid-cols-1 ${canViewTopPerformers ? 'lg:grid-cols-2' : ''} gap-6`}>
          {/* Top Performing Stewards — chief_steward+ only */}
          {canViewTopPerformers && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  {t('analytics.topPerformingStewards')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topStewards.map((steward, index) => (
                    <div key={steward.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-center w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full text-white font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{steward.name}</p>
                        <p className="text-sm text-gray-600">{t('analytics.casesHandled', { count: steward.cases })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-indigo-600">{steward.rate}%</p>
                        <p className="text-xs text-gray-500">{t('analytics.resolved', { count: steward.resolved })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          )}

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                  {t('analytics.additionalMetrics')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700 font-medium">{t('analytics.openCases')}</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{quickStats.openCases}</p>
                    <p className="text-xs text-blue-600 mt-1">{t('analytics.ofTotal', { percentage: quickStats.openPct })}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">{t('analytics.resolved')}</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{quickStats.resolved}</p>
                    <p className="text-xs text-green-600 mt-1">{t('analytics.ofTotal', { percentage: quickStats.resolvedPct })}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-700 font-medium">{t('analytics.avgResponse')}</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">{quickStats.avgResponseHrs} hrs</p>
                    <p className="text-xs text-orange-600 mt-1">{t('analytics.within24hTarget')}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-purple-700 font-medium">{t('analytics.activeStewards')}</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">{quickStats.activeStewards}</p>
                    <p className="text-xs text-purple-600 mt-1">{t('analytics.ofMembers', { percentage: quickStats.stewardPct })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-6"
        >
          <Card className="bg-linear-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('analytics.understandingAnalytics')}</h3>
                  <p className="text-gray-700 mb-4">
                    {t('analytics.analyticsDescription')}
                  </p>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                    {t('analytics.viewAnalyticsGuide')}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
