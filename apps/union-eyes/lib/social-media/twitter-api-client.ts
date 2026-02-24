/**
 * Twitter API v2 Client - Phase 10
 * 
 * Handles Twitter integration using OAuth 2.0 and API v2.
 * Supports tweet posting, media upload, thread creation, analytics,
 * and rate limit management.
 * 
 * @see https://developer.twitter.com/en/docs/twitter-api
 */

import { createHash, randomBytes } from 'crypto';

// Types for Twitter API v2 responses
export interface TwitterOAuthTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope: string;
  refresh_token?: string;
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  created_at?: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified?: boolean;
  verified_type?: string;
  protected?: boolean;
}

export interface TwitterTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }>;
  attachments?: {
    media_keys?: string[];
    poll_ids?: string[];
  };
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count?: number;
    impression_count?: number;
  };
  non_public_metrics?: {
    impression_count: number;
    url_link_clicks?: number;
    user_profile_clicks?: number;
  };
  organic_metrics?: {
    impression_count: number;
    like_count: number;
    reply_count: number;
    retweet_count: number;
    url_link_clicks?: number;
    user_profile_clicks?: number;
  };
  promoted_metrics?: {
    impression_count: number;
    like_count: number;
    reply_count: number;
    retweet_count: number;
  };
}

export interface TwitterMedia {
  media_id: string;
  media_id_string: string;
  size: number;
  expires_after_secs: number;
  media_key?: string;
}

export interface TwitterMediaV2 {
  media_key: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  duration_ms?: number;
  height?: number;
  width?: number;
  preview_image_url?: string;
  public_metrics?: {
    view_count?: number;
  };
  alt_text?: string;
}

export interface TwitterRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

export interface TwitterError {
  title: string;
  detail: string;
  type: string;
  status?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TwitterAPIResponse<T = any> {
  data?: T;
  errors?: TwitterError[];
  meta?: {
    result_count?: number;
    next_token?: string;
    previous_token?: string;
  };
  includes?: {
    users?: TwitterUser[];
    tweets?: TwitterTweet[];
    media?: TwitterMediaV2[];
  };
}

/**
 * Twitter API v2 Client
 * 
 * Handles all interactions with Twitter API using OAuth 2.0
 */
export class TwitterAPIClient {
  private readonly baseUrl = 'https://api.twitter.com/2';
  private readonly uploadUrl = 'https://upload.twitter.com/1.1';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken?: string;
  private refreshToken?: string;
  private rateLimits: Map<string, TwitterRateLimit> = new Map();

  constructor(clientId: string, clientSecret: string, accessToken?: string, refreshToken?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Generate OAuth 2.0 authorization URL with PKCE
   */
  getAuthorizationUrl(
    redirectUri: string,
    scope: string[],
    state: string,
    codeChallenge: string
  ): string {
    const scopeString = scope.join(' ');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopeString,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<TwitterOAuthTokenResponse> {
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    const data = await this.handleResponse<TwitterOAuthTokenResponse>(response);
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    return data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<TwitterOAuthTokenResponse> {
    if (!this.refreshToken) {
      throw new Error('Refresh token required');
    }

    const params = new URLSearchParams({
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
      client_id: this.clientId,
    });

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    const data = await this.handleResponse<TwitterOAuthTokenResponse>(response);
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    return data;
  }

  /**
   * Revoke access token
   */
  async revokeToken(token?: string): Promise<void> {
    const tokenToRevoke = token || this.accessToken;
    if (!tokenToRevoke) {
      throw new Error('Token required');
    }

    const params = new URLSearchParams({
      token: tokenToRevoke,
      token_type_hint: 'access_token',
      client_id: this.clientId,
    });

    await fetch('https://api.twitter.com/2/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    this.accessToken = undefined;
    this.refreshToken = undefined;
  }

  /**
   * Get authenticated user
   */
  async getMe(): Promise<TwitterUser> {
    const response = await this.makeRequest<TwitterAPIResponse<TwitterUser>>(
      '/users/me',
      {
        'user.fields': 'created_at,description,profile_image_url,public_metrics,verified,verified_type',
      }
    );

    if (!response.data) {
      throw new Error('Failed to fetch user data');
    }

    return response.data;
  }

  /**
   * Post a tweet
   */
  async postTweet(content: {
    text: string;
    media_ids?: string[];
    reply_to?: string;
    quote_tweet_id?: string;
    poll?: {
      options: string[];
      duration_minutes: number;
    };
  }): Promise<TwitterTweet> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      text: content.text,
    };

    if (content.media_ids && content.media_ids.length > 0) {
      body.media = {
        media_ids: content.media_ids,
      };
    }

    if (content.reply_to) {
      body.reply = {
        in_reply_to_tweet_id: content.reply_to,
      };
    }

    if (content.quote_tweet_id) {
      body.quote_tweet_id = content.quote_tweet_id;
    }

    if (content.poll) {
      body.poll = {
        options: content.poll.options,
        duration_minutes: content.poll.duration_minutes,
      };
    }

    const response = await this.makeRequest<TwitterAPIResponse<TwitterTweet>>(
      '/tweets',
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    if (!response.data) {
      throw new Error('Failed to post tweet');
    }

    return response.data;
  }

  /**
   * Post a thread (multiple tweets)
   */
  async postThread(tweets: string[]): Promise<TwitterTweet[]> {
    const postedTweets: TwitterTweet[] = [];
    let previousTweetId: string | undefined;

    for (const text of tweets) {
      const tweet = await this.postTweet({
        text,
        reply_to: previousTweetId,
      });

      postedTweets.push(tweet);
      previousTweetId = tweet.id;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return postedTweets;
  }

  /**
   * Upload media (image or video)
   */
  async uploadMedia(
    mediaData: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4',
    altText?: string
  ): Promise<TwitterMedia> {
    // For v1.1 media upload endpoint (still used for media)
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(mediaData)], { type: mediaType });
    formData.append('media', blob);

    if (altText) {
      formData.append('media_category', 'tweet_image');
    }

    const response = await fetch(`${this.uploadUrl}/media/upload.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    const media = await this.handleResponse<TwitterMedia>(response);

    // Add alt text if provided
    if (altText && media.media_id_string) {
      await this.addAltText(media.media_id_string, altText);
    }

    return media;
  }

  /**
   * Upload media in chunks (for large files)
   */
  async uploadMediaChunked(
    mediaData: Buffer,
    mediaType: 'video/mp4' | 'image/gif',
    mediaCategory: 'tweet_video' | 'tweet_gif' = 'tweet_video'
  ): Promise<TwitterMedia> {
    // Step 1: INIT
    const initParams = new URLSearchParams({
      command: 'INIT',
      total_bytes: mediaData.length.toString(),
      media_type: mediaType,
      media_category: mediaCategory,
    });

    const initResponse = await fetch(`${this.uploadUrl}/media/upload.json?${initParams.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const initData = await this.handleResponse<TwitterMedia>(initResponse);
    const mediaId = initData.media_id_string;

    // Step 2: APPEND (upload in 5MB chunks)
    const chunkSize = 5 * 1024 * 1024; // 5MB
    let segmentIndex = 0;

    for (let i = 0; i < mediaData.length; i += chunkSize) {
      const chunk = mediaData.slice(i, Math.min(i + chunkSize, mediaData.length));
      const formData = new FormData();
      formData.append('command', 'APPEND');
      formData.append('media_id', mediaId);
      formData.append('segment_index', segmentIndex.toString());
      formData.append('media', new Blob([chunk]));

      await fetch(`${this.uploadUrl}/media/upload.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: formData,
      });

      segmentIndex++;
    }

    // Step 3: FINALIZE
    const finalizeParams = new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    });

    const finalizeResponse = await fetch(`${this.uploadUrl}/media/upload.json?${finalizeParams.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const finalizeData = await this.handleResponse<TwitterMedia>(finalizeResponse);

    // Step 4: Check processing status (for videos)
    if (mediaType === 'video/mp4') {
      await this.waitForMediaProcessing(mediaId);
    }

    return finalizeData;
  }

  /**
   * Wait for media processing to complete
   */
  private async waitForMediaProcessing(mediaId: string, maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const statusParams = new URLSearchParams({
        command: 'STATUS',
        media_id: mediaId,
      });

      const response = await fetch(`${this.uploadUrl}/media/upload.json?${statusParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = await this.handleResponse<any>(response);

      if (status.processing_info?.state === 'succeeded') {
        return;
      }

      if (status.processing_info?.state === 'failed') {
        throw new Error(`Media processing failed: ${status.processing_info.error?.message}`);
      }

      // Wait before checking again
      const checkAfterSecs = status.processing_info?.check_after_secs || 5;
      await new Promise(resolve => setTimeout(resolve, checkAfterSecs * 1000));
    }

    throw new Error('Media processing timeout');
  }

  /**
   * Add alt text to media
   */
  async addAltText(mediaId: string, altText: string): Promise<void> {
    const body = {
      media_id: mediaId,
      alt_text: {
        text: altText.substring(0, 1000), // Max 1000 characters
      },
    };

    await fetch(`${this.uploadUrl}/media/metadata/create.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Delete a tweet
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    const response = await this.makeRequest<TwitterAPIResponse<{ deleted: boolean }>>(
      `/tweets/${tweetId}`,
      {},
      { method: 'DELETE' }
    );

    return response.data?.deleted || false;
  }

  /**
   * Get tweet by ID
   */
  async getTweet(
    tweetId: string,
    includeMetrics: boolean = true
  ): Promise<TwitterTweet> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
    };

    if (includeMetrics) {
      params['tweet.fields'] += ',non_public_metrics,organic_metrics';
    }

    const response = await this.makeRequest<TwitterAPIResponse<TwitterTweet>>(
      `/tweets/${tweetId}`,
      params
    );

    if (!response.data) {
      throw new Error('Tweet not found');
    }

    return response.data;
  }

  /**
   * Get user's tweets
   */
  async getUserTweets(
    userId: string,
    maxResults: number = 10,
    paginationToken?: string
  ): Promise<{ tweets: TwitterTweet[]; nextToken?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {
      max_results: Math.min(maxResults, 100).toString(),
      'tweet.fields': 'created_at,public_metrics,attachments',
      'media.fields': 'url,preview_image_url,type',
      expansions: 'attachments.media_keys',
    };

    if (paginationToken) {
      params.pagination_token = paginationToken;
    }

    const response = await this.makeRequest<TwitterAPIResponse<TwitterTweet[]>>(
      `/users/${userId}/tweets`,
      params
    );

    return {
      tweets: response.data || [],
      nextToken: response.meta?.next_token,
    };
  }

  /**
   * Get tweet analytics (organic and promoted metrics)
   */
  async getTweetAnalytics(tweetId: string): Promise<TwitterTweet> {
    const params = {
      'tweet.fields': 'public_metrics,non_public_metrics,organic_metrics,promoted_metrics',
    };

    const response = await this.makeRequest<TwitterAPIResponse<TwitterTweet>>(
      `/tweets/${tweetId}`,
      params
    );

    if (!response.data) {
      throw new Error('Tweet not found');
    }

    return response.data;
  }

  /**
   * Like a tweet
   */
  async likeTweet(userId: string, tweetId: string): Promise<boolean> {
    const body = {
      tweet_id: tweetId,
    };

    const response = await this.makeRequest<TwitterAPIResponse<{ liked: boolean }>>(
      `/users/${userId}/likes`,
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return response.data?.liked || false;
  }

  /**
   * Retweet a tweet
   */
  async retweet(userId: string, tweetId: string): Promise<boolean> {
    const body = {
      tweet_id: tweetId,
    };

    const response = await this.makeRequest<TwitterAPIResponse<{ retweeted: boolean }>>(
      `/users/${userId}/retweets`,
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return response.data?.retweeted || false;
  }

  /**
   * Get rate limit for specific endpoint
   */
  getRateLimit(endpoint: string): TwitterRateLimit | undefined {
    return this.rateLimits.get(endpoint);
  }

  /**
   * Check if approaching rate limit for endpoint
   */
  isApproachingRateLimit(endpoint: string, threshold: number = 0.1): boolean {
    const rateLimit = this.rateLimits.get(endpoint);
    if (!rateLimit) return false;

    const ratio = rateLimit.remaining / rateLimit.limit;
    return ratio < threshold;
  }

  /**
   * Get time until rate limit reset
   */
  getTimeUntilReset(endpoint: string): number {
    const rateLimit = this.rateLimits.get(endpoint);
    if (!rateLimit) return 0;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, rateLimit.reset - now);
  }

  /**
   * Make authenticated request to Twitter API
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Access token required');
    }

    const queryParams = new URLSearchParams(params as Record<string, string>);
    const url = `${this.baseUrl}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Extract rate limit info from headers
    this.extractRateLimitInfo(endpoint, response.headers);

    return await this.handleResponse<T>(response);
  }

  /**
   * Extract rate limit information from response headers
   */
  private extractRateLimitInfo(endpoint: string, headers: Headers): void {
    const limit = headers.get('x-rate-limit-limit');
    const remaining = headers.get('x-rate-limit-remaining');
    const reset = headers.get('x-rate-limit-reset');

    if (limit && remaining && reset) {
      this.rateLimits.set(endpoint, {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset),
      });
    }
  }

  /**
   * Handle API response and errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json().catch(() => ({}));

    if (data.errors && Array.isArray(data.errors)) {
      const error = data.errors[0] as TwitterError;
      throw new Error(`Twitter API Error: ${error.title} - ${error.detail}`);
    }

    if (!response.ok) {
      throw new Error(`Twitter API request failed: ${response.statusText}`);
    }

    return data;
  }
}

/**
 * Helper function to create Twitter API client from environment variables
 */
export function createTwitterClient(accessToken?: string, refreshToken?: string): TwitterAPIClient {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET environment variables required');
  }

  return new TwitterAPIClient(clientId, clientSecret, accessToken, refreshToken);
}

/**
 * Generate PKCE code verifier and challenge for OAuth
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  // Generate random code verifier (43-128 characters)
  const verifier = generateRandomString(128);

  // Create SHA-256 hash of verifier
  const hash = createHash('sha256').update(verifier).digest();

  // Base64 URL encode the hash
  const challenge = base64UrlEncode(hash.buffer);

  return { verifier, challenge };
}

/**
 * Generate random string for PKCE
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }

  return result;
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Calculate tweet engagement rate
 */
export function calculateTweetEngagementRate(tweet: TwitterTweet): number {
  if (!tweet.public_metrics || !tweet.non_public_metrics) {
    return 0;
  }

  const engagements = 
    tweet.public_metrics.like_count +
    tweet.public_metrics.retweet_count +
    tweet.public_metrics.reply_count +
    tweet.public_metrics.quote_count;

  const impressions = tweet.non_public_metrics.impression_count;

  if (impressions === 0) return 0;

  return (engagements / impressions) * 100;
}

export default TwitterAPIClient;

