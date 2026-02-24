// ================================================================
// SOCIAL MEDIA FEED WIDGET
// ================================================================
// Unified social media feed widget for member portal
// Displays aggregated posts from all connected accounts with engagement
// Created: December 7, 2025
// ================================================================

'use client';

import React, { useState } from 'react';
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
// SAMPLE DATA
// ================================================================

const sampleFeedItems: FeedItem[] = [
  {
    id: '1',
    platform: 'facebook',
    accountName: 'Local 123 UFCW',
    accountUsername: 'local123union',
    accountAvatar: '/avatars/union-logo.png',
    itemType: 'post',
    content: '🎉 VICTORY! Our members voted 95% YES on the new contract!\n\nAfter months of hard negotiations, we\'ve secured:\n✅ 15% wage increase over 3 years\n✅ Full healthcare coverage with no premium increases\n✅ Strong job security protections\n✅ Enhanced retirement benefits\n\nThis is what solidarity looks like. When workers stand together, we win. 💪\n\n#UnionStrong #Local123 #ContractWin',
    mediaUrls: ['/posts/victory-rally.jpg'],
    likesCount: 892,
    commentsCount: 156,
    sharesCount: 234,
    viewsCount: 12500,
    publishedAt: new Date(Date.now() - 3600000 * 4),
    platformUrl: 'https://facebook.com/local123union/posts/123456',
    hashtags: ['UnionStrong', 'Local123', 'ContractWin']
  },
  {
    id: '2',
    platform: 'instagram',
    accountName: 'Local 123 UFCW',
    accountUsername: 'local123union',
    accountAvatar: '/avatars/union-logo.png',
    itemType: 'photo',
    content: 'Meet Sarah, shop steward and 12-year member. 💪\n\n"This union changed my life. I went from barely making ends meet to owning my home and sending my kids to college. Every member should know they have that same opportunity."\n\nWant to share your union story? Drop a comment below! 👇\n\n#MemberSpotlight #UnionPower #WorkersRights',
    mediaUrls: ['/posts/sarah-steward.jpg'],
    likesCount: 1245,
    commentsCount: 67,
    sharesCount: 89,
    publishedAt: new Date(Date.now() - 3600000 * 8),
    platformUrl: 'https://instagram.com/p/ABC123',
    hashtags: ['MemberSpotlight', 'UnionPower', 'WorkersRights']
  },
  {
    id: '3',
    platform: 'twitter',
    accountName: 'Local 123',
    accountUsername: '@local123',
    accountAvatar: '/avatars/union-logo.png',
    itemType: 'post',
    content: '🚨 BREAKING: New contract ratified!\n\n95% YES vote from our members. Better wages, stronger benefits, job security for all.\n\nThis is the power of organized labor. This is what we fight for.\n\n#1u #UnionStrong #WorkersWin',
    mediaUrls: [],
    likesCount: 678,
    commentsCount: 123,
    sharesCount: 345,
    viewsCount: 15200,
    publishedAt: new Date(Date.now() - 3600000 * 5),
    platformUrl: 'https://twitter.com/local123/status/123456',
    hashtags: ['1u', 'UnionStrong', 'WorkersWin']
  },
  {
    id: '4',
    platform: 'linkedin',
    accountName: 'Local 123 UFCW',
    accountUsername: 'local-123-ufcw',
    accountAvatar: '/avatars/union-logo.png',
    itemType: 'post',
    content: 'Proud to announce the successful ratification of our new collective bargaining agreement.\n\nKey achievements:\n• 15% wage increase ensuring fair compensation\n• Comprehensive healthcare benefits with zero premium increases\n• Strengthened job security provisions\n• Enhanced retirement and pension benefits\n\nThis contract demonstrates the tangible value of collective bargaining and worker solidarity in achieving meaningful workplace improvements.\n\n#LaborRelations #CollectiveBargaining #WorkplaceRights',
    mediaUrls: [],
    likesCount: 234,
    commentsCount: 45,
    sharesCount: 78,
    publishedAt: new Date(Date.now() - 3600000 * 6),
    platformUrl: 'https://linkedin.com/posts/local-123-ufcw_123456',
    hashtags: ['LaborRelations', 'CollectiveBargaining', 'WorkplaceRights']
  },
  {
    id: '5',
    platform: 'facebook',
    accountName: 'Local 123 UFCW',
    accountUsername: 'local123union',
    accountAvatar: '/avatars/union-logo.png',
    itemType: 'video',
    content: '📹 Watch: Member testimonials from our contract victory celebration!\n\nHear directly from the members who fought for and won this historic contract. Their stories remind us why we organize.\n\n"We showed the company that united workers cannot be defeated." - Mike, 8-year member\n\n#UnionVoices #MemberStories',
    mediaUrls: ['/posts/testimonials-video.mp4'],
    likesCount: 567,
    commentsCount: 89,
    sharesCount: 156,
    viewsCount: 8900,
    publishedAt: new Date(Date.now() - 3600000 * 12),
    platformUrl: 'https://facebook.com/local123union/videos/789012',
    hashtags: ['UnionVoices', 'MemberStories']
  },
  {
    id: '6',
    platform: 'instagram',
    accountName: 'Local 123 UFCW',
    accountUsername: 'local123union',
    accountAvatar: '/avatars/union-logo.png',
    itemType: 'photo',
    content: 'Solidarity in action! 🤝\n\nOur members showed up in force at today\'s membership meeting. When we stand together, we\'re unstoppable.\n\nNext meeting: February 15th, 6 PM at the union hall. See you there!\n\n#Solidarity #UnionMeeting #StrongerTogether',
    mediaUrls: ['/posts/membership-meeting.jpg'],
    likesCount: 789,
    commentsCount: 45,
    sharesCount: 67,
    publishedAt: new Date(Date.now() - 3600000 * 18),
    platformUrl: 'https://instagram.com/p/DEF456',
    hashtags: ['Solidarity', 'UnionMeeting', 'StrongerTogether']
  }
];

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
  const [filterPlatform, setFilterPlatform] = useState<SocialPlatform | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleItems, setVisibleItems] = useState(3);

  const filteredItems = filterPlatform === 'all'
    ? sampleFeedItems
    : sampleFeedItems.filter(item => item.platform === filterPlatform);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
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
  const recentPosts = sampleFeedItems.slice(0, 3);

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

