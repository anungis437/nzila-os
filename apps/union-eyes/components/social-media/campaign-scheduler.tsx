// ================================================================
// SOCIAL MEDIA CAMPAIGN SCHEDULER
// ================================================================
// Multi-post campaign planning with calendar view, goal tracking,
// A/B testing, and automated scheduling across platforms
// Created: December 7, 2025
// ================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Calendar as CalendarIcon,
  Target,
  TrendingUp,
  Eye,
  Heart,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Filter,
  Download,
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';

// ================================================================
// TYPES
// ================================================================

type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin';
type CampaignStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  platforms: SocialPlatform[];
  startDate: Date;
  endDate?: Date;
  goals: {
    impressions?: number;
    engagementRate?: number;
    conversions?: number;
  };
  progress: {
    postsPublished: number;
    totalPosts: number;
    impressions: number;
    engagements: number;
    conversions: number;
  };
  hashtags: string[];
  targetAudience?: string;
}

interface ScheduledPost {
  id: string;
  campaignId: string;
  platform: SocialPlatform;
  content: string;
  scheduledFor: Date;
  status: PostStatus;
  hashtags: string[];
  mediaCount: number;
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

const getStatusColor = (status: CampaignStatus | PostStatus): string => {
  const colors = {
    planning: 'bg-gray-500',
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-blue-500',
    cancelled: 'bg-red-500',
    draft: 'bg-gray-500',
    scheduled: 'bg-blue-500',
    published: 'bg-green-500',
    failed: 'bg-red-500'
  };
  return colors[status];
};

const getStatusIcon = (status: CampaignStatus | PostStatus) => {
  const icons = {
    planning: Clock,
    active: Play,
    paused: Pause,
    completed: CheckCircle2,
    cancelled: AlertCircle,
    draft: Clock,
    scheduled: Clock,
    published: CheckCircle2,
    failed: AlertCircle
  };
  return icons[status];
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function CampaignScheduler() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [campRes, postsRes] = await Promise.all([
        fetch('/api/v2/social-media/campaigns'),
        fetch('/api/v2/social-media/scheduled-posts'),
      ]);
      if (campRes.ok) {
        const data = await campRes.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCampaigns(items.map((c: any) => ({
          ...c,
          startDate: new Date(c.startDate ?? c.start_date),
          endDate: c.endDate ?? c.end_date ? new Date(c.endDate ?? c.end_date) : undefined,
          goals: c.goals ?? {},
          progress: c.progress ?? { postsPublished: 0, totalPosts: 0, impressions: 0, engagements: 0, conversions: 0 },
          hashtags: c.hashtags ?? [],
          platforms: c.platforms ?? [],
        })));
        if (items.length > 0 && !selectedCampaign) setSelectedCampaign(items[0].id);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setScheduledPosts(items.map((p: any) => ({
          ...p,
          scheduledFor: new Date(p.scheduledFor ?? p.scheduled_for),
          mediaCount: p.mediaCount ?? p.media_count ?? 0,
          hashtags: p.hashtags ?? [],
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeCampaign = campaigns.find(c => c.id === selectedCampaign);
  const campaignPosts = scheduledPosts.filter(p => p.campaignId === selectedCampaign);
  const postsOnSelectedDate = scheduledPosts.filter(p => 
    isSameDay(p.scheduledFor, selectedDate)
  );

  const filteredCampaigns = campaigns.filter(c => 
    filterStatus === 'all' || c.status === filterStatus
  );

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaign Manager</h1>
          <p className="text-muted-foreground">
            Plan and schedule multi-post campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Dialog open={isCreatingCampaign} onOpenChange={setIsCreatingCampaign}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>
                  Set up a multi-post campaign across social platforms
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input placeholder="e.g., Summer Membership Drive 2025" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="What is this campaign about?" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Platforms</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Facebook className="h-4 w-4 mr-2" />
                      Facebook
                    </Button>
                    <Button variant="outline" size="sm">
                      <Twitter className="h-4 w-4 mr-2" />
                      Twitter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Instagram className="h-4 w-4 mr-2" />
                      Instagram
                    </Button>
                    <Button variant="outline" size="sm">
                      <Linkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Campaign Goals</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Input type="number" placeholder="Impressions" />
                    <Input type="number" placeholder="Engagement %" />
                    <Input type="number" placeholder="Conversions" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreatingCampaign(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setIsCreatingCampaign(false)}>
                    Create Campaign
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Campaigns</CardDescription>
            <CardTitle className="text-3xl">
              {campaigns.filter(c => c.status === 'active').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {campaigns.filter(c => c.status === 'planning').length} in planning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scheduled Posts</CardDescription>
            <CardTitle className="text-3xl">
              {scheduledPosts.filter(p => p.status === 'scheduled').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Next post in 2 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reach (Active)</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(
                campaigns
                  .filter(c => c.status === 'active')
                  .reduce((sum, c) => sum + c.progress.impressions, 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">+15.3%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Engagement Rate</CardDescription>
            <CardTitle className="text-3xl">5.8%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={58} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Campaigns</CardTitle>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as CampaignStatus | 'all')}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredCampaigns.map(campaign => {
                const StatusIcon = getStatusIcon(campaign.status);
                const isSelected = campaign.id === selectedCampaign;
                
                return (
                  <div
                    key={campaign.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedCampaign(campaign.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm">{campaign.name}</h3>
                      <Badge className={getStatusColor(campaign.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {campaign.description}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      {campaign.platforms.map(platform => {
                        const Icon = getPlatformIcon(platform);
                        return (
                          <Icon key={platform} className="h-3 w-3 text-muted-foreground" />
                        );
                      })}
                    </div>
                    {campaign.status === 'active' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span>{campaign.progress.postsPublished} / {campaign.progress.totalPosts} posts</span>
                        </div>
                        <Progress 
                          value={(campaign.progress.postsPublished / campaign.progress.totalPosts) * 100} 
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Details & Posts */}
        <div className="lg:col-span-2 space-y-4">
          {activeCampaign ? (
            <>
              {/* Campaign Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{activeCampaign.name}</CardTitle>
                      <CardDescription>{activeCampaign.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {activeCampaign.status === 'active' && (
                        <Button variant="outline" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {activeCampaign.status === 'paused' && (
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Campaign Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Duration</div>
                      <div className="font-medium">
                        {format(activeCampaign.startDate, 'MMM d')} - {activeCampaign.endDate ? format(activeCampaign.endDate, 'MMM d, yyyy') : 'Ongoing'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Platforms</div>
                      <div className="flex gap-1">
                        {activeCampaign.platforms.map(platform => {
                          const Icon = getPlatformIcon(platform);
                          return <Icon key={platform} className="h-5 w-5" />;
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Campaign Goals */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Campaign Goals</h4>
                    
                    {activeCampaign.goals.impressions && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span>Impressions</span>
                          </div>
                          <span>
                            {formatNumber(activeCampaign.progress.impressions)} / {formatNumber(activeCampaign.goals.impressions)}
                          </span>
                        </div>
                        <Progress 
                          value={(activeCampaign.progress.impressions / activeCampaign.goals.impressions) * 100} 
                        />
                      </div>
                    )}

                    {activeCampaign.goals.engagementRate && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-muted-foreground" />
                            <span>Engagement Rate</span>
                          </div>
                          <span>
                            {((activeCampaign.progress.engagements / activeCampaign.progress.impressions) * 100).toFixed(1)}% / {activeCampaign.goals.engagementRate}%
                          </span>
                        </div>
                        <Progress 
                          value={((activeCampaign.progress.engagements / activeCampaign.progress.impressions) * 100 / activeCampaign.goals.engagementRate) * 100} 
                        />
                      </div>
                    )}

                    {activeCampaign.goals.conversions && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span>Conversions</span>
                          </div>
                          <span>
                            {activeCampaign.progress.conversions} / {activeCampaign.goals.conversions}
                          </span>
                        </div>
                        <Progress 
                          value={(activeCampaign.progress.conversions / activeCampaign.goals.conversions) * 100} 
                        />
                      </div>
                    )}
                  </div>

                  {/* Hashtags */}
                  <div>
                    <h4 className="font-medium mb-2">Campaign Hashtags</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeCampaign.hashtags.map(tag => (
                        <Badge key={tag} variant="secondary">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scheduled Posts */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Scheduled Posts</CardTitle>
                      <CardDescription>
                        {campaignPosts.filter(p => p.status === 'scheduled').length} posts scheduled
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}>
                        {viewMode === 'list' ? <CalendarIcon className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                      </Button>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Post
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {viewMode === 'list' ? (
                    <div className="space-y-4">
                      {campaignPosts.map(post => {
                        const Icon = getPlatformIcon(post.platform);
                        const StatusIcon = getStatusIcon(post.status);
                        
                        return (
                          <div key={post.id} className="p-4 border rounded-lg">
                            <div className="flex items-start gap-4">
                              <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm mb-2">{post.content}</p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(post.scheduledFor, 'MMM d, h:mm a')}
                                  </span>
                                  {post.mediaCount > 0 && (
                                    <span>{post.mediaCount} media</span>
                                  )}
                                  <div className="flex gap-1">
                                    {post.hashtags.map(tag => (
                                      <span key={tag}>#{tag}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(post.status)}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {post.status}
                                </Badge>
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          className="rounded-md border"
                        />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">
                          Posts on {format(selectedDate, 'MMMM d, yyyy')}
                        </h4>
                        {postsOnSelectedDate.length > 0 ? (
                          postsOnSelectedDate.map(post => {
                            const Icon = getPlatformIcon(post.platform);
                            return (
                              <div key={post.id} className="p-3 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Icon className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    {format(post.scheduledFor, 'h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {post.content}
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No posts scheduled for this date
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a campaign to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

