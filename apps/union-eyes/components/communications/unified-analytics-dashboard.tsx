'use client';

/**
 * Unified Analytics Dashboard
 * Aggregates communication metrics across all channels (SMS, newsletters, surveys, polls, push)
 * Provides comprehensive insights with time-series charts, channel comparison, and export capabilities
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Mail,
  Bell,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Users,
  Target,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

// =============================================
// TYPES
// =============================================

interface ChannelMetrics {
  channel: 'sms' | 'newsletter' | 'survey' | 'poll' | 'push';
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalEngaged: number;
  deliveryRate: number;
  engagementRate: number;
  cost?: number;
}

interface TimeSeriesData {
  date: string;
  sms: number;
  newsletter: number;
  survey: number;
  poll: number;
  push: number;
}

interface EngagementHeatmap {
  hour: number;
  day: string;
  count: number;
}

interface MemberEngagement {
  memberId: string;
  memberName: string;
  email: string;
  smsEngagement: number;
  newsletterEngagement: number;
  surveyEngagement: number;
  pollEngagement: number;
  pushEngagement: number;
  totalEngagement: number;
  tier: 'highly-engaged' | 'active' | 'at-risk' | 'dormant';
}

interface AnalyticsData {
  overview: {
    totalSent: number;
    totalDelivered: number;
    totalEngaged: number;
    avgDeliveryRate: number;
    avgEngagementRate: number;
    totalCost: number;
  };
  channels: ChannelMetrics[];
  timeSeries: TimeSeriesData[];
  heatmap: EngagementHeatmap[];
  topMembers: MemberEngagement[];
  trends: {
    sentChange: number;
    deliveryChange: number;
    engagementChange: number;
  };
}

// =============================================
// CONSTANTS
// =============================================

const CHANNEL_COLORS = {
  sms: '#10b981', // green
  newsletter: '#3b82f6', // blue
  survey: '#f59e0b', // amber
  poll: '#8b5cf6', // violet
  push: '#ec4899', // pink
};

const CHANNEL_LABELS = {
  sms: 'SMS',
  newsletter: 'Newsletter',
  survey: 'Survey',
  poll: 'Poll',
  push: 'Push Notification',
};

const CHANNEL_ICONS = {
  sms: MessageSquare,
  newsletter: Mail,
  survey: BarChart3,
  poll: PieChartIcon,
  push: Bell,
};

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// =============================================
// COMPONENT
// =============================================

export default function UnifiedAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    'sms',
    'newsletter',
    'survey',
    'poll',
    'push',
  ]);

  // =============================================
  // DATA FETCHING
  // =============================================

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.append('startDate', format(startOfDay(customStartDate), 'yyyy-MM-dd'));
        params.append('endDate', format(endOfDay(customEndDate), 'yyyy-MM-dd'));
      } else {
        params.append('range', dateRange);
      }

      const response = await fetch(`/api/communications/analytics/unified?${params}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');

      const result = await response.json();
      setData(result);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // =============================================
  // COMPUTED DATA
  // =============================================

  const filteredTimeSeries = useMemo(() => {
    if (!data) return [];
    return data.timeSeries.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered: any = { date: item.date };
      selectedChannels.forEach((channel) => {
        filtered[channel] = item[channel as keyof TimeSeriesData];
      });
      return filtered;
    });
  }, [data, selectedChannels]);

  const channelDistribution = useMemo(() => {
    if (!data) return [];
    return data.channels.map((channel) => ({
      name: CHANNEL_LABELS[channel.channel],
      value: channel.totalSent,
      color: CHANNEL_COLORS[channel.channel],
    }));
  }, [data]);

  const engagementComparison = useMemo(() => {
    if (!data) return [];
    return data.channels.map((channel) => ({
      channel: CHANNEL_LABELS[channel.channel],
      deliveryRate: (channel.deliveryRate * 100).toFixed(1),
      engagementRate: (channel.engagementRate * 100).toFixed(1),
    }));
  }, [data]);

  // =============================================
  // HANDLERS
  // =============================================

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.append('startDate', format(startOfDay(customStartDate), 'yyyy-MM-dd'));
        params.append('endDate', format(endOfDay(customEndDate), 'yyyy-MM-dd'));
      } else {
        params.append('range', dateRange);
      }

      const response = await fetch(`/api/communications/analytics/unified/export?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unified-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (_error) {
}
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.append('startDate', format(startOfDay(customStartDate), 'yyyy-MM-dd'));
        params.append('endDate', format(endOfDay(customEndDate), 'yyyy-MM-dd'));
      } else {
        params.append('range', dateRange);
      }

      const response = await fetch(`/api/communications/analytics/unified/pdf?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unified-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (_error) {
}
  };

  // =============================================
  // LOADING STATE
  // =============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Communications Analytics</h2>
          <p className="text-muted-foreground">
            Unified insights across all communication channels
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Time Period:</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {customStartDate ? format(customStartDate, 'MMM dd, yyyy') : 'Start Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">to</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {customEndDate ? format(customEndDate, 'MMM dd, yyyy') : 'End Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Channel Filters */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium">Channels:</label>
              {Object.entries(CHANNEL_LABELS).map(([key, label]) => {
                const Icon = CHANNEL_ICONS[key as keyof typeof CHANNEL_ICONS];
                const isSelected = selectedChannels.includes(key);
                return (
                  <Button
                    key={key}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleChannel(key)}
                    className={cn(!isSelected && 'opacity-50')}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalSent.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {data.trends.sentChange > 0 ? (
                <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
              )}
              <span className={data.trends.sentChange > 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(data.trends.sentChange).toFixed(1)}%
              </span>
              <span className="ml-1">from previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalDelivered.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(data.overview.avgDeliveryRate * 100).toFixed(1)}% delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engaged</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalEngaged.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(data.overview.avgEngagementRate * 100).toFixed(1)}% engagement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.overview.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${(data.overview.totalCost / data.overview.totalSent).toFixed(4)} per message
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.trends.engagementChange > 0 ? '+' : ''}
              {data.trends.engagementChange.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">From previous period</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="channels">Channel Comparison</TabsTrigger>
          <TabsTrigger value="engagement">Engagement Heatmap</TabsTrigger>
          <TabsTrigger value="members">Top Members</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication Volume Over Time</CardTitle>
              <CardDescription>Messages sent across all channels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={filteredTimeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedChannels.map((channel) => (
                    <Area
                      key={channel}
                      type="monotone"
                      dataKey={channel}
                      stackId="1"
                      stroke={CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS]}
                      fill={CHANNEL_COLORS[channel as keyof typeof CHANNEL_COLORS]}
                      name={CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS]}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Comparison Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Channel Distribution</CardTitle>
                <CardDescription>Total messages sent by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={channelDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {channelDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Comparison</CardTitle>
                <CardDescription>Delivery and engagement rates by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={engagementComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="deliveryRate" fill="#10b981" name="Delivery Rate %" />
                    <Bar dataKey="engagementRate" fill="#3b82f6" name="Engagement Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Channel Details */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Metrics</CardTitle>
              <CardDescription>Detailed performance by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.channel];
                  return (
                    <div
                      key={channel.channel}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-full"
                          style={{ backgroundColor: `${CHANNEL_COLORS[channel.channel]}20` }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: CHANNEL_COLORS[channel.channel] }}
                          />
                        </div>
                        <div>
                          <h4 className="font-medium">{CHANNEL_LABELS[channel.channel]}</h4>
                          <p className="text-sm text-muted-foreground">
                            {channel.totalSent.toLocaleString()} sent
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground">Delivery Rate</p>
                          <p className="font-medium">{(channel.deliveryRate * 100).toFixed(1)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Engagement Rate</p>
                          <p className="font-medium">{(channel.engagementRate * 100).toFixed(1)}%</p>
                        </div>
                        {channel.cost !== undefined && (
                          <div className="text-right">
                            <p className="text-muted-foreground">Cost</p>
                            <p className="font-medium">${channel.cost.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Heatmap Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Heatmap</CardTitle>
              <CardDescription>Member engagement by day of week and hour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 text-left">Hour</th>
                      {DAYS_OF_WEEK.map((day) => (
                        <th key={day} className="border p-2 text-center">
                          {day.substring(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <tr key={hour}>
                        <td className="border p-2 font-medium text-sm">
                          {hour.toString().padStart(2, '0')}:00
                        </td>
                        {DAYS_OF_WEEK.map((day) => {
                          const cell = data.heatmap.find((h) => h.hour === hour && h.day === day);
                          const count = cell?.count || 0;
                          const maxCount = Math.max(...data.heatmap.map((h) => h.count));
                          const intensity = maxCount > 0 ? count / maxCount : 0;
                          const bgColor = `rgba(59, 130, 246, ${intensity})`;

                          return (
                            <td
                              key={day}
                              className="border p-2 text-center text-sm"
                              style={{ backgroundColor: bgColor }}
                              title={`${day} ${hour}:00 - ${count} engagements`}
                            >
                              {count > 0 ? count : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Engaged Members</CardTitle>
              <CardDescription>Top members by engagement across all channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topMembers.map((member, index) => (
                  <div key={member.memberId} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{member.memberName}</h4>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          member.tier === 'highly-engaged'
                            ? 'default'
                            : member.tier === 'active'
                            ? 'secondary'
                            : member.tier === 'at-risk'
                            ? 'outline'
                            : 'destructive'
                        }
                      >
                        {member.tier.replace('-', ' ')}
                      </Badge>
                      <div className="text-right">
                        <p className="font-bold text-lg">{member.totalEngagement}</p>
                        <p className="text-xs text-muted-foreground">interactions</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

