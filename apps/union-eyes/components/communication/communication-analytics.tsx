/**
 * Communication Analytics Component
 * 
 * Communication metrics dashboard with:
 * - Delivery metrics (sent/delivered/opened/clicked)
 * - Engagement rates by channel
 * - Campaign comparison
 * - A/B testing results
 * - Bounce and unsubscribe tracking
 * - Visual charts and trends
 * 
 * @module components/communication/communication-analytics
 */

"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  MessageSquare,
  Bell,
  Eye,
  MousePointer,
  UserX,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CommunicationMetrics {
  period: string;
  email: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  sms: {
    sent: number;
    delivered: number;
    clicked: number;
    failed: number;
    optOuts: number;
  };
  push: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  inApp: {
    shown: number;
    viewed: number;
    clicked: number;
  };
}

interface Campaign {
  id: string;
  name: string;
  type: "email" | "sms" | "push" | "announcement";
  date: Date;
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
}

interface ABTest {
  id: string;
  name: string;
  type: "subject" | "content" | "timing" | "audience";
  variantA: {
    name: string;
    sent: number;
    opened: number;
    clicked: number;
    conversions: number;
  };
  variantB: {
    name: string;
    sent: number;
    opened: number;
    clicked: number;
    conversions: number;
  };
  winner?: "A" | "B";
  confidence: number;
}

export interface CommunicationAnalyticsProps {
  metrics: CommunicationMetrics;
  campaigns?: Campaign[];
  abTests?: ABTest[];
}

export function CommunicationAnalytics({
  metrics,
  campaigns = [],
  abTests = [],
}: CommunicationAnalyticsProps) {
  const [timePeriod, setTimePeriod] = React.useState<"7d" | "30d" | "90d">("30d");
  const [_selectedChannel, _setSelectedChannel] = React.useState<"all" | "email" | "sms" | "push">(
    "all"
  );

  // Calculate rates
  const emailMetrics = {
    deliveryRate: metrics.email.sent > 0 ? (metrics.email.delivered / metrics.email.sent) * 100 : 0,
    openRate: metrics.email.delivered > 0 ? (metrics.email.opened / metrics.email.delivered) * 100 : 0,
    clickRate: metrics.email.opened > 0 ? (metrics.email.clicked / metrics.email.opened) * 100 : 0,
    bounceRate: metrics.email.sent > 0 ? (metrics.email.bounced / metrics.email.sent) * 100 : 0,
    unsubscribeRate: metrics.email.delivered > 0 ? (metrics.email.unsubscribed / metrics.email.delivered) * 100 : 0,
  };

  const smsMetrics = {
    deliveryRate: metrics.sms.sent > 0 ? (metrics.sms.delivered / metrics.sms.sent) * 100 : 0,
    clickRate: metrics.sms.delivered > 0 ? (metrics.sms.clicked / metrics.sms.delivered) * 100 : 0,
    failureRate: metrics.sms.sent > 0 ? (metrics.sms.failed / metrics.sms.sent) * 100 : 0,
    optOutRate: metrics.sms.delivered > 0 ? (metrics.sms.optOuts / metrics.sms.delivered) * 100 : 0,
  };

  const pushMetrics = {
    deliveryRate: metrics.push.sent > 0 ? (metrics.push.delivered / metrics.push.sent) * 100 : 0,
    openRate: metrics.push.delivered > 0 ? (metrics.push.opened / metrics.push.delivered) * 100 : 0,
    clickRate: metrics.push.opened > 0 ? (metrics.push.clicked / metrics.push.opened) * 100 : 0,
  };

  const _inAppMetrics = {
    viewRate: metrics.inApp.shown > 0 ? (metrics.inApp.viewed / metrics.inApp.shown) * 100 : 0,
    clickRate: metrics.inApp.viewed > 0 ? (metrics.inApp.clicked / metrics.inApp.viewed) * 100 : 0,
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    change?: number,
    icon?: React.ReactNode,
    subtitle?: string
  ) => {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600">{title}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold">{value}</p>
                {change !== undefined && (
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      change >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {change >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {Math.abs(change)}%
                  </div>
                )}
              </div>
              {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            </div>
            {icon && <div className="text-gray-400">{icon}</div>}
          </div>
        </CardContent>
      </Card>
    );
  };

  const getCampaignEngagement = (campaign: Campaign) => {
    const openRate = campaign.delivered > 0 ? (campaign.opened / campaign.delivered) * 100 : 0;
    const clickRate = campaign.opened > 0 ? (campaign.clicked / campaign.opened) * 100 : 0;
    return { openRate, clickRate };
  };

  const renderABTestResult = (test: ABTest) => {
    const variantAOpenRate = test.variantA.sent > 0 ? (test.variantA.opened / test.variantA.sent) * 100 : 0;
    const variantBOpenRate = test.variantB.sent > 0 ? (test.variantB.opened / test.variantB.sent) * 100 : 0;
    const variantAClickRate = test.variantA.opened > 0 ? (test.variantA.clicked / test.variantA.opened) * 100 : 0;
    const variantBClickRate = test.variantB.opened > 0 ? (test.variantB.clicked / test.variantB.opened) * 100 : 0;

    return (
      <Card key={test.id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{test.name}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Testing: {test.type.charAt(0).toUpperCase() + test.type.slice(1)}
              </p>
            </div>
            {test.winner && (
              <Badge className="bg-green-100 text-green-800">
                Winner: Variant {test.winner} ({test.confidence}% confidence)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {/* Variant A */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Variant A: {test.variantA.name}</h4>
                {test.winner === "A" && <Badge className="bg-green-100 text-green-800">Winner</Badge>}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Open Rate</span>
                    <span className="font-medium">{variantAOpenRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={variantAOpenRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Click Rate</span>
                    <span className="font-medium">{variantAClickRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={variantAClickRate} className="h-2" />
                </div>
                <div className="text-sm text-gray-600">
                  {test.variantA.conversions} conversions / {test.variantA.sent.toLocaleString()} sent
                </div>
              </div>
            </div>

            {/* Variant B */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Variant B: {test.variantB.name}</h4>
                {test.winner === "B" && <Badge className="bg-green-100 text-green-800">Winner</Badge>}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Open Rate</span>
                    <span className="font-medium">{variantBOpenRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={variantBOpenRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Click Rate</span>
                    <span className="font-medium">{variantBClickRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={variantBClickRate} className="h-2" />
                </div>
                <div className="text-sm text-gray-600">
                  {test.variantB.conversions} conversions / {test.variantB.sent.toLocaleString()} sent
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Communication Analytics
          </h2>
          <p className="text-gray-600 mt-1">
            Track engagement and performance across all channels
          </p>
        </div>
        <div className="flex gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="abtests">A/B Tests</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {renderStatCard(
              "Total Sent",
              (metrics.email.sent + metrics.sms.sent + metrics.push.sent).toLocaleString(),
              12,
              <Mail className="h-8 w-8" />,
              "Across all channels"
            )}
            {renderStatCard(
              "Avg Open Rate",
              `${((emailMetrics.openRate + pushMetrics.openRate) / 2).toFixed(1)}%`,
              5.2,
              <Eye className="h-8 w-8" />
            )}
            {renderStatCard(
              "Avg Click Rate",
              `${((emailMetrics.clickRate + smsMetrics.clickRate + pushMetrics.clickRate) / 3).toFixed(1)}%`,
              -2.1,
              <MousePointer className="h-8 w-8" />
            )}
            {renderStatCard(
              "Unsubscribes",
              (metrics.email.unsubscribed + metrics.sms.optOuts).toLocaleString(),
              undefined,
              <UserX className="h-8 w-8" />,
              "0.8% of delivered"
            )}
          </div>

          {/* Channel Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Email */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold">Email</h4>
                    </div>
                    <Badge>{metrics.email.sent.toLocaleString()} sent</Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Delivery</div>
                      <div className="text-2xl font-bold">{emailMetrics.deliveryRate.toFixed(1)}%</div>
                      <Progress value={emailMetrics.deliveryRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Open</div>
                      <div className="text-2xl font-bold">{emailMetrics.openRate.toFixed(1)}%</div>
                      <Progress value={emailMetrics.openRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Click</div>
                      <div className="text-2xl font-bold">{emailMetrics.clickRate.toFixed(1)}%</div>
                      <Progress value={emailMetrics.clickRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Bounce</div>
                      <div className="text-2xl font-bold text-red-600">
                        {emailMetrics.bounceRate.toFixed(1)}%
                      </div>
                      <Progress value={emailMetrics.bounceRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Unsub</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {emailMetrics.unsubscribeRate.toFixed(1)}%
                      </div>
                      <Progress value={emailMetrics.unsubscribeRate} className="h-2 mt-2" />
                    </div>
                  </div>
                </div>

                {/* SMS */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold">SMS</h4>
                    </div>
                    <Badge>{metrics.sms.sent.toLocaleString()} sent</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Delivery</div>
                      <div className="text-2xl font-bold">{smsMetrics.deliveryRate.toFixed(1)}%</div>
                      <Progress value={smsMetrics.deliveryRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Click</div>
                      <div className="text-2xl font-bold">{smsMetrics.clickRate.toFixed(1)}%</div>
                      <Progress value={smsMetrics.clickRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Failed</div>
                      <div className="text-2xl font-bold text-red-600">
                        {smsMetrics.failureRate.toFixed(1)}%
                      </div>
                      <Progress value={smsMetrics.failureRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Opt-out</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {smsMetrics.optOutRate.toFixed(1)}%
                      </div>
                      <Progress value={smsMetrics.optOutRate} className="h-2 mt-2" />
                    </div>
                  </div>
                </div>

                {/* Push */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-purple-600" />
                      <h4 className="font-semibold">Push Notifications</h4>
                    </div>
                    <Badge>{metrics.push.sent.toLocaleString()} sent</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Delivery</div>
                      <div className="text-2xl font-bold">{pushMetrics.deliveryRate.toFixed(1)}%</div>
                      <Progress value={pushMetrics.deliveryRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Open</div>
                      <div className="text-2xl font-bold">{pushMetrics.openRate.toFixed(1)}%</div>
                      <Progress value={pushMetrics.openRate} className="h-2 mt-2" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Click</div>
                      <div className="text-2xl font-bold">{pushMetrics.clickRate.toFixed(1)}%</div>
                      <Progress value={pushMetrics.clickRate} className="h-2 mt-2" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {renderStatCard(
              "Total Sent",
              metrics.email.sent.toLocaleString(),
              undefined,
              <Mail className="h-8 w-8" />
            )}
            {renderStatCard("Open Rate", `${emailMetrics.openRate.toFixed(1)}%`, 3.2)}
            {renderStatCard("Click Rate", `${emailMetrics.clickRate.toFixed(1)}%`, -1.5)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Bounces
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.email.bounced.toLocaleString()}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {emailMetrics.bounceRate.toFixed(2)}% bounce rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-orange-500" />
                  Unsubscribes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.email.unsubscribed.toLocaleString()}</div>
                <p className="text-sm text-gray-600 mt-1">
                  {emailMetrics.unsubscribeRate.toFixed(2)}% unsubscribe rate
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {renderStatCard(
              "Total Sent",
              metrics.sms.sent.toLocaleString(),
              undefined,
              <MessageSquare className="h-8 w-8" />
            )}
            {renderStatCard("Delivery Rate", `${smsMetrics.deliveryRate.toFixed(1)}%`, 1.8)}
            {renderStatCard("Click Rate", `${smsMetrics.clickRate.toFixed(1)}%`, 5.3)}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No campaigns yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Open Rate</TableHead>
                      <TableHead>Click Rate</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => {
                      const { openRate, clickRate } = getCampaignEngagement(campaign);
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{campaign.type}</Badge>
                          </TableCell>
                          <TableCell>{campaign.recipients.toLocaleString()}</TableCell>
                          <TableCell>{openRate.toFixed(1)}%</TableCell>
                          <TableCell>{clickRate.toFixed(1)}%</TableCell>
                          <TableCell>{campaign.conversions}</TableCell>
                          <TableCell>{campaign.date.toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="abtests" className="space-y-6">
          {abTests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No A/B tests yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">{abTests.map(renderABTestResult)}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

