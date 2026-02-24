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
import { createClient } from '@supabase/supabase-js';
import type {
  SocialAccount,
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
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get API client for a specific account
   */
  private async getClient(
    accountId: string
  ): Promise<MetaAPIClient | TwitterAPIClient | LinkedInAPIClient> {
    const { data: account, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Type assertion for the account data
    const typedAccount = account as SocialAccount;

    // Check if token is expired and needs refresh
    if (typedAccount.tokenExpiresAt && new Date(typedAccount.tokenExpiresAt) < new Date()) {
      await this.refreshAccessToken(typedAccount.id);
      return this.getClient(accountId); // Recursive call with fresh token
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
   * Refresh access token for an account
   */
  async refreshAccessToken(accountId: string): Promise<void> {
    const { data: account, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Type assertion for the account data
    const typedAccount = account as SocialAccount;

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
      const updateData = {
        access_token: newAccessToken,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
        ...(newRefreshToken && { refresh_token: newRefreshToken }),
      };

      // @ts-expect-error - Supabase client without Database type
      await this.supabase.from('social_accounts').update(updateData).eq('id', accountId);
    } catch (error) {
      // Update account status to error
      // @ts-expect-error - Supabase client without Database type
      await this.supabase.from('social_accounts').update({ status: 'error', error_message: error instanceof Error ? error.message : 'Token refresh failed' }).eq('id', accountId);

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
    const { data: accounts, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .in('platform', content.platforms)
      .eq('status', 'active');

    if (error || !accounts || accounts.length === 0) {
      throw new Error('No active accounts found for specified platforms');
    }

    // Type assertion for accounts array
    const typedAccounts = accounts as SocialAccount[];

    // Publish to each platform
    for (const account of typedAccounts) {
      try {
        const client = await this.getClient(account.id);
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
        const postData = {
          organization_id: organizationId,
          account_id: account.id,
          platform: account.platform,
          platform_post_id: postId,
          post_type: this.detectPostType(content),
          content: content.text,
          media_urls: content.media_urls || [],
          hashtags: content.hashtags || [],
          mentions: content.mentions || [],
          status: content.scheduled_for ? 'scheduled' : 'published',
          scheduled_for: content.scheduled_for?.toISOString(),
          published_at: content.scheduled_for ? null : new Date().toISOString(),
          permalink: permalink || null,
          created_by: createdById,
        };

        // @ts-expect-error - Supabase client without Database type
        await this.supabase.from('social_posts').insert(postData);

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
   * Delete a post from a platform
   */
  async deletePost(postId: string): Promise<void> {
    const { data: post, error } = await this.supabase
      .from('social_posts')
      .select('*, account:social_accounts(*)')
      .eq('id', postId)
      .single();

    if (error || !post) {
      throw new Error(`Post not found: ${postId}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedPost = post as any;
    const client = await this.getClient(typedPost.account_id);

    try {
      switch (typedPost.platform) {
        case 'facebook':
        case 'instagram': {
          const metaClient = client as MetaAPIClient;
          await metaClient.deletePost(typedPost.platform_post_id, typedPost.account.access_token);
          break;
        }

        case 'twitter': {
          const twitterClient = client as TwitterAPIClient;
          await twitterClient.deleteTweet(typedPost.platform_post_id);
          break;
        }

        case 'linkedin': {
          const linkedInClient = client as LinkedInAPIClient;
          await linkedInClient.deletePost(typedPost.platform_post_id);
          break;
        }

        default:
          throw new Error(`Unsupported platform: ${typedPost.platform}`);
      }

      // Update post status in database
      // @ts-expect-error - Supabase client without Database type
      await this.supabase.from('social_posts').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', postId);
    } catch (error) {
      throw new Error(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch analytics for an account
   */
  async fetchAnalytics(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UnifiedAnalytics[]> {
    const { data: account, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const typedAccount = account as SocialAccount;
    const client = await this.getClient(accountId);
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
        // @ts-expect-error - Supabase client without Database type
        await this.supabase.from('social_analytics').upsert({
          organization_id: typedAccount.organizationId,
          account_id: accountId,
          platform: data.platform,
          date: data.date.toISOString().split('T')[0],
          impressions: data.impressions,
          reach: data.reach,
          engagement_count: data.engagement,
          likes_count: data.likes,
          comments_count: data.comments,
          shares_count: data.shares,
          clicks_count: data.clicks,
          follower_count: data.follower_count,
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
    const { data: accounts, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    if (error || !accounts) {
      return [];
    }

    const typedAccounts = accounts as SocialAccount[];
    const statuses: RateLimitStatus[] = [];

    for (const account of typedAccounts) {
      try {
        const client = await this.getClient(account.id);
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  return new SocialMediaService(supabaseUrl, supabaseKey);
}

export default SocialMediaService;

