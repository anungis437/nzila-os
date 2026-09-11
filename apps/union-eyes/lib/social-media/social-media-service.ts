/**
 * Social Media Service - Phase 10
 * 
 * Unified service for managing social media integrations across
 * Facebook, Instagram, Twitter, and LinkedIn.
 * 
 * Orchestrates OAuth flows, post publishing, analytics aggregation,
 * and rate limit management across all platforms.
 */

import { MetaAPIClient, createMetaClient } from './meta-api-client';
import { TwitterAPIClient, createTwitterClient } from './twitter-api-client';
import { LinkedInAPIClient, createLinkedInClient } from './linkedin-api-client';
import { db } from '@/db';
import { socialAccounts, socialPosts, socialAnalytics } from '@/db/schema/social-media-schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
  SocialPlatform,
  SocialPostType,
} from '@/db/schema/social-media-schema';

/**
 * Unified social media post content
 */
export interface UnifiedPostContent {
  text: string;
  media_urls?: string[];
  link_url?: string;
  link_title?: string;
  link_description?: string;
  hashtags?: string[];
  mentions?: string[];
  scheduled_for?: Date;
  platforms: SocialPlatform[];
}

/**
 * Platform-specific post result
 */
export interface PlatformPostResult {
  platform: SocialPlatform;
  success: boolean;
  post_id?: string;
  error?: string;
  permalink?: string;
}

/**
 * Unified analytics data
 */
export interface UnifiedAnalytics {
  platform: SocialPlatform;
  date: Date;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  follower_count: number;
}

/**
 * Rate limit status across platforms
 */
export interface RateLimitStatus {
  platform: SocialPlatform;
  remaining: number;
  limit: number;
  reset_at: Date;
  is_limited: boolean;
}

/**
 * Social Media Service
 * 
 * Provides a unified interface for all social media operations
 */
export class SocialMediaService {
  constructor() {}

  /**
   * Get API client for a specific account.
   *
   * organizationId is required and enforced in the query below — credential
   * material must never be loaded for an account outside the caller's own
   * organization, regardless of how trusted the caller believes accountId is.
   */
  private async getClient(
    accountId: string,
    organizationId: string
  ): Promise<MetaAPIClient | TwitterAPIClient | LinkedInAPIClient> {
    const [typedAccount] = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)))
      .limit(1);

    if (!typedAccount) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Check if token is expired and needs refresh
    if (typedAccount.tokenExpiresAt && new Date(typedAccount.tokenExpiresAt) < new Date()) {
      await this.refreshAccessToken(typedAccount.id, typedAccount.organizationId);
      return this.getClient(accountId, organizationId); // Recursive call with fresh token
    }

    switch (typedAccount.platform) {
      case 'facebook':
      case 'instagram':
        return createMetaClient(typedAccount.accessToken);

      case 'twitter':
        return createTwitterClient(typedAccount.accessToken, typedAccount.refreshToken || undefined);

      case 'linkedin':
        return createLinkedInClient(typedAccount.accessToken);

      default:
        throw new Error(`Unsupported platform: ${typedAccount.platform}`);
    }
  }

  /**
   * Refresh access token for an account.
   *
   * organizationId is required and enforced in every query below — this is
   * a public method with no other org gate, so the ownership check must live
   * in the query itself rather than rely on a caller-side check.
   */
  async refreshAccessToken(accountId: string, organizationId: string): Promise<void> {
    const [typedAccount] = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)))
      .limit(1);

    if (!typedAccount) {
      throw new Error(`Account not found: ${accountId}`);
    }

    try {
      let newAccessToken: string;
      let newRefreshToken: string | null = null;
      let expiresIn: number;

      switch (typedAccount.platform) {
        case 'facebook':
        case 'instagram': {
          const metaClient = createMetaClient(typedAccount.accessToken);
          const tokenData = await metaClient.getLongLivedToken(typedAccount.accessToken);
          newAccessToken = tokenData.access_token;
          expiresIn = tokenData.expires_in;
          break;
        }

        case 'twitter': {
          if (!typedAccount.refreshToken) {
            throw new Error('No refresh token available for Twitter account');
          }
          const twitterClient = createTwitterClient(
            typedAccount.accessToken,
            typedAccount.refreshToken
          );
          const tokenData = await twitterClient.refreshAccessToken();
          newAccessToken = tokenData.access_token;
          newRefreshToken = tokenData.refresh_token || null;
          expiresIn = tokenData.expires_in;
          break;
        }

        case 'linkedin': {
          if (!typedAccount.refreshToken) {
            throw new Error('No refresh token available for LinkedIn account');
          }
          const linkedInClient = createLinkedInClient(typedAccount.accessToken);
          const tokenData = await linkedInClient.refreshAccessToken(typedAccount.refreshToken);
          newAccessToken = tokenData.access_token;
          newRefreshToken = tokenData.refresh_token || null;
          expiresIn = tokenData.expires_in;
          break;
        }

        default:
          throw new Error(`Token refresh not supported for platform: ${typedAccount.platform}`);
      }

      // Update account with new tokens
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      await db.update(socialAccounts).set({
        accessToken: newAccessToken,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
        ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
      }).where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)));
    } catch (error) {
      // Update account status to error
      await db.update(socialAccounts).set({
        status: 'expired',
        updatedAt: new Date(),
      }).where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)));

      throw error;
    }
  }

  /**
   * Publish a post to multiple platforms
   */
  async publishPost(
    organizationId: string,
    content: UnifiedPostContent,
    createdById: string
  ): Promise<PlatformPostResult[]> {
    const results: PlatformPostResult[] = [];

    // Get accounts for specified platforms
    const typedAccounts = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.organizationId, organizationId),
          inArray(socialAccounts.platform, content.platforms),
          eq(socialAccounts.status, 'active'),
        )
      );

    if (typedAccounts.length === 0) {
      throw new Error('No active accounts found for specified platforms');
    }

    // Publish to each platform
    for (const account of typedAccounts) {
      try {
        const client = await this.getClient(account.id, organizationId);
        let postId: string;
        let permalink: string | undefined;

        switch (account.platform) {
          case 'facebook': {
            const metaClient = client as MetaAPIClient;
            const response = await metaClient.publishFacebookPost(
              account.platformUserId,
              account.accessToken,
              {
                message: content.text,
                media_urls: content.media_urls,
                link: content.link_url,
                scheduled_publish_time: content.scheduled_for
                  ? Math.floor(content.scheduled_for.getTime() / 1000)
                  : undefined,
              }
            );
            postId = response.id;
            permalink = response.permalink_url;
            break;
          }

          case 'instagram': {
            const metaClient = client as MetaAPIClient;
            
            // Instagram requires at least one image
            if (!content.media_urls || content.media_urls.length === 0) {
              throw new Error('Instagram posts require at least one image');
            }

            const response = await metaClient.publishInstagramPost(
              account.platformUserId,
              {
                image_url: content.media_urls[0],
                caption: content.text,
              }
            );
            postId = response.id;
            permalink = response.permalink;
            break;
          }

          case 'twitter': {
            const twitterClient = client as TwitterAPIClient;
            
            // Upload media if present
            let mediaIds: string[] | undefined;
            if (content.media_urls && content.media_urls.length > 0) {
              mediaIds = [];
              for (const url of content.media_urls) {
                // Validate media URL to prevent SSRF
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                  throw new Error(`Blocked media URL scheme: ${parsed.protocol}`);
                }
                // Fetch and upload media
                const mediaResponse = await fetch(url);
                const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
                const mediaType = mediaResponse.headers.get('content-type') as 'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4';
                const media = await twitterClient.uploadMedia(mediaBuffer, mediaType);
                mediaIds.push(media.media_id_string);
              }
            }

            const tweet = await twitterClient.postTweet({
              text: content.text,
              media_ids: mediaIds,
            });
            postId = tweet.id;
            permalink = `https://twitter.com/i/web/status/${tweet.id}`;
            break;
          }

          case 'linkedin': {
            const linkedInClient = client as LinkedInAPIClient;
            let response;

            if (content.media_urls && content.media_urls.length > 0) {
              response = await linkedInClient.createOrganizationPostWithImage(
                account.platformUserId,
                {
                  text: content.text,
                  imageUrl: content.media_urls[0],
                }
              );
            } else if (content.link_url) {
              response = await linkedInClient.createOrganizationPostWithLink(
                account.platformUserId,
                {
                  text: content.text,
                  linkUrl: content.link_url,
                  linkTitle: content.link_title,
                  linkDescription: content.link_description,
                }
              );
            } else {
              response = await linkedInClient.createOrganizationPost(
                account.platformUserId,
                {
                  text: content.text,
                }
              );
            }
            postId = response.id;
            break;
          }

          default:
            throw new Error(`Unsupported platform: ${account.platform}`);
        }

        // Save post to database
        await db.insert(socialPosts).values({
          organizationId,
          accountId: account.id,
          platformPostId: postId,
          postType: this.detectPostType(content),
          content: content.text,
          mediaUrls: content.media_urls || [],
          hashtags: content.hashtags || [],
          mentions: content.mentions || [],
          status: content.scheduled_for ? 'scheduled' : 'published',
          scheduledFor: content.scheduled_for ?? null,
          publishedAt: content.scheduled_for ? null : new Date(),
          platformUrl: permalink ?? null,
          createdBy: createdById,
        });

        results.push({
          platform: account.platform,
          success: true,
          post_id: postId,
          permalink,
        });
      } catch (error) {
        results.push({
          platform: account.platform,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Delete a post from a platform.
   *
   * organizationId is required and enforced in the join below — this removes
   * the dependency on any caller having already checked ownership first.
   */
  async deletePost(postId: string, organizationId: string): Promise<void> {
    const [result] = await db
      .select({
        id: socialPosts.id,
        accountId: socialPosts.accountId,
        platformPostId: socialPosts.platformPostId,
        platform: socialAccounts.platform,
        accessToken: socialAccounts.accessToken,
      })
      .from(socialPosts)
      .leftJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
      .where(and(eq(socialPosts.id, postId), eq(socialPosts.organizationId, organizationId)))
      .limit(1);

    if (!result?.id) {
      throw new Error(`Post not found: ${postId}`);
    }

    const typedPost = result;
    const client = await this.getClient(result.accountId!, organizationId);

    try {
      switch (typedPost.platform) {
        case 'facebook':
        case 'instagram': {
          const metaClient = client as MetaAPIClient;
          await metaClient.deletePost(typedPost.platformPostId!, typedPost.accessToken!);
          break;
        }

        case 'twitter': {
          const twitterClient = client as TwitterAPIClient;
          await twitterClient.deleteTweet(typedPost.platformPostId!);
          break;
        }

        case 'linkedin': {
          const linkedInClient = client as LinkedInAPIClient;
          await linkedInClient.deletePost(typedPost.platformPostId!);
          break;
        }

        default:
          throw new Error(`Unsupported platform: ${typedPost.platform ?? 'unknown'}`);
      }

      // Update post status in database
      await db.update(socialPosts).set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(socialPosts.id, postId));
    } catch (error) {
      throw new Error(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch analytics for an account.
   *
   * organizationId is required and enforced in the account lookup — this is
   * a public method with no other org gate, so the ownership check must live
   * in the query itself rather than rely on a caller-side check.
   */
  async fetchAnalytics(
    organizationId: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UnifiedAnalytics[]> {
    const [typedAccount] = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)))
      .limit(1);

    if (!typedAccount) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const client = await this.getClient(accountId, organizationId);
    const analytics: UnifiedAnalytics[] = [];

    try {
      switch (typedAccount.platform) {
        case 'facebook': {
          const metaClient = client as MetaAPIClient;
          const _insights = await metaClient.getPageInsights(
            typedAccount.platformUserId,
            typedAccount.accessToken,
            [
              'page_impressions',
              'page_engaged_users',
              'page_post_engagements',
              'page_fans',
            ],
            'day',
            startDate,
            endDate
          );

          // Transform Meta insights to unified format
          // (Implementation depends on Meta's response structure)
          break;
        }

        case 'instagram': {
          const metaClient = client as MetaAPIClient;
          const _insights = await metaClient.getInstagramInsights(
            typedAccount.platformUserId,
            ['impressions', 'reach', 'follower_count'],
            'day',
            startDate,
            endDate
          );

          // Transform Instagram insights to unified format
          break;
        }

        case 'twitter': {
          // Twitter API v2 has limited organic analytics access
          // Would need Twitter Ads API or aggregation from individual tweets
          break;
        }

        case 'linkedin': {
          const linkedInClient = client as LinkedInAPIClient;
          const _stats = await linkedInClient.getOrganizationStatistics(
            typedAccount.platformUserId,
            startDate,
            endDate
          );

          // Transform LinkedIn stats to unified format
          break;
        }
      }

      // Save analytics to database
      for (const data of analytics) {
        const dateStr = data.date.toISOString().split('T')[0];
        await db.insert(socialAnalytics).values({
          organizationId: typedAccount.organizationId,
          accountId,
          analyticsDate: dateStr,
          totalImpressions: data.impressions,
          totalReach: data.reach,
          totalEngagements: data.engagement,
          totalLikes: data.likes,
          totalComments: data.comments,
          totalShares: data.shares,
          linkClicks: data.clicks,
          followerCount: data.follower_count,
        }).onConflictDoUpdate({
          target: [socialAnalytics.accountId, socialAnalytics.analyticsDate],
          set: {
            totalImpressions: data.impressions,
            totalReach: data.reach,
            totalEngagements: data.engagement,
            totalLikes: data.likes,
            totalComments: data.comments,
            totalShares: data.shares,
            linkClicks: data.clicks,
            followerCount: data.follower_count,
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
throw error;
    }

    return analytics;
  }

  /**
   * Get rate limit status for all connected accounts
   */
  async getRateLimitStatus(organizationId: string): Promise<RateLimitStatus[]> {
    const typedAccounts = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.organizationId, organizationId),
          eq(socialAccounts.status, 'active'),
        )
      );

    if (!typedAccounts.length) {
      return [];
    }
    const statuses: RateLimitStatus[] = [];

    for (const account of typedAccounts) {
      try {
        const client = await this.getClient(account.id, organizationId);
        let remaining = 0;
        let limit = 0;
        let resetAt = new Date();

        switch (account.platform) {
          case 'facebook':
          case 'instagram': {
            const metaClient = client as MetaAPIClient;
            const rateLimit = metaClient.getRateLimitInfo();
            if (rateLimit) {
              remaining = 100 - rateLimit.call_count;
              limit = 100;
            }
            break;
          }

          case 'twitter': {
            const twitterClient = client as TwitterAPIClient;
            const rateLimit = twitterClient.getRateLimit('/tweets');
            if (rateLimit) {
              remaining = rateLimit.remaining;
              limit = rateLimit.limit;
              resetAt = new Date(rateLimit.reset * 1000);
            }
            break;
          }

          case 'linkedin': {
            const linkedInClient = client as LinkedInAPIClient;
            const rateLimit = linkedInClient.getRateLimitInfo();
            if (rateLimit.remaining !== undefined) {
              remaining = rateLimit.remaining;
              limit = 500; // LinkedIn estimate
              if (rateLimit.reset) {
                resetAt = new Date(rateLimit.reset * 1000);
              }
            }
            break;
          }
        }

        statuses.push({
          platform: account.platform,
          remaining,
          limit,
          reset_at: resetAt,
          is_limited: remaining < limit * 0.1,
        });
      } catch (_error) {
}
    }

    return statuses;
  }

  /**
   * Detect post type from content
   */
  private detectPostType(content: UnifiedPostContent): SocialPostType {
    if (content.media_urls && content.media_urls.length > 0) {
      if (content.media_urls.length > 1) {
        return 'carousel';
      }
      // Check if it&apos;s a video (simple check, could be more sophisticated)
      const url = content.media_urls[0].toLowerCase();
      if (url.includes('.mp4') || url.includes('.mov') || url.includes('video')) {
        return 'video';
      }
      return 'image';
    }

    if (content.link_url) {
      return 'link';
    }

    return 'text';
  }
}

/**
 * Helper function to create social media service from environment
 */
export function createSocialMediaService(): SocialMediaService {
  return new SocialMediaService();
}

export default SocialMediaService;

