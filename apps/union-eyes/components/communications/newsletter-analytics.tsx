/**
 * Newsletter Analytics Dashboard Component
 * 
 * Track and visualize newsletter campaign performance:
 * - Delivery, open, click rates
 * - Bounce and unsubscribe tracking
 * - Link click analysis
 * - Geographic and device breakdown
 * - Engagement timeline
 * - Campaign comparison
 * 
 * Version: 1.0.0
 * Created: December 6, 2025
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  MousePointerClick,
  AlertTriangle,
  Eye,
  Link as LinkIcon,
  Download,
  Calendar,
  Globe,
  Smartphone,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/lib/hooks/use-toast';

interface CampaignStats {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  spamReportRate: number;
}

interface LinkClick {
  url: string;
  clicks: number;
  uniqueClicks: number;
}

interface GeographicData {
  country: string;
  opens: number;
  clicks: number;
}

interface DeviceData {
  deviceType: string;
  opens: number;
  percentage: number;
}

interface EngagementTimeline {
  hour: number;
  opens: number;
  clicks: number;
}

interface Campaign {
  id: string;
  name: string;
  sentAt: Date;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalUnsubscribed: number;
  totalSpamReports: number;
  stats: CampaignStats;
}

interface NewsletterAnalyticsProps {
  campaignId: string;
}

export function NewsletterAnalytics({ campaignId }: NewsletterAnalyticsProps) {
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [geographic, setGeographic] = useState<GeographicData[]>([]);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [timeline, setTimeline] = useState<EngagementTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('all');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/communications/campaigns/${campaignId}/analytics?range=${timeRange}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setCampaign(data.campaign);
      setLinkClicks(data.linkClicks || []);
      setGeographic(data.geographic || []);
      setDevices(data.devices || []);
      setTimeline(data.timeline || []);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [campaignId, timeRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = async () => {
    try {
      const response = await fetch(
        `/api/communications/campaigns/${campaignId}/analytics/export`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${campaignId}-analytics.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: 'Analytics report downloaded',
      });
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to export analytics',
        variant: 'destructive',
      });
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getPercentageColor = (value: number, metric: string) => {
    if (metric === 'delivery' || metric === 'open' || metric === 'click') {
      if (value >= 0.3) return 'text-green-600';
      if (value >= 0.15) return 'text-yellow-600';
      return 'text-red-600';
    }

    // For bounce, unsubscribe, spam (lower is better)
    if (value <= 0.02) return 'text-green-600';
    if (value <= 0.05) return 'text-yellow-600';
    return 'text-red-600';
  };

  const _getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else if (current < previous) {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-600">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{campaign.name}</h2>
          <p className="text-sm text-gray-600">
            Sent on {new Date(campaign.sentAt).toLocaleDateString()} to{' '}
            {campaign.totalSent} recipients
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <Mail className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getPercentageColor(
                campaign.stats.deliveryRate,
                'delivery'
              )}`}
            >
              {formatPercentage(campaign.stats.deliveryRate)}
            </div>
            <p className="text-xs text-gray-600">
              {campaign.totalDelivered} of {campaign.totalSent} delivered
            </p>
            <Progress
              value={campaign.stats.deliveryRate * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getPercentageColor(
                campaign.stats.openRate,
                'open'
              )}`}
            >
              {formatPercentage(campaign.stats.openRate)}
            </div>
            <p className="text-xs text-gray-600">
              {campaign.totalOpened} unique opens
            </p>
            <Progress value={campaign.stats.openRate * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointerClick className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getPercentageColor(
                campaign.stats.clickRate,
                'click'
              )}`}
            >
              {formatPercentage(campaign.stats.clickRate)}
            </div>
            <p className="text-xs text-gray-600">
              {campaign.totalClicked} unique clicks
            </p>
            <Progress value={campaign.stats.clickRate * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getPercentageColor(
                campaign.stats.bounceRate,
                'bounce'
              )}`}
            >
              {formatPercentage(campaign.stats.bounceRate)}
            </div>
            <p className="text-xs text-gray-600">
              {campaign.totalBounced} bounces
            </p>
            <Progress value={campaign.stats.bounceRate * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="links" className="w-full">
        <TabsList>
          <TabsTrigger value="links">
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Clicks
          </TabsTrigger>
          <TabsTrigger value="geographic">
            <Globe className="w-4 h-4 mr-2" />
            Geographic
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Smartphone className="w-4 h-4 mr-2" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Link Clicks Tab */}
        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle>Top Clicked Links</CardTitle>
              <CardDescription>
                Most popular links in your campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkClicks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead className="text-right">Total Clicks</TableHead>
                      <TableHead className="text-right">Unique Clicks</TableHead>
                      <TableHead className="text-right">Click Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkClicks.map((link, index) => (
                      <TableRow key={index}>
                        <TableCell className="max-w-md truncate">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {link.url}
                          </a>
                        </TableCell>
                        <TableCell className="text-right">{link.clicks}</TableCell>
                        <TableCell className="text-right">
                          {link.uniqueClicks}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercentage(
                            link.uniqueClicks / campaign.totalDelivered
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  No link clicks recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geographic Tab */}
        <TabsContent value="geographic">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
              <CardDescription>
                Where your recipients are opening and clicking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {geographic.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Opens</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Engagement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geographic.map((geo, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{geo.country}</TableCell>
                        <TableCell className="text-right">{geo.opens}</TableCell>
                        <TableCell className="text-right">{geo.clicks}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress
                              value={(geo.opens / campaign.totalOpened) * 100}
                              className="w-20"
                            />
                            <span className="text-sm">
                              {formatPercentage(geo.opens / campaign.totalOpened)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  No geographic data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
              <CardDescription>
                What devices recipients are using
              </CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length > 0 ? (
                <div className="space-y-4">
                  {devices.map((device, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-gray-600" />
                          <span className="font-medium capitalize">
                            {device.deviceType}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            {device.opens} opens
                          </span>
                          <Badge variant="secondary">
                            {formatPercentage(device.percentage)}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={device.percentage * 100} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  No device data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Timeline</CardTitle>
              <CardDescription>
                When recipients are opening and clicking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <div className="space-y-3">
                  {timeline.map((point, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-20 text-sm text-gray-600 font-medium">
                        {point.hour}:00
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-gray-600">
                            Opens: {point.opens}
                          </div>
                          <Progress
                            value={
                              (point.opens / Math.max(...timeline.map((t) => t.opens))) *
                              100
                            }
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-gray-600">
                            Clicks: {point.clicks}
                          </div>
                          <Progress
                            value={
                              (point.clicks /
                                Math.max(...timeline.map((t) => t.clicks))) *
                              100
                            }
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  No timeline data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Negative Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Unsubscribes</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{campaign.totalUnsubscribed}</Badge>
                <span className="text-sm text-gray-600">
                  {formatPercentage(campaign.stats.unsubscribeRate)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Spam Reports</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{campaign.totalSpamReports}</Badge>
                <span className="text-sm text-gray-600">
                  {formatPercentage(campaign.stats.spamReportRate)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bounces</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{campaign.totalBounced}</Badge>
                <span className="text-sm text-gray-600">
                  {formatPercentage(campaign.stats.bounceRate)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Campaign Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Sent</span>
              <Badge variant="secondary">{campaign.totalSent}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Delivered</span>
              <Badge variant="secondary">{campaign.totalDelivered}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Unique Opens</span>
              <Badge variant="secondary">{campaign.totalOpened}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Unique Clicks</span>
              <Badge variant="secondary">{campaign.totalClicked}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

