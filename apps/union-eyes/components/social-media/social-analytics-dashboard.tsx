// ================================================================
// SOCIAL MEDIA ANALYTICS DASHBOARD
// ================================================================
// Comprehensive analytics with charts, engagement metrics, follower growth,
// best posting times, audience demographics, and performance insights
// Created: December 7, 2025
// ================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  Download,
  AlertCircle,
} from 'lucide-react';

// ================================================================
// TYPES
// ================================================================

type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin';
type DateRange = '7d' | '30d' | '90d' | 'all';

interface PlatformMetrics {
  platform: SocialPlatform;
  followers: number;
  followerChange: number;
  engagement: number;
  engagementRate: number;
  reach: number;
  impressions: number;
  posts: number;
}

interface TopPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  publishedAt: Date;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  engagementRate: number;
}

interface AudienceDemographic {
  ageRange: string;
  percentage: number;
  gender?: {
    male: number;
    female: number;
    other: number;
  };
}

interface BestPostingTime {
  dayOfWeek: string;
  hour: number;
  engagementRate: number;
  postsCount: number;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

const getPlatformIcon = (platform: SocialPlatform) => {
  const icons = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin
  };
  return icons[platform];
};

const getPlatformColor = (platform: SocialPlatform): string => {
  const colors = {
    facebook: 'bg-blue-600',
    twitter: 'bg-sky-500',
    instagram: 'bg-linear-to-tr from-purple-600 via-pink-600 to-orange-500',
    linkedin: 'bg-blue-700'
  };
  return colors[platform];
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function SocialAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'all'>('all');
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [audienceDemographics, setAudienceDemographics] = useState<AudienceDemographic[]>([]);
  const [bestPostingTimes, setBestPostingTimes] = useState<BestPostingTime[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v2/social-media/analytics?range=${dateRange}`);
      if (res.ok) {
        const data = await res.json();
        if (data.platformMetrics ?? data.platform_metrics) setPlatformMetrics(data.platformMetrics ?? data.platform_metrics);
        if (data.topPosts ?? data.top_posts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTopPosts((data.topPosts ?? data.top_posts).map((p: any) => ({ ...p, publishedAt: new Date(p.publishedAt ?? p.published_at) })));
        }
        if (data.audienceDemographics ?? data.audience_demographics) setAudienceDemographics(data.audienceDemographics ?? data.audience_demographics);
        if (data.bestPostingTimes ?? data.best_posting_times) setBestPostingTimes(data.bestPostingTimes ?? data.best_posting_times);
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const filteredMetrics = selectedPlatform === 'all' 
    ? platformMetrics 
    : platformMetrics.filter(m => m.platform === selectedPlatform);

  const totalFollowers = platformMetrics.reduce((sum, m) => sum + m.followers, 0);
  const totalEngagement = platformMetrics.reduce((sum, m) => sum + m.engagement, 0);
  const totalReach = platformMetrics.reduce((sum, m) => sum + m.reach, 0);
  const avgEngagementRate = platformMetrics.length > 0 ? platformMetrics.reduce((sum, m) => sum + m.engagementRate, 0) / platformMetrics.length : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your social media performance across all platforms
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Followers</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalFollowers)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">
                +{formatNumber(platformMetrics.reduce((sum, m) => sum + m.followerChange, 0))} this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Engagement</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalEngagement)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">+12.3%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reach</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalReach)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">+8.7%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Engagement Rate</CardDescription>
            <CardTitle className="text-3xl">{avgEngagementRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={avgEngagementRate * 10} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Platform Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={selectedPlatform === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform('all')}
            >
              All Platforms
            </Button>
            {platformMetrics.map(metric => {
              const Icon = getPlatformIcon(metric.platform);
              return (
                <Button
                  key={metric.platform}
                  variant={selectedPlatform === metric.platform ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPlatform(metric.platform)}
                  className={selectedPlatform === metric.platform ? getPlatformColor(metric.platform) : ''}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {metric.platform.charAt(0).toUpperCase() + metric.platform.slice(1)}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Platform Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Performance</CardTitle>
                <CardDescription>Metrics by platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredMetrics.map(metric => {
                  const Icon = getPlatformIcon(metric.platform);
                  return (
                    <div key={metric.platform} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          <span className="font-medium capitalize">{metric.platform}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatNumber(metric.followers)}</div>
                          <div className="text-xs text-green-600">+{formatNumber(metric.followerChange)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Engagement</div>
                          <div className="font-medium">{formatNumber(metric.engagement)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Reach</div>
                          <div className="font-medium">{formatNumber(metric.reach)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Rate</div>
                          <div className="font-medium">{metric.engagementRate}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Posts</div>
                          <div className="font-medium">{metric.posts}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Follower Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Follower Growth</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredMetrics.map(metric => {
                    const Icon = getPlatformIcon(metric.platform);
                    const growthRate = (metric.followerChange / metric.followers) * 100;
                    return (
                      <div key={metric.platform}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm capitalize">{metric.platform}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">+{growthRate.toFixed(1)}%</span>
                          </div>
                        </div>
                        <Progress value={Math.min(growthRate * 10, 100)} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Engagement Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Breakdown</CardTitle>
                <CardDescription>Total interactions by type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span>Likes</span>
                    </div>
                    <span className="font-medium">15.2K</span>
                  </div>
                  <Progress value={75} className="bg-red-100" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-blue-500" />
                      <span>Comments</span>
                    </div>
                    <span className="font-medium">2.8K</span>
                  </div>
                  <Progress value={45} className="bg-blue-100" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-green-500" />
                      <span>Shares</span>
                    </div>
                    <span className="font-medium">1.5K</span>
                  </div>
                  <Progress value={30} className="bg-green-100" />
                </div>
              </CardContent>
            </Card>

            {/* Top Posts */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Posts</CardTitle>
                <CardDescription>Based on engagement rate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topPosts.slice(0, 3).map((post, index) => {
                  const Icon = getPlatformIcon(post.platform);
                  return (
                    <div key={post.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-3 w-3" />
                          <span className="text-xs text-muted-foreground capitalize">{post.platform}</span>
                        </div>
                        <p className="text-sm line-clamp-2 mb-2">{post.content}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatNumber(post.likes)} likes</span>
                          <span>{post.comments} comments</span>
                          <span className="text-green-600 font-medium">{post.engagementRate}% rate</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audience Tab */}
        <TabsContent value="audience" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Demographics */}
            <Card>
              <CardHeader>
                <CardTitle>Audience Demographics</CardTitle>
                <CardDescription>Age distribution of your followers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {audienceDemographics.map(demo => (
                  <div key={demo.ageRange}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{demo.ageRange}</span>
                      <span className="text-sm text-muted-foreground">{demo.percentage}%</span>
                    </div>
                    <Progress value={demo.percentage * 5} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
                <CardDescription>Breakdown by age group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {audienceDemographics.slice(1, 4).map(demo => (
                  <div key={demo.ageRange} className="space-y-2">
                    <div className="text-sm font-medium">{demo.ageRange}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground mb-1">Male</div>
                        <Progress value={demo.gender!.male} className="bg-blue-100" />
                        <div className="mt-1 font-medium">{demo.gender!.male}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Female</div>
                        <Progress value={demo.gender!.female} className="bg-pink-100" />
                        <div className="mt-1 font-medium">{demo.gender!.female}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Other</div>
                        <Progress value={demo.gender!.other * 10} className="bg-purple-100" />
                        <div className="mt-1 font-medium">{demo.gender!.other}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Performance</CardTitle>
              <CardDescription>All posts ranked by engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPosts.map((post, index) => {
                  const Icon = getPlatformIcon(post.platform);
                  return (
                    <div key={post.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium capitalize">{post.platform}</span>
                          <span className="text-xs text-muted-foreground">
                            {post.publishedAt.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm mb-3">{post.content}</p>
                        <div className="grid grid-cols-5 gap-4 text-xs">
                          <div>
                            <div className="text-muted-foreground mb-1">Likes</div>
                            <div className="font-medium">{formatNumber(post.likes)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Comments</div>
                            <div className="font-medium">{post.comments}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Shares</div>
                            <div className="font-medium">{post.shares}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Impressions</div>
                            <div className="font-medium">{formatNumber(post.impressions)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Engagement</div>
                            <div className="font-medium text-green-600">{post.engagementRate}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Best Posting Times */}
            <Card>
              <CardHeader>
                <CardTitle>Best Posting Times</CardTitle>
                <CardDescription>When your audience is most active</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bestPostingTimes.slice(0, 5).map((time, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{time.dayOfWeek} at {time.hour}:00</div>
                      <div className="text-xs text-muted-foreground">{time.postsCount} posts analyzed</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-600">{time.engagementRate}%</div>
                      <div className="text-xs text-muted-foreground">engagement</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>AI-powered insights to improve performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-green-50">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm text-green-900">Post more on Instagram</div>
                    <div className="text-xs text-green-700">Instagram has your highest engagement rate at 6.5%. Consider increasing posting frequency.</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-blue-50">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm text-blue-900">Optimize posting times</div>
                    <div className="text-xs text-blue-700">Friday at 17:00 shows 7.5% engagement. Schedule more content for this time slot.</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-yellow-50">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm text-yellow-900">Improve LinkedIn presence</div>
                    <div className="text-xs text-yellow-700">LinkedIn has the lowest engagement at 2.1%. Try more professional content and industry insights.</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-purple-50">
                  <Users className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm text-purple-900">Focus on 25-44 age group</div>
                    <div className="text-xs text-purple-700">60% of your audience is aged 25-44. Tailor content to this demographic for better results.</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

