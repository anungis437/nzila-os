/**
 * Social Media Integration Service
 * 
 * Provides integration with social media platforms for sharing,
 * authentication, and content publishing.
 */

import { logger } from '@/lib/logger';

// Social media platform types
export type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube';

export interface SocialPost {
  id?: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  publishedAt?: Date;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  analytics?: SocialAnalytics;
}

export interface SocialAnalytics {
  impressions: number;
  engagements: number;
  clicks: number;
  shares: number;
  likes: number;
}

export interface ShareOptions {
  platform: SocialPlatform | 'all';
  title: string;
  description: string;
  url: string;
  mediaUrl?: string;
  // callback?: () => void;
}

/**
 * Social Media Service
 */
class SocialMediaService {
  // Configuration for social media platforms
  private config: Record<SocialPlatform, {
    enabled: boolean;
    appId?: string;
    apiKey?: string;
  }> = {
    facebook: { enabled: false },
    twitter: { enabled: false },
    instagram: { enabled: false },
    linkedin: { enabled: false },
    youtube: { enabled: false },
  };

  /**
   * Configure platform credentials
   */
  configurePlatform(platform: SocialPlatform, config: {
    enabled: boolean;
    appId?: string;
    apiKey?: string;
  }): void {
    this.config[platform] = config;
    logger.info('Social media platform configured', { platform, enabled: config.enabled });
  }

  /**
   * Check if platform is enabled
   */
  isEnabled(platform: SocialPlatform): boolean {
    return this.config[platform]?.enabled || false;
  }

  /**
   * Share content to social media
   */
  async share(options: ShareOptions): Promise<{ success: boolean; postIds: Record<string, string> }> {
    const results: Record<string, string> = {};
    
    const platforms = options.platform === 'all' 
      ? (Object.keys(this.config) as SocialPlatform[])
      : [options.platform];

    for (const platform of platforms) {
      if (!this.isEnabled(platform)) {
        logger.warn('Social platform not enabled', { platform });
        continue;
      }

      try {
        const postId = await this.publishPost(platform, {
          platform,
          content: `${options.title}\n\n${options.description}\n\n${options.url}`,
          mediaUrls: options.mediaUrl ? [options.mediaUrl] : undefined,
          status: 'published',
          publishedAt: new Date(),
        });
        
        results[platform] = postId;
        logger.info('Social post published', { platform, postId });
      } catch (error) {
        logger.error('Failed to publish social post', { platform, error });
      }
    }

    return {
      success: Object.keys(results).length > 0,
      postIds: results,
    };
  }

  /**
   * Create a scheduled post
   * Note: Requires a job scheduler (e.g. Celery) to process scheduled posts.
   * Posts are logged for the scheduler to pick up.
   */
  async schedulePost(post: SocialPost): Promise<string> {
    if (!this.isEnabled(post.platform)) {
      throw new Error(`Platform ${post.platform} is not enabled. Configure it first via configurePlatform().`);
    }

    const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Social post scheduled for processing by job queue', { 
      postId, 
      platform: post.platform, 
      scheduledAt: post.scheduledAt,
      contentLength: post.content.length,
    });

    return postId;
  }

  /**
   * Get post analytics
   */
  async getAnalytics(platform: SocialPlatform, postId: string): Promise<SocialAnalytics | null> {
    if (!this.isEnabled(platform)) {
      return null;
    }

    const config = this.config[platform];
    if (!config.apiKey) {
      logger.warn('Social media analytics unavailable: no API key configured', { platform, postId });
      return null;
    }

    // Platform-specific API calls
    try {
      switch (platform) {
        case 'facebook':
          return await this.fetchFacebookAnalytics(config.apiKey, postId);
        case 'twitter':
          return await this.fetchTwitterAnalytics(config.apiKey, postId);
        case 'linkedin':
          return await this.fetchLinkedInAnalytics(config.apiKey, postId);
        default:
          logger.warn('Analytics not supported for platform', { platform });
          return null;
      }
    } catch (error) {
      logger.error('Failed to fetch social analytics', { platform, postId, error });
      return null;
    }
  }

  private async fetchFacebookAnalytics(apiKey: string, postId: string): Promise<SocialAnalytics> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}/insights?access_token=${apiKey}&metric=post_impressions,post_engagements,post_clicks`
    );
    if (!response.ok) throw new Error(`Facebook API: ${response.status}`);
    const data = await response.json();
    const metrics = data.data || [];
    const getMetric = (name: string) => metrics.find((m: { name: string }) => m.name === name)?.values?.[0]?.value || 0;
    return {
      impressions: getMetric('post_impressions'),
      engagements: getMetric('post_engagements'),
      clicks: getMetric('post_clicks'),
      shares: 0,
      likes: 0,
    };
  }

  private async fetchTwitterAnalytics(apiKey: string, postId: string): Promise<SocialAnalytics> {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!response.ok) throw new Error(`Twitter API: ${response.status}`);
    const data = await response.json();
    const m = data.data?.public_metrics || {};
    return {
      impressions: m.impression_count || 0,
      engagements: (m.reply_count || 0) + (m.retweet_count || 0) + (m.like_count || 0),
      clicks: 0,
      shares: m.retweet_count || 0,
      likes: m.like_count || 0,
    };
  }

  private async fetchLinkedInAnalytics(_apiKey: string, _postId: string): Promise<SocialAnalytics> {
    // LinkedIn analytics API requires organization admin access
    logger.warn('LinkedIn analytics API integration pending organization admin setup');
    return { impressions: 0, engagements: 0, clicks: 0, shares: 0, likes: 0 };
  }

  /**
   * Generate share URL for a platform
   */
  getShareUrl(platform: SocialPlatform, options: ShareOptions): string {
    const encodedUrl = encodeURIComponent(options.url);
    const encodedTitle = encodeURIComponent(options.title);

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
      case 'linkedin':
        return `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`;
      case 'instagram':
        // Instagram doesn&apos;t have web share URL - would need native app
        return '';
      case 'youtube':
        return `https://www.youtube.com/share?url=${encodedUrl}`;
      default:
        return '';
    }
  }

  /**
   * Generate share sheet (all platforms)
   */
  getShareSheetOptions(options: ShareOptions): { platform: SocialPlatform; url: string }[] {
    return (Object.keys(this.config) as SocialPlatform[])
      .filter(p => this.isEnabled(p))
      .map(platform => ({
        platform,
        url: this.getShareUrl(platform, options),
      }))
      .filter(p => p.url !== '');
  }

  /**
   * Publish post via platform API
   */
  private async publishPost(platform: SocialPlatform, post: SocialPost): Promise<string> {
    const config = this.config[platform];
    if (!config.apiKey) {
      throw new Error(`No API key configured for ${platform}. Set credentials via configurePlatform().`);
    }

    switch (platform) {
      case 'facebook': {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/me/feed`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: post.content,
              access_token: config.apiKey,
            }),
          }
        );
        if (!response.ok) throw new Error(`Facebook API error: ${response.status}`);
        const data = await response.json();
        return data.id;
      }
      case 'twitter': {
        const response = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ text: post.content }),
        });
        if (!response.ok) throw new Error(`Twitter API error: ${response.status}`);
        const data = await response.json();
        return data.data.id;
      }
      case 'linkedin': {
        const response = await fetch('https://api.linkedin.com/v2/shares', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            distribution: { linkedInDistributionTarget: {} },
            text: { text: post.content },
          }),
        });
        if (!response.ok) throw new Error(`LinkedIn API error: ${response.status}`);
        const data = await response.json();
        return data.id;
      }
      default: {
        throw new Error(`Publishing not supported for platform: ${platform}`);
      }
    }
  }
}

// Export singleton
export const socialMediaService = new SocialMediaService();
export { SocialMediaService };

// Predefined share templates for union communications
export const shareTemplates = {
  /**
   * Strike notice template
   */
  strikeNotice: (employerName: string, date: string, location: string): ShareOptions => ({
    platform: 'all',
    title: 'Strike Notice',
    description: `Unions representing workers at ${employerName} have issued a strike notice for ${date}. Members are asked to gather at ${location}.`,
    url: 'https://unioneyes.app/strike-updates',
  }),

  /**
   * Contract win celebration
   */
  contractWin: (employerName: string, gains: string): ShareOptions => ({
    platform: 'all',
    title: 'Contract Victory! 🎉',
    description: `Our bargaining team has secured a new contract with ${employerName}! Key wins include: ${gains}. Solidarity wins!`,
    url: 'https://unioneyes.app/contract-updates',
  }),

  /**
   * Member recruitment
   */
  memberDrive: (unionName: string): ShareOptions => ({
    platform: 'all',
    title: 'Join the Union',
    description: `Stronger together! ${unionName} is accepting new members. Join us for better wages, benefits, and working conditions.`,
    url: 'https://unioneyes.app/join',
  }),

  /**
   * Event promotion
   */
  event: (eventName: string, date: string, location: string): ShareOptions => ({
    platform: 'all',
    title: eventName,
    description: `Join us for ${eventName} on ${date} at ${location}. All members welcome!`,
    url: 'https://unioneyes.app/events',
  }),
};
