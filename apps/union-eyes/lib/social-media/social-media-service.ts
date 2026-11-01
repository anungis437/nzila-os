/**
 * Social Media Service - Phase 10
 * 
 * Unified service for managing social media integrations across
 * Facebook, Instagram, Twitter, and LinkedIn.
 * 
 * Orchestrates OAuth flows, post publishing, analytics aggregation,
 * and rate limit management across all platforms.
 */

import { openToken, openOptionalToken, sealToken, sealOptionalToken } from '@/lib/social-media/token-vault';
import { MetaAPIClient, createMetaClient } from './meta-api-client';
import { TwitterAPIClient, createTwitterClient } from './twitter-api-client';
import { LinkedInAPIClient, createLinkedInClient } from './linkedin-api-client';
import { db } from '@/db';
import { ApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
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
  campaign_id?: string;
  platforms: SocialPlatform[];
}

/** Platforms whose API is asked to publish later; the others would publish at once, so a schedule is refused for them. */
const SCHEDULING_PLATFORMS: readonly SocialPlatform[] = ['facebook'];

const TWITTER_LIMIT = 280;

/** The text as sent: hashtags are part of the post, so they are written into it rather than stored beside text that omits them. */
export function composePostText(content: Pick<UnifiedPostContent, 'text' | 'hashtags'>): string {
  const tags = (content.hashtags ?? []).map((tag) => `#${tag}`).join(' ');
  return tags ? `${content.text}\n\n${tags}` : content.text;
}

/**
 * Platform-specific post result
 */
/** Narrows a publish: to named accounts, and to a draft that already exists and is completed rather than inserted. */
export interface PublishOptions {
  accountIds?: string[];
  existingPostId?: string;
}

/** The kind of post, from its content; used for a draft as well as for a published post. */
export function postTypeFor(content: Pick<UnifiedPostContent, 'media_urls' | 'link_url'>): SocialPostType {
  if (content.media_urls && content.media_urls.length > 0) {
    if (content.media_urls.length > 1) return 'carousel';
    const url = content.media_urls[0].toLowerCase();
    return url.includes('.mp4') || url.includes('.mov') || url.includes('video') ? 'video' : 'image';
  }
  return content.link_url ? 'link' : 'text';
}

export interface PlatformPostResult {
  platform: SocialPlatform;
  success: boolean;
  post_id?: string;
  error?: string;
  permalink?: string;
  /** false when the platform accepted the post but this application could not save its own record of it. */
  recorded?: boolean;
}

/** Raised by a publish in which no platform accepted the post, so the operation audit records a failure, not a completion. */
export class AllPlatformsFailedError extends Error {
  constructor(readonly results: PlatformPostResult[]) {
    super('No platform accepted the post');
    this.name = 'AllPlatformsFailedError';
  }
}

/** A refusal made by this application before the platform is asked; its message is ours and safe to return. */
export class PublishRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishRefusal';
  }
}

/** What a caller may be told about a failed platform call: this application's own refusals, never the platform's text. */
function publishFailureMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof PublishRefusal ? error.message : 'The platform did not accept the post.';
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
        return createMetaClient((await openToken(typedAccount.accessToken)));

      case 'twitter':
        return createTwitterClient((await openToken(typedAccount.accessToken)), (await openOptionalToken(typedAccount.refreshToken)));

      case 'linkedin':
        return createLinkedInClient((await openToken(typedAccount.accessToken)));

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
          const metaClient = createMetaClient((await openToken(typedAccount.accessToken)));
          const tokenData = await metaClient.getLongLivedToken((await openToken(typedAccount.accessToken)));
          newAccessToken = tokenData.access_token;
          expiresIn = tokenData.expires_in;
          break;
        }

        case 'twitter': {
          if (!typedAccount.refreshToken) {
            throw new Error('No refresh token available for Twitter account');
          }
          const twitterClient = createTwitterClient(
            (await openToken(typedAccount.accessToken)),
            (await openToken(typedAccount.refreshToken))
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
          const linkedInClient = createLinkedInClient((await openToken(typedAccount.accessToken)));
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
        accessToken: await sealToken(newAccessToken),
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
        ...(newRefreshToken ? { refreshToken: await sealToken(newRefreshToken) } : {}),
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
    createdById: string,
    options: PublishOptions = {},
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
          // Publishing reaches only the accounts the post names: never every connected page of a platform.
          ...(options.accountIds ? [inArray(socialAccounts.id, options.accountIds)] : []),
        )
      );

    if (typedAccounts.length === 0) {
      throw new Error('No active accounts found for specified platforms');
    }

    const text = composePostText(content);

    // Publish to each platform
    for (const account of typedAccounts) {
      try {
        // A schedule is never turned into an immediate post: a platform that cannot schedule refuses it.
        if (content.scheduled_for && !SCHEDULING_PLATFORMS.includes(account.platform)) {
          throw new PublishRefusal(`Scheduled publishing is not supported on ${account.platform}; the post was not published.`);
        }
        if (account.platform === 'twitter' && text.length > TWITTER_LIMIT) {
          throw new PublishRefusal(`The post with its hashtags exceeds ${TWITTER_LIMIT} characters.`);
        }
        const client = await this.getClient(account.id, organizationId);
        let postId: string;
        let permalink: string | undefined;

        switch (account.platform) {
          case 'facebook': {
            const metaClient = client as MetaAPIClient;
            const response = await metaClient.publishFacebookPost(
              account.platformUserId,
              (await openToken(account.accessToken)),
              {
                message: text,
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
              throw new PublishRefusal('Instagram posts require at least one image');
            }

            const response = await metaClient.publishInstagramPost(
              account.platformUserId,
              {
                image_url: content.media_urls[0],
                caption: text,
              }
            );
            postId = response.id;
            permalink = response.permalink;
            break;
          }

          case 'twitter': {
            const twitterClient = client as TwitterAPIClient;
            
            // No arbitrary remote media URL may be fetched by the application server.
            // A scheme check does not prevent redirects, DNS rebinding, private-IP access,
            // oversized responses or unsupported content types. Until trusted uploaded
            // asset IDs are supported, refuse media publishing explicitly and preserve
            // the fully functional text-only publishing path.
            if (content.media_urls && content.media_urls.length > 0) {
              throw ApiError.notImplemented(
                'X media publishing requires verified uploaded assets; remote media URL ingestion is disabled',
              );
            }

            const tweet = await twitterClient.postTweet({
              text,
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
                  text,
                  imageUrl: content.media_urls[0],
                }
              );
            } else if (content.link_url) {
              response = await linkedInClient.createOrganizationPostWithLink(
                account.platformUserId,
                {
                  text,
                  linkUrl: content.link_url,
                  linkTitle: content.link_title,
                  linkDescription: content.link_description,
                }
              );
            } else {
              response = await linkedInClient.createOrganizationPost(
                account.platformUserId,
                {
                  text,
                }
              );
            }
            postId = response.id;
            break;
          }

          default:
            throw new PublishRefusal(`Unsupported platform: ${account.platform}`);
        }

        // The platform has accepted the post. A failure to save our record of it must not be reported as a failed publish:
        // the post is live, so it is reported as published and unrecorded, and the failure is logged.
        let recorded = true;
        try {
          if (options.existingPostId) {
            // An approved draft is completed in place: it is the record of what was approved.
            const completed = await db
              .update(socialPosts)
              .set({
                platformPostId: postId,
                status: content.scheduled_for ? 'scheduled' : 'published',
                publishedAt: content.scheduled_for ? null : new Date(),
                platformUrl: permalink ?? null,
                updatedAt: new Date(),
              })
              .where(and(eq(socialPosts.id, options.existingPostId), eq(socialPosts.organizationId, organizationId), eq(socialPosts.accountId, account.id)))
              .returning({ id: socialPosts.id });
            if (completed.length === 0) throw new Error('The approved draft no longer exists');
          } else await db.insert(socialPosts).values({
            organizationId,
            accountId: account.id,
            platformPostId: postId,
            campaignId: content.campaign_id ?? null,
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
        } catch (recordError) {
          recorded = false;
          logger.error('Post accepted by the platform but not recorded', {
            organizationId,
            platform: account.platform,
            platformPostId: postId,
            error: recordError instanceof Error ? recordError.message : String(recordError),
          });
        }

        results.push({
          platform: account.platform,
          success: true,
          post_id: postId,
          permalink,
          recorded,
        });
      } catch (error) {
        logger.warn('Platform publish failed', {
          organizationId,
          platform: account.platform,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          platform: account.platform,
          success: false,
          error: publishFailureMessage(error),
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
  /**
   * Removes the post from its platform and nothing else. The caller records the local state change in its own transaction, so a
   * failure after the platform removal leaves a row that still says published and a retry completes the deletion: a platform answer
   * that the post is already gone counts as removed.
   */
  async removeFromPlatform(postId: string, organizationId: string): Promise<{ alreadyRemoved: boolean }> {
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
          await metaClient.deletePost(typedPost.platformPostId!, (await openToken(typedPost.accessToken!)));
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
      return { alreadyRemoved: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (/not found|does not exist|already (been )?deleted|\b404\b|\b410\b/i.test(message)) return { alreadyRemoved: true };
      throw new Error(`Failed to delete post: ${message}`);
    }
  }

  async deletePost(postId: string, organizationId: string): Promise<void> {
    await this.removeFromPlatform(postId, organizationId);
    await db.update(socialPosts).set({
      status: 'deleted',
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(socialPosts.id, postId), eq(socialPosts.organizationId, organizationId)));
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
            (await openToken(typedAccount.accessToken)),
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

      // The platform responses above are fetched but not yet transformed, so nothing was collected. Returning an empty list as a
      // successful collection would leave the analytics table unwritten and every dashboard figure at zero without saying so.
      if (analytics.length === 0) {
        throw ApiError.notImplemented(
          `Analytics collection for ${typedAccount.platform} is not implemented: the platform response is not transformed, so nothing was collected.`,
        );
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
    return postTypeFor(content);
  }
}

/**
 * Helper function to create social media service from environment
 */
export function createSocialMediaService(): SocialMediaService {
  return new SocialMediaService();
}

export default SocialMediaService;
