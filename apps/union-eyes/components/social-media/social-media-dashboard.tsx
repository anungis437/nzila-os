// ================================================================
// SOCIAL MEDIA DASHBOARD
// ================================================================
// Comprehensive social media management dashboard
// Features: Multi-platform post composer, campaign manager, analytics, scheduling
// Created: December 7, 2025
// ================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Calendar as CalendarIcon,
  Send,
  Image as ImageIcon,
  Video,
  Link as _LinkIcon,
  Hash,
  AtSign,
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Filter as _Filter,
  Search,
  Download,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';

// ================================================================
// TYPES
// ================================================================

type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok';
type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
type PostType = 'text' | 'image' | 'video' | 'link' | 'carousel';

interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName: string;
  profileImageUrl: string;
  status: 'active' | 'expired' | 'disconnected';
  followerCount: number;
  engagementRate: number;
  isPrimary: boolean;
}

interface SocialPost {
  id: string;
  accountId: string;
  platform: SocialPlatform;
  content: string;
  postType: PostType;
  mediaUrls: string[];
  hashtags: string[];
  status: PostStatus;
  scheduledFor?: Date;
  publishedAt?: Date;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  impressionsCount: number;
  engagementRate: number;
}

interface _Campaign {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  platforms: SocialPlatform[];
  startDate: Date;
  endDate?: Date;
  postsCount: number;
  totalReach: number;
  totalEngagement: number;
  goalEngagementRate: number;
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

const getPlatformIcon = (platform: SocialPlatform) => {
  const icons = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
    tiktok: Video
  };
  return icons[platform];
};

const getPlatformColor = (platform: SocialPlatform): string => {
  const colors = {
    facebook: 'bg-blue-600',
    twitter: 'bg-sky-500',
    instagram: 'bg-linear-to-tr from-purple-600 via-pink-600 to-orange-500',
    linkedin: 'bg-blue-700',
    youtube: 'bg-red-600',
    tiktok: 'bg-black'
  };
  return colors[platform];
};

const getStatusColor = (status: PostStatus): string => {
  const colors = {
    draft: 'bg-gray-500',
    scheduled: 'bg-blue-500',
    published: 'bg-green-500',
    failed: 'bg-red-500'
  };
  return colors[status];
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function SocialMediaDashboard() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [_newPostHashtags, _setNewPostHashtags] = useState<string[]>([]);
  const [newPostSchedule, setNewPostSchedule] = useState<Date>();
  const [selectedPostType, setSelectedPostType] = useState<PostType>('text');
  const [filterStatus, setFilterStatus] = useState<PostStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [accRes, postsRes] = await Promise.all([
        fetch('/api/v2/social-media/accounts'),
        fetch('/api/v2/social-media/posts'),
      ]);
      if (accRes.ok) {
        const data = await accRes.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        setAccounts(items);
        setSelectedAccounts(items.filter((a: SocialAccount) => a.status === 'active').map((a: SocialAccount) => a.id));
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPosts(items.map((p: any) => ({
          ...p,
          scheduledFor: p.scheduledFor ? new Date(p.scheduledFor) : undefined,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : undefined,
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeAccounts = accounts.filter(a => a.status === 'active');
  const totalFollowers = activeAccounts.reduce((sum, a) => sum + a.followerCount, 0);
  const avgEngagementRate = activeAccounts.length > 0 ? activeAccounts.reduce((sum, a) => sum + a.engagementRate, 0) / activeAccounts.length : 0;

  const filteredPosts = posts.filter(post => {
    if (filterStatus !== 'all' && post.status !== filterStatus) return false;
    if (searchQuery && !post.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Media Manager</h1>
          <p className="text-muted-foreground">
            Manage your social presence across all platforms
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Connect Account
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connected Accounts</CardDescription>
            <CardTitle className="text-3xl">{activeAccounts.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 mt-2">
              {activeAccounts.map(account => {
                const Icon = getPlatformIcon(account.platform);
                return (
                  <div
                    key={account.id}
                    className={`w-8 h-8 rounded-full ${getPlatformColor(account.platform)} flex items-center justify-center`}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Followers</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(totalFollowers)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">+2.4% this week</span>
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Posts This Month</CardDescription>
            <CardTitle className="text-3xl">47</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">12 scheduled</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compose">Compose Post</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Connected Accounts */}
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>Manage your social media connections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeAccounts.map(account => {
                  const Icon = getPlatformIcon(account.platform);
                  return (
                    <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${getPlatformColor(account.platform)} flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-medium">{account.displayName}</div>
                          <div className="text-sm text-muted-foreground">{account.username}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatNumber(account.followerCount)}</div>
                        <div className="text-sm text-muted-foreground">{account.engagementRate}% engagement</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest posts and engagement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {posts.slice(0, 3).map(post => {
                  const Icon = getPlatformIcon(post.platform);
                  return (
                    <div key={post.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Icon className="h-5 w-5 mt-1 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {post.likesCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {post.commentsCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="h-3 w-3" />
                            {post.sharesCount}
                          </span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(post.status)}>
                        {post.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compose Post Tab */}
        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Post</CardTitle>
              <CardDescription>Compose and schedule posts across multiple platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label>Select Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {activeAccounts.map(account => {
                    const Icon = getPlatformIcon(account.platform);
                    const isSelected = selectedAccounts.includes(account.id);
                    return (
                      <Button
                        key={account.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedAccounts(prev =>
                            isSelected
                              ? prev.filter(id => id !== account.id)
                              : [...prev, account.id]
                          );
                        }}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {account.platform.charAt(0).toUpperCase() + account.platform.slice(1)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Post Type */}
              <div className="space-y-2">
                <Label>Post Type</Label>
                <Select value={selectedPostType} onValueChange={(value) => setSelectedPostType(value as PostType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Only</SelectItem>
                    <SelectItem value="image">Image Post</SelectItem>
                    <SelectItem value="video">Video Post</SelectItem>
                    <SelectItem value="link">Link Post</SelectItem>
                    <SelectItem value="carousel">Carousel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label>Post Content</Label>
                <Textarea
                  placeholder="What&apos;s happening?"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{newPostContent.length} characters</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Add Media
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Hash className="h-4 w-4 mr-1" />
                      Add Hashtag
                    </Button>
                    <Button variant="ghost" size="sm">
                      <AtSign className="h-4 w-4 mr-1" />
                      Mention
                    </Button>
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-2">
                <Label>Schedule Post (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {newPostSchedule ? format(newPostSchedule, 'PPP p') : 'Post immediately'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newPostSchedule}
                      onSelect={setNewPostSchedule}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  {newPostSchedule ? 'Schedule Post' : 'Publish Now'}
                </Button>
                <Button variant="outline">
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search posts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as PostStatus | 'all')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Posts</SelectItem>
                    <SelectItem value="draft">Drafts</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts List */}
          <div className="space-y-4">
            {filteredPosts.map(post => {
              const Icon = getPlatformIcon(post.platform);
              const statusIcons = {
                draft: Clock,
                scheduled: Clock,
                published: CheckCircle2,
                failed: XCircle
              };
              const StatusIcon = statusIcons[post.status];

              return (
                <Card key={post.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full ${getPlatformColor(post.platform)} flex items-center justify-center shrink-0`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm">{post.content}</p>
                          <Badge className={getStatusColor(post.status)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {post.status}
                          </Badge>
                        </div>
                        
                        {post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {post.hashtags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {post.status === 'published' && (
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              {formatNumber(post.likesCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" />
                              {formatNumber(post.commentsCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="h-4 w-4" />
                              {formatNumber(post.sharesCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {formatNumber(post.impressionsCount)}
                            </span>
                            <span className="ml-auto">
                              {post.engagementRate}% engagement
                            </span>
                          </div>
                        )}
                        
                        {post.status === 'scheduled' && post.scheduledFor && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Scheduled for {format(post.scheduledFor, 'PPP p')}
                          </div>
                        )}
                        
                        {post.status === 'published' && post.publishedAt && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            Published {format(post.publishedAt, 'PPP p')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        {post.status === 'scheduled' && (
                          <Button variant="ghost" size="sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campaigns</CardTitle>
                  <CardDescription>Manage multi-post campaigns</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No campaigns yet. Create your first campaign to get started.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Reach (7 days)</CardDescription>
                <CardTitle className="text-3xl">45.2K</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">+12.5%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Engagement</CardDescription>
                <CardTitle className="text-3xl">2,847</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">+8.3%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Click-Through Rate</CardDescription>
                <CardTitle className="text-3xl">3.8%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={38} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance by Platform</CardTitle>
              <CardDescription>Engagement metrics across all platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeAccounts.map(account => {
                  const Icon = getPlatformIcon(account.platform);
                  return (
                    <div key={account.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{account.platform}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {account.engagementRate}% engagement
                        </span>
                      </div>
                      <Progress value={account.engagementRate * 10} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

