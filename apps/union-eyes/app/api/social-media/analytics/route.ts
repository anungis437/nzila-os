import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Analytics API Routes - Phase 10
 * 
 * Endpoints for retrieving analytics data and generating reports.
 * Supports account analytics, post performance, campaign metrics, and exports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import { db } from '@/db';
import { socialAnalytics, socialPosts, socialAccounts, socialCampaigns } from '@/db/schema/social-media-schema';
import { eq, and, gte, lte, asc, desc, count, SQL } from 'drizzle-orm';
import { z } from "zod";
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-analytics-read:${userId}`,
        RATE_LIMITS.SOCIAL_MEDIA_API
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      // Parse query parameters
      const searchParams = request.nextUrl.searchParams;
      const platform = searchParams.get('platform');
      const startDate = searchParams.get('start_date') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate = searchParams.get('end_date') || format(new Date(), 'yyyy-MM-dd');
      const accountId = searchParams.get('account_id');

      // Build query with Drizzle
      const analyticsConditions: SQL[] = [
        eq(socialAccounts.organizationId, organizationId),
        gte(socialAnalytics.analyticsDate, startDate),
        lte(socialAnalytics.analyticsDate, endDate),
      ];

      if (platform) {
        analyticsConditions.push(eq(socialAccounts.platform, platform as typeof socialAccounts.platform._.data));
      }

      if (accountId) {
        analyticsConditions.push(eq(socialAnalytics.accountId, accountId));
      }

      const analytics = await db
        .select({
          id: socialAnalytics.id,
          accountId: socialAnalytics.accountId,
          analyticsDate: socialAnalytics.analyticsDate,
          totalImpressions: socialAnalytics.totalImpressions,
          totalReach: socialAnalytics.totalReach,
          totalLikes: socialAnalytics.totalLikes,
          totalComments: socialAnalytics.totalComments,
          totalShares: socialAnalytics.totalShares,
          totalEngagements: socialAnalytics.totalEngagements,
          linkClicks: socialAnalytics.linkClicks,
          engagementRate: socialAnalytics.engagementRate,
          accountPlatform: socialAccounts.platform,
          accountUsername: socialAccounts.username,
          accountDisplayName: socialAccounts.displayName,
          accountProfileImageUrl: socialAccounts.profileImageUrl,
        })
        .from(socialAnalytics)
        .leftJoin(socialAccounts, eq(socialAnalytics.accountId, socialAccounts.id))
        .where(and(...analyticsConditions))
        .orderBy(asc(socialAnalytics.analyticsDate));

      // Group analytics by account
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountAnalytics = analytics.reduce((acc: Record<string, any>, record) => {
        const acctId = record.accountId;
        if (!acc[acctId]) {
          acc[acctId] = {
            account: {
              id: record.accountId,
              platform: record.accountPlatform,
              username: record.accountUsername,
              displayName: record.accountDisplayName,
              profileImageUrl: record.accountProfileImageUrl,
            },
            analytics: [],
            summary: {
              total_impressions: 0,
              total_reach: 0,
              total_engagement: 0,
              total_likes: 0,
              total_comments: 0,
              total_shares: 0,
              total_clicks: 0,
              avg_engagement_rate: 0,
            },
          };
        }
        acc[acctId].analytics.push(record);
        
        // Update summary
        acc[acctId].summary.total_impressions += record.totalImpressions || 0;
        acc[acctId].summary.total_reach += record.totalReach || 0;
        acc[acctId].summary.total_engagement += record.totalEngagements || 0;
        acc[acctId].summary.total_likes += record.totalLikes || 0;
        acc[acctId].summary.total_comments += record.totalComments || 0;
        acc[acctId].summary.total_shares += record.totalShares || 0;
        acc[acctId].summary.total_clicks += record.linkClicks || 0;
        
        return acc;
      }, {});

      // Calculate average engagement rate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(accountAnalytics).forEach((account: any) => {
        const analyticsCount = account.analytics.length;
        if (analyticsCount > 0) {
          const totalEngagementRate = account.analytics.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, a: any) => sum + (Number(a.engagementRate) || 0),
            0
          );
          account.summary.avg_engagement_rate = totalEngagementRate / analyticsCount;
        }
      });

      return NextResponse.json({
        accounts: Object.values(accountAnalytics),
        date_range: {
          start_date: startDate,
          end_date: endDate,
        },
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
});


const socialMediaAnalyticsSchema = z.object({
  platform: z.unknown().optional(),
  campaign_id: z.string().uuid('Invalid campaign_id'),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-analytics-refresh:${userId}`,
        RATE_LIMITS.SOCIAL_MEDIA_API
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      const body = await request.json();
    // Validate request body
    const validation = socialMediaAnalyticsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { platform, campaign_id, start_date, end_date, limit = 50, offset = 0 } = validation.data;

      const startDateStr = start_date || format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDateStr = end_date || format(new Date(), 'yyyy-MM-dd');

      // Build query with Drizzle
      const postConditions: SQL[] = [
        eq(socialAccounts.organizationId, organizationId),
        eq(socialPosts.status, 'published'),
        gte(socialPosts.publishedAt, new Date(startDateStr)),
        lte(socialPosts.publishedAt, new Date(endDateStr)),
      ];

      if (platform) {
        postConditions.push(eq(socialAccounts.platform, platform as typeof socialAccounts.platform._.data));
      }

      if (campaign_id) {
        postConditions.push(eq(socialPosts.campaignId, campaign_id));
      }

      const [{ total: postTotal }] = await db
        .select({ total: count() })
        .from(socialPosts)
        .leftJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
        .where(and(...postConditions));

      const posts = await db
        .select({
          id: socialPosts.id,
          content: socialPosts.content,
          mediaUrls: socialPosts.mediaUrls,
          publishedAt: socialPosts.publishedAt,
          impressionsCount: socialPosts.impressionsCount,
          reachCount: socialPosts.reachCount,
          likesCount: socialPosts.likesCount,
          commentsCount: socialPosts.commentsCount,
          sharesCount: socialPosts.sharesCount,
          engagementRate: socialPosts.engagementRate,
          accountPlatform: socialAccounts.platform,
          accountUsername: socialAccounts.username,
        })
        .from(socialPosts)
        .leftJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
        .where(and(...postConditions))
        .orderBy(desc(socialPosts.impressionsCount))
        .limit(limit)
        .offset(offset);

      // Calculate summary metrics
      const summary = posts.reduce(
        (acc, post) => ({
          total_posts: acc.total_posts + 1,
          total_impressions: acc.total_impressions + (post.impressionsCount || 0),
          total_reach: acc.total_reach + (post.reachCount || 0),
          total_engagement: acc.total_engagement + ((post.likesCount || 0) + (post.commentsCount || 0) + (post.sharesCount || 0)),
          total_likes: acc.total_likes + (post.likesCount || 0),
          total_comments: acc.total_comments + (post.commentsCount || 0),
          total_shares: acc.total_shares + (post.sharesCount || 0),
          total_clicks: acc.total_clicks,
          avg_engagement_rate:
            acc.avg_engagement_rate + (Number(post.engagementRate) || 0) / (posts.length || 1),
        }),
        {
          total_posts: 0,
          total_impressions: 0,
          total_reach: 0,
          total_engagement: 0,
          total_likes: 0,
          total_comments: 0,
          total_shares: 0,
          total_clicks: 0,
          avg_engagement_rate: 0,
        }
      );

      // Find top performing posts
      const topPosts = [...posts].slice(0, 10);

      return NextResponse.json({
        posts,
        top_posts: topPosts,
        summary,
        total: postTotal,
        limit,
        offset,
        date_range: {
          start_date: startDateStr,
          end_date: endDateStr,
        },
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to fetch post analytics',
        },
        { status: 500 }
      );
    }
});

export const PUT = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { _userId, organizationId } = context;

      // Get campaign ID from query params
      const searchParams = request.nextUrl.searchParams;
      const campaignId = searchParams.get('id');

      if (!campaignId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Campaign ID required'
    );
      }

      // Verify user has access to this campaign
      const [campaign] = await db
        .select()
        .from(socialCampaigns)
        .where(eq(socialCampaigns.id, campaignId))
        .limit(1);

      if (!campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      if (organizationId !== campaign.organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
        );
      }

      // Get campaign posts
      const posts = await db
        .select({
          id: socialPosts.id,
          content: socialPosts.content,
          publishedAt: socialPosts.publishedAt,
          impressionsCount: socialPosts.impressionsCount,
          reachCount: socialPosts.reachCount,
          likesCount: socialPosts.likesCount,
          commentsCount: socialPosts.commentsCount,
          sharesCount: socialPosts.sharesCount,
          engagementRate: socialPosts.engagementRate,
          accountPlatform: socialAccounts.platform,
        })
        .from(socialPosts)
        .leftJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
        .where(and(eq(socialPosts.campaignId, campaignId), eq(socialPosts.status, 'published')))
        .orderBy(asc(socialPosts.publishedAt));

      // Calculate overall metrics
      const metrics = posts.reduce(
        (acc, post) => ({
          total_posts: acc.total_posts + 1,
          total_impressions: acc.total_impressions + (post.impressionsCount || 0),
          total_reach: acc.total_reach + (post.reachCount || 0),
          total_engagement: acc.total_engagement + ((post.likesCount || 0) + (post.commentsCount || 0) + (post.sharesCount || 0)),
          total_likes: acc.total_likes + (post.likesCount || 0),
          total_comments: acc.total_comments + (post.commentsCount || 0),
          total_shares: acc.total_shares + (post.sharesCount || 0),
          total_clicks: acc.total_clicks,
        }),
        {
          total_posts: 0,
          total_impressions: 0,
          total_reach: 0,
          total_engagement: 0,
          total_likes: 0,
          total_comments: 0,
          total_shares: 0,
          total_clicks: 0,
        }
      );

      // Calculate average engagement rate
      const avgEngagementRate =
        posts.length > 0
          ? posts.reduce((sum, post) => sum + (Number(post.engagementRate) || 0), 0) / posts.length
          : 0;

      // Goal progress: schema has individual goal fields, not a goals array
      const goalProgress = undefined;

      // Group posts by platform
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const postsByPlatform = posts.reduce((acc: Record<string, any[]>, post) => {
        const platform = post.accountPlatform ?? 'unknown';
        if (!acc[platform]) {
          acc[platform] = [];
        }
        acc[platform].push(post);
        return acc;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {} as Record<string, any[]>);

      // Calculate platform-specific metrics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platformMetrics = Object.entries(postsByPlatform).map(([platform, platformPosts]: [string, any]) => {
        const platformTotal = platformPosts.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc: any, post: any) => ({
            posts: acc.posts + 1,
            impressions: acc.impressions + (post.impressions || 0),
            engagement: acc.engagement + (post.engagement || 0),
            likes: acc.likes + (post.likes || 0),
            comments: acc.comments + (post.comments || 0),
            shares: acc.shares + (post.shares || 0),
          }),
          { posts: 0, impressions: 0, engagement: 0, likes: 0, comments: 0, shares: 0 }
        );

        return {
          platform,
          ...platformTotal,
          avg_engagement_rate:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            platformPosts.reduce((sum: number, post: any) => sum + (post.engagement_rate || 0), 0) /
            platformPosts.length,
        };
      });

      // Get timeline data (daily metrics)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timeline = posts.reduce((acc: Record<string, any>, post) => {
        const date = post.publishedAt ? format(new Date(post.publishedAt), 'yyyy-MM-dd') : 'unknown';
        if (!acc[date]) {
          acc[date] = {
            date,
            posts: 0,
            impressions: 0,
            engagement: 0,
            likes: 0,
            comments: 0,
            shares: 0,
          };
        }
        acc[date].posts += 1;
        acc[date].impressions += post.impressionsCount || 0;
        acc[date].engagement += (post.likesCount || 0) + (post.commentsCount || 0) + (post.sharesCount || 0);
        acc[date].likes += post.likesCount || 0;
        acc[date].comments += post.commentsCount || 0;
        acc[date].shares += post.sharesCount || 0;
        return acc;
      }, {});

      return NextResponse.json({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          start_date: campaign.startDate,
          end_date: campaign.endDate,
          status: campaign.status,
        },
        metrics: {
          ...metrics,
          avg_engagement_rate: avgEngagementRate,
        },
        goal_progress: goalProgress,
        platform_metrics: platformMetrics,
        timeline: Object.values(timeline),
        top_posts: [...(posts || [])].sort((a, b) => (Number(b.engagementRate) || 0) - (Number(a.engagementRate) || 0)).slice(0, 5),
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to fetch campaign analytics',
        },
        { status: 500 }
      );
    }
});

export const DELETE = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { _userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      // Parse query parameters
      const searchParams = request.nextUrl.searchParams;
      const format_type = searchParams.get('format') || 'csv';
      const data_type = searchParams.get('type') || 'posts'; // posts, accounts, campaigns
      const startDate = searchParams.get('start_date') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate = searchParams.get('end_date') || format(new Date(), 'yyyy-MM-dd');

      let data: Array<Record<string, unknown>> = [];
      let headers: string[] = [];

      switch (data_type) {
        case 'posts': {
          const exportPosts = await db
            .select({
              platform: socialAccounts.platform,
              account: socialAccounts.username,
              campaign_id: socialPosts.campaignId,
              content: socialPosts.content,
              published_at: socialPosts.publishedAt,
              impressions: socialPosts.impressionsCount,
              reach: socialPosts.reachCount,
              engagement_rate: socialPosts.engagementRate,
              likes: socialPosts.likesCount,
              comments: socialPosts.commentsCount,
              shares: socialPosts.sharesCount,
            })
            .from(socialPosts)
            .leftJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
            .where(
              and(
                eq(socialAccounts.organizationId, organizationId),
                eq(socialPosts.status, 'published'),
                gte(socialPosts.publishedAt, new Date(startDate)),
                lte(socialPosts.publishedAt, new Date(endDate + 'T23:59:59'))
              )
            )
            .orderBy(desc(socialPosts.publishedAt));

          data = exportPosts;
          headers = [
            'Platform',
            'Account',
            'Content',
            'Published At',
            'Impressions',
            'Reach',
            'Engagement Rate',
            'Likes',
            'Comments',
            'Shares',
          ];
          break;
        }

        case 'accounts': {
          const exportAnalytics = await db
            .select({
              date: socialAnalytics.analyticsDate,
              platform: socialAccounts.platform,
              account: socialAccounts.username,
              impressions: socialAnalytics.totalImpressions,
              reach: socialAnalytics.totalReach,
              engagement: socialAnalytics.totalEngagements,
              likes: socialAnalytics.totalLikes,
              comments: socialAnalytics.totalComments,
              shares: socialAnalytics.totalShares,
              clicks: socialAnalytics.linkClicks,
              engagement_rate: socialAnalytics.engagementRate,
              follower_count: socialAnalytics.followerCount,
            })
            .from(socialAnalytics)
            .leftJoin(socialAccounts, eq(socialAnalytics.accountId, socialAccounts.id))
            .where(
              and(
                eq(socialAccounts.organizationId, organizationId),
                gte(socialAnalytics.analyticsDate, startDate),
                lte(socialAnalytics.analyticsDate, endDate)
              )
            )
            .orderBy(asc(socialAnalytics.analyticsDate));

          data = exportAnalytics;
          headers = [
            'Date',
            'Platform',
            'Account',
            'Impressions',
            'Reach',
            'Engagement',
            'Likes',
            'Comments',
            'Shares',
            'Clicks',
            'Engagement Rate',
            'Followers',
          ];
          break;
        }

        case 'campaigns': {
          const exportCampaigns = await db
            .select()
            .from(socialCampaigns)
            .where(eq(socialCampaigns.organizationId, organizationId))
            .orderBy(desc(socialCampaigns.createdAt));

          data = await Promise.all(
            exportCampaigns.map(async (campaign) => {
              const campaignPosts = await db
                .select({
                  impressionsCount: socialPosts.impressionsCount,
                  likesCount: socialPosts.likesCount,
                  commentsCount: socialPosts.commentsCount,
                  sharesCount: socialPosts.sharesCount,
                })
                .from(socialPosts)
                .where(eq(socialPosts.campaignId, campaign.id));

              return {
                name: campaign.name,
                start_date: campaign.startDate,
                end_date: campaign.endDate,
                status: campaign.status,
                platforms: campaign.platforms?.join(', '),
                total_posts: campaignPosts.length,
                total_impressions: campaignPosts.reduce((sum, p) => sum + (p.impressionsCount || 0), 0),
                total_engagement: campaignPosts.reduce((sum, p) => sum + (p.likesCount || 0) + (p.commentsCount || 0) + (p.sharesCount || 0), 0),
                total_likes: campaignPosts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
                total_comments: campaignPosts.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
                total_shares: campaignPosts.reduce((sum, p) => sum + (p.sharesCount || 0), 0),
                total_clicks: 0,
              };
            })
          );

          headers = [
            'Campaign',
            'Start Date',
            'End Date',
            'Status',
            'Platforms',
            'Total Posts',
            'Impressions',
            'Engagement',
            'Likes',
            'Comments',
            'Shares',
            'Clicks',
          ];
          break;
        }

        default:
          return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid data type'
    );
      }

      // Generate CSV
      if (format_type === 'csv') {
        const csv = [
          headers.join(','),
          ...data.map((row) => {
            return headers
              .map((header) => {
                const key = header.toLowerCase().replace(/ /g, '_');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let value: any = row[key] || '';
                
                // Handle nested objects
                if (typeof value === 'object' && value !== null) {
                  if (Array.isArray(value)) {
                    value = value.join('; ');
                  } else {
                    value = Object.values(value).join(' ');
                  }
                }
                
                // Escape quotes and wrap in quotes if contains comma
                value = String(value).replace(/"/g, '""');
                return value.includes(',') ? `"${value}"` : value;
              })
              .join(',');
          }),
        ].join('\n');

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="social-media-${data_type}-${format(
              new Date(),
              'yyyy-MM-dd'
            )}.csv"`,
          },
        });
      }

      // Return JSON
      return NextResponse.json({
        data,
        headers,
        date_range: {
          start_date: startDate,
          end_date: endDate,
        },
        exported_at: new Date().toISOString(),
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to export analytics',
        },
        { status: 500 }
      );
    }
});
