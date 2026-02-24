/**
 * Meta Graph API Client - Phase 10
 * 
 * Handles Facebook and Instagram API integration using Meta's Graph API.
 * Supports OAuth authentication, post publishing, media upload, analytics fetching,
 * and rate limit management.
 * 
 * @see https://developers.facebook.com/docs/graph-api
 */


// Types for Meta API responses
export interface MetaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface MetaLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Usually 60 days for long-lived tokens
}

export interface MetaPageInfo {
  id: string;
  name: string;
  access_token: string;
  category: string;
  tasks?: string[];
  fan_count?: number;
  followers_count?: number;
}

export interface MetaInstagramAccount {
  id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
}

export interface MetaPostResponse {
  id: string;
  created_time: string;
  message?: string;
  permalink_url: string;
  type: string;
}

export interface MetaPageInsights {
  page_impressions: number;
  page_engaged_users: number;
  page_post_engagements: number;
  page_fans: number;
  page_views_total: number;
}

export interface MetaPostInsights {
  post_impressions: number;
  post_engaged_users: number;
  post_clicks: number;
  post_reactions_like_total: number;
  post_reactions_love_total: number;
  post_reactions_wow_total: number;
  post_reactions_haha_total: number;
  post_reactions_sorry_total: number;
  post_reactions_anger_total: number;
  post_comments: number;
  post_shares: number;
}

export interface MetaInstagramInsights {
  impressions: number;
  reach: number;
  engagement: number;
  saved: number;
  video_views?: number;
  follower_count: number;
  profile_views: number;
}

export interface MetaRateLimit {
  call_count: number;
  total_time: number;
  total_cputime: number;
}

export interface MetaError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MetaAPIResponse<T = any> {
  data?: T;
  error?: MetaError;
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

/**
 * Meta Graph API Client
 * 
 * Handles all interactions with Facebook and Instagram APIs through
 * Meta's unified Graph API.
 */
export class MetaAPIClient {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';
  private readonly appId: string;
  private readonly appSecret: string;
  private accessToken?: string;
  private rateLimitInfo?: MetaRateLimit;

  constructor(appId: string, appSecret: string, accessToken?: string) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.accessToken = accessToken;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, scope: string[], state: string): string {
    const scopeString = scope.join(',');
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope: scopeString,
      response_type: 'code',
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string, redirectUri: string): Promise<MetaOAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(`${this.baseUrl}/oauth/access_token?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta OAuth error: ${data.error.message}`);
    }

    this.accessToken = data.access_token;
    return data;
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<MetaLongLivedTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${this.baseUrl}/oauth/access_token?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta token exchange error: ${data.error.message}`);
    }

    this.accessToken = data.access_token;
    return data;
  }

  /**
   * Get user's Facebook pages
   */
  async getUserPages(): Promise<MetaPageInfo[]> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    const response = await this.makeRequest<MetaAPIResponse<MetaPageInfo[]>>(
      '/me/accounts',
      { fields: 'id,name,access_token,category,fan_count,followers_count' }
    );

    return response.data || [];
  }

  /**
   * Get Instagram Business Account connected to a Page
   */
  async getInstagramAccount(pageId: string): Promise<MetaInstagramAccount | null> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    const response = await this.makeRequest<{ instagram_business_account?: MetaInstagramAccount }>(
      `/${pageId}`,
      {
        fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}',
      }
    );

    return response.instagram_business_account || null;
  }

  /**
   * Publish a post to Facebook Page
   */
  async publishFacebookPost(
    pageId: string,
    pageAccessToken: string,
    content: {
      message: string;
      link?: string;
      media_urls?: string[];
      scheduled_publish_time?: number; // Unix timestamp
      published?: boolean;
    }
  ): Promise<MetaPostResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      message: content.message,
      access_token: pageAccessToken,
    };

    if (content.link) {
      params.link = content.link;
    }

    if (content.scheduled_publish_time) {
      params.scheduled_publish_time = content.scheduled_publish_time;
      params.published = false;
    } else {
      params.published = content.published !== false;
    }

    // Handle media
    if (content.media_urls && content.media_urls.length > 0) {
      if (content.media_urls.length === 1) {
        // Single photo/video
        const mediaUrl = content.media_urls[0];
        if (this.isVideoUrl(mediaUrl)) {
          params.file_url = mediaUrl;
          const response = await fetch(`${this.baseUrl}/${pageId}/videos`, {
            method: 'POST',
            body: new URLSearchParams(params),
          });
          return await this.handleResponse<MetaPostResponse>(response);
        } else {
          params.url = mediaUrl;
          const response = await fetch(`${this.baseUrl}/${pageId}/photos`, {
            method: 'POST',
            body: new URLSearchParams(params),
          });
          return await this.handleResponse<MetaPostResponse>(response);
        }
      } else {
        // Multiple photos - create album
        return await this.publishPhotoAlbum(pageId, pageAccessToken, content.message, content.media_urls);
      }
    }

    // Text-only post
    const response = await fetch(`${this.baseUrl}/${pageId}/feed`, {
      method: 'POST',
      body: new URLSearchParams(params),
    });

    return await this.handleResponse<MetaPostResponse>(response);
  }

  /**
   * Publish multiple photos as an album
   */
  private async publishPhotoAlbum(
    pageId: string,
    pageAccessToken: string,
    message: string,
    photoUrls: string[]
  ): Promise<MetaPostResponse> {
    // First, upload all photos and get their IDs
    const photoIds: string[] = [];

    for (const url of photoUrls) {
      const params = new URLSearchParams({
        url,
        published: 'false', // Don&apos;t publish individual photos
        access_token: pageAccessToken,
      });

      const response = await fetch(`${this.baseUrl}/${pageId}/photos`, {
        method: 'POST',
        body: params,
      });

      const data = await this.handleResponse<{ id: string }>(response);
      photoIds.push(data.id);
    }

    // Create the album post with all photos
    const params = new URLSearchParams({
      message,
      attached_media: JSON.stringify(photoIds.map(id => ({ media_fbid: id }))),
      access_token: pageAccessToken,
    });

    const response = await fetch(`${this.baseUrl}/${pageId}/feed`, {
      method: 'POST',
      body: params,
    });

    return await this.handleResponse<MetaPostResponse>(response);
  }

  /**
   * Publish a post to Instagram
   */
  async publishInstagramPost(
    instagramAccountId: string,
    content: {
      image_url?: string;
      video_url?: string;
      caption?: string;
      is_carousel?: boolean;
      children?: string[]; // Media container IDs for carousel
      cover_url?: string; // For video thumbnails
    }
  ): Promise<{ id: string; permalink?: string }> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    // Step 1: Create media container
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const containerParams: Record<string, any> = {
      access_token: this.accessToken,
    };

    if (content.is_carousel && content.children) {
      containerParams.media_type = 'CAROUSEL';
      containerParams.children = content.children.join(',');
      if (content.caption) {
        containerParams.caption = content.caption;
      }
    } else if (content.video_url) {
      containerParams.media_type = 'VIDEO';
      containerParams.video_url = content.video_url;
      if (content.caption) {
        containerParams.caption = content.caption;
      }
      if (content.cover_url) {
        containerParams.thumb_offset = 0; // Use first frame or provide offset
      }
    } else if (content.image_url) {
      containerParams.image_url = content.image_url;
      if (content.caption) {
        containerParams.caption = content.caption;
      }
    } else {
      throw new Error('Either image_url, video_url, or carousel children required');
    }

    // Create container
    const containerResponse = await fetch(
      `${this.baseUrl}/${instagramAccountId}/media?${new URLSearchParams(containerParams).toString()}`,
      { method: 'POST' }
    );

    const containerData = await this.handleResponse<{ id: string }>(containerResponse);

    // Step 2: Publish the media container
    const publishParams = new URLSearchParams({
      creation_id: containerData.id,
      access_token: this.accessToken,
    });

    const publishResponse = await fetch(
      `${this.baseUrl}/${instagramAccountId}/media_publish?${publishParams.toString()}`,
      { method: 'POST' }
    );

    return await this.handleResponse<{ id: string; permalink?: string }>(publishResponse);
  }

  /**
   * Create Instagram carousel item (for multi-photo posts)
   */
  async createInstagramCarouselItem(
    instagramAccountId: string,
    mediaUrl: string,
    isVideo: boolean = false
  ): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    const params = new URLSearchParams({
      access_token: this.accessToken,
      is_carousel_item: 'true',
    });

    if (isVideo) {
      params.append('media_type', 'VIDEO');
      params.append('video_url', mediaUrl);
    } else {
      params.append('image_url', mediaUrl);
    }

    const response = await fetch(
      `${this.baseUrl}/${instagramAccountId}/media?${params.toString()}`,
      { method: 'POST' }
    );

    const data = await this.handleResponse<{ id: string }>(response);
    return data.id;
  }

  /**
   * Get Facebook Page insights
   */
  async getPageInsights(
    pageId: string,
    pageAccessToken: string,
    metrics: string[] = [
      'page_impressions',
      'page_engaged_users',
      'page_post_engagements',
      'page_fans',
      'page_views_total',
    ],
    period: 'day' | 'week' | 'days_28' = 'day',
    since?: Date,
    until?: Date
  ): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      metric: metrics.join(','),
      period,
      access_token: pageAccessToken,
    };

    if (since) {
      params.since = Math.floor(since.getTime() / 1000);
    }

    if (until) {
      params.until = Math.floor(until.getTime() / 1000);
    }

    const response = await this.makeRequest<MetaAPIResponse>(
      `/${pageId}/insights`,
      params
    );

    return response.data || [];
  }

  /**
   * Get Facebook post insights
   */
  async getPostInsights(
    postId: string,
    accessToken: string,
    metrics: string[] = [
      'post_impressions',
      'post_engaged_users',
      'post_clicks',
      'post_reactions_like_total',
      'post_comments',
      'post_shares',
    ]
  ): Promise<unknown[]> {
    const params = {
      metric: metrics.join(','),
      access_token: accessToken,
    };

    const response = await this.makeRequest<MetaAPIResponse>(
      `/${postId}/insights`,
      params
    );

    return response.data || [];
  }

  /**
   * Get Instagram account insights
   */
  async getInstagramInsights(
    instagramAccountId: string,
    metrics: string[] = [
      'impressions',
      'reach',
      'follower_count',
      'profile_views',
    ],
    period: 'day' | 'week' | 'days_28' | 'lifetime' = 'day',
    since?: Date,
    until?: Date
  ): Promise<unknown[]> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      metric: metrics.join(','),
      period,
      access_token: this.accessToken,
    };

    if (since && period !== 'lifetime') {
      params.since = Math.floor(since.getTime() / 1000);
    }

    if (until && period !== 'lifetime') {
      params.until = Math.floor(until.getTime() / 1000);
    }

    const response = await this.makeRequest<MetaAPIResponse>(
      `/${instagramAccountId}/insights`,
      params
    );

    return response.data || [];
  }

  /**
   * Get Instagram media insights
   */
  async getInstagramMediaInsights(
    mediaId: string,
    metrics: string[] = [
      'engagement',
      'impressions',
      'reach',
      'saved',
    ]
  ): Promise<unknown[]> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    const params = {
      metric: metrics.join(','),
      access_token: this.accessToken,
    };

    const response = await this.makeRequest<MetaAPIResponse>(
      `/${mediaId}/insights`,
      params
    );

    return response.data || [];
  }

  /**
   * Delete a Facebook post
   */
  async deletePost(postId: string, accessToken: string): Promise<{ success: boolean }> {
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    const response = await fetch(`${this.baseUrl}/${postId}?${params.toString()}`, {
      method: 'DELETE',
    });

    return await this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Get rate limit information from response headers
   */
  private extractRateLimitInfo(headers: Headers): MetaRateLimit | undefined {
    const usage = headers.get('x-business-use-case-usage');
    if (!usage) return undefined;

    try {
      const parsed = JSON.parse(usage);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appUsage = Object.values(parsed)[0] as any;
      
      this.rateLimitInfo = {
        call_count: appUsage.call_count || 0,
        total_time: appUsage.total_time || 0,
        total_cputime: appUsage.total_cputime || 0,
      };

      return this.rateLimitInfo;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if we&apos;re approaching rate limits
   */
  isApproachingRateLimit(): boolean {
    if (!this.rateLimitInfo) return false;
    
    // Meta uses a sliding window with thresholds at 75% and 100%
    // Warn if we&apos;re above 75% on any metric
    return (
      this.rateLimitInfo.call_count > 75 ||
      this.rateLimitInfo.total_time > 75 ||
      this.rateLimitInfo.total_cputime > 75
    );
  }

  /**
   * Get current rate limit status
   */
  getRateLimitInfo(): MetaRateLimit | undefined {
    return this.rateLimitInfo;
  }

  /**
   * Make authenticated request to Graph API
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const queryParams = new URLSearchParams({
      ...params,
      access_token: this.accessToken || params.access_token,
    } as Record<string, string>);

    const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`;
    const response = await fetch(url);

    // Extract rate limit info from headers
    this.extractRateLimitInfo(response.headers);

    return await this.handleResponse<T>(response);
  }

  /**
   * Handle API response and errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Extract rate limit info
    this.extractRateLimitInfo(response.headers);

    const data = await response.json();

    if (data.error) {
      const error = data.error as MetaError;
      throw new Error(
        `Meta API Error (${error.code}): ${error.message} [${error.fbtrace_id}]`
      );
    }

    if (!response.ok) {
      throw new Error(`Meta API request failed: ${response.statusText}`);
    }

    return data;
  }

  /**
   * Check if URL is a video
   */
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
  }

  /**
   * Validate access token
   */
  async validateToken(token: string): Promise<{
    is_valid: boolean;
    user_id?: string;
    app_id?: string;
    expires_at?: number;
    scopes?: string[];
  }> {
    const params = new URLSearchParams({
      input_token: token,
      access_token: `${this.appId}|${this.appSecret}`,
    });

    const response = await fetch(`${this.baseUrl}/debug_token?${params.toString()}`);
    const result = await this.handleResponse<MetaAPIResponse>(response);

    return result.data || { is_valid: false };
  }
}

/**
 * Helper function to create Meta API client from environment variables
 */
export function createMetaClient(accessToken?: string): MetaAPIClient {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET environment variables required');
  }

  return new MetaAPIClient(appId, appSecret, accessToken);
}

/**
 * Helper to format Meta insights data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatMetaInsights(insights: any[]): Record<string, number> {
  const formatted: Record<string, number> = {};

  for (const insight of insights) {
    const metric = insight.name;
    const values = insight.values || [];
    
    if (values.length > 0) {
      // Get the most recent value
      const latestValue = values[values.length - 1];
      formatted[metric] = latestValue.value || 0;
    }
  }

  return formatted;
}

/**
 * Calculate engagement rate from insights
 */
export function calculateEngagementRate(
  engagedUsers: number,
  impressions: number
): number {
  if (impressions === 0) return 0;
  return (engagedUsers / impressions) * 100;
}

export default MetaAPIClient;

