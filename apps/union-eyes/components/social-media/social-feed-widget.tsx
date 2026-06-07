// ================================================================
// SOCIAL MEDIA FEED WIDGET
// ================================================================
// Unified social media feed widget for member portal
// Displays aggregated posts from all connected accounts with engagement
// Created: December 7, 2025
// ================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  ExternalLink,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ================================================================
// TYPES
// ================================================================

type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin';
type FeedItemType = 'post' | 'story' | 'video' | 'photo';

interface FeedItem {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  accountUsername: string;
  accountAvatar: string;
  itemType: FeedItemType;
  content: string;
  mediaUrls: string[];
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount?: number;
  publishedAt: Date;
  platformUrl: string;
  hashtags: string[];
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
    facebook: 'text-blue-600',
    twitter: 'text-sky-500',
    instagram: 'text-pink-600',
    linkedin: 'text-blue-700'
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

export default function SocialFeedWidget() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<SocialPlatform | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleItems, setVisibleItems] = useState(3);
  const [_loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v2/social-media/feed');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFeedItems(items.map((item: any) => ({
          ...item,
          publishedAt: new Date(item.publishedAt ?? item.published_at),
          mediaUrls: item.mediaUrls ?? item.media_urls ?? [],
          hashtags: item.hashtags ?? [],
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const filteredItems = filterPlatform === 'all'
    ? feedItems
    : feedItems.filter(item => item.platform === filterPlatform);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFeed();
    setIsRefreshing(false);
  };

  const loadMore = () => {
    setVisibleItems(prev => Math.min(prev + 3, filteredItems.length));
  };

  const displayedItems = filteredItems.slice(0, visibleItems);
  const hasMore = visibleItems < filteredItems.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Social Media Feed</CardTitle>
            <CardDescription>Latest posts from our social channels</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={filterPlatform} onValueChange={(value) => setFilterPlatform(value as SocialPlatform | 'all')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {displayedItems.map((item) => {
          const PlatformIcon = getPlatformIcon(item.platform);
          const platformColor = getPlatformColor(item.platform);
          
          return (
            <div key={item.id} className="pb-6 border-b last:border-0 last:pb-0">
              {/* Post Header */}
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={item.accountAvatar} alt={item.accountName} />
                  <AvatarFallback>{item.accountName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.accountName}</span>
                    <PlatformIcon className={`h-4 w-4 ${platformColor}`} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>@{item.accountUsername}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(item.publishedAt, { addSuffix: true })}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" asChild>
                  <a href={item.platformUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* Post Content */}
              <div className="mb-3">
                <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
              </div>

              {/* Post Media */}
              {item.mediaUrls.length > 0 && (
                <div className="mb-3">
                  {item.itemType === 'video' ? (
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                      <video
                        src={item.mediaUrls[0]}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                  ) : item.mediaUrls.length === 1 ? (
                    <div className="rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.mediaUrls[0]}
                        alt="Post media"
                        className="w-full object-cover max-h-96"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
                      {item.mediaUrls.slice(0, 4).map((url, index) => (
                        <div key={index} className="relative aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Post media ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {index === 3 && item.mediaUrls.length > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="text-white font-medium text-xl">
                                +{item.mediaUrls.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Hashtags */}
              {item.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.hashtags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Engagement Stats */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <button className="flex items-center gap-1 hover:text-red-600 transition-colors">
                  <Heart className="h-4 w-4" />
                  <span>{formatNumber(item.likesCount)}</span>
                </button>
                <button className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  <span>{formatNumber(item.commentsCount)}</span>
                </button>
                <button className="flex items-center gap-1 hover:text-green-600 transition-colors">
                  <Share2 className="h-4 w-4" />
                  <span>{formatNumber(item.sharesCount)}</span>
                </button>
                {item.viewsCount && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{formatNumber(item.viewsCount)}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Load More Button */}
        {hasMore && (
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={loadMore}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              Load More Posts
            </Button>
          </div>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No posts to display</p>
            <p className="text-sm">Check back later for updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ================================================================
// COMPACT WIDGET VARIANT
// ================================================================
// Smaller version for sidebars and dashboards

export function SocialFeedCompact() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/social-media/feed?limit=3');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFeedItems(items.map((item: any) => ({
          ...item,
          publishedAt: new Date(item.publishedAt ?? item.published_at),
          mediaUrls: item.mediaUrls ?? item.media_urls ?? [],
          hashtags: item.hashtags ?? [],
        })));
      }
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    fetchFeed();
  }, [fetchFeed]);

  const recentPosts = feedItems.slice(0, 3);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Latest Updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentPosts.map((item) => {
          const PlatformIcon = getPlatformIcon(item.platform);
          const platformColor = getPlatformColor(item.platform);
          
          return (
            <div key={item.id} className="flex items-start gap-3">
              <PlatformIcon className={`h-4 w-4 mt-1 ${platformColor} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2 mb-1">{item.content}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {formatNumber(item.likesCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {formatNumber(item.commentsCount)}
                  </span>
                  <span>{formatDistanceToNow(item.publishedAt, { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="w-full">
          View All Posts
        </Button>
      </CardContent>
    </Card>
  );
}

