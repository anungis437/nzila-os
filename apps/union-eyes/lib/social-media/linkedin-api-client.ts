/**
 * LinkedIn API Client - Phase 10
 * 
 * Handles LinkedIn integration using OAuth 2.0.
 * Supports organization posting, share creation, analytics,
 * and rate limit management.
 * 
 * @see https://learn.microsoft.com/en-us/linkedin/
 */

// Types for LinkedIn API responses
export interface LinkedInOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  profilePicture?: {
    displayImage: string;
  };
  vanityName?: string;
}

export interface LinkedInOrganization {
  id: string;
  localizedName: string;
  vanityName?: string;
  logoV2?: {
    original: string;
  };
  localizedDescription?: string;
  localizedWebsite?: string;
  staffCount?: number;
  followerCount?: number;
  role?: string;
  state?: string;
  website?: string;
  industries?: string[];
}

export interface LinkedInShare {
  id: string;
  author: string;
  created: {
    time: number;
  };
  text?: {
    text: string;
  };
  content?: {
    contentEntities: Array<{
      entityLocation: string;
      thumbnails?: Array<{
        resolvedUrl: string;
      }>;
    }>;
  };
  commentary?: string;
  lifecycleState: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' | 'CONNECTIONS';
  };
}

export interface LinkedInShareStatistics {
  totalShareStatistics: {
    uniqueImpressionsCount: number;
    clickCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    engagement: number;
  };
  organizationalEntity?: string;
  share: string;
}

export interface LinkedInAnalytics {
  elements: Array<{
    organizationalEntity: string;
    timeRange: {
      start: number;
      end: number;
    };
    totalPageStatistics: {
      views: {
        allPageViews: {
          pageViews: number;
        };
        uniquePageViews: {
          pageViews: number;
        };
      };
      clicks: {
        mobileCareersPageClicks: {
          careersPageClicks: number;
        };
      };
    };
  }>;
}

export interface LinkedInFollowerStatistics {
  elements: Array<{
    organizationalEntity: string;
    followerGains: {
      organicFollowerGain: number;
      paidFollowerGain: number;
    };
  }>;
}

export interface LinkedInError {
  serviceErrorCode: number;
  message: string;
  status: number;
}

/**
 * LinkedIn API Client
 * 
 * Handles all interactions with LinkedIn API using OAuth 2.0
 */
export class LinkedInAPIClient {
  private readonly baseUrl = 'https://api.linkedin.com/v2';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken?: string;
  private rateLimitRemaining?: number;
  private rateLimitReset?: number;

  constructor(clientId: string, clientSecret: string, accessToken?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, scope: string[], state: string): string {
    const scopeString = scope.join(' ');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: scopeString,
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string, redirectUri: string): Promise<LinkedInOAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await this.handleResponse<LinkedInOAuthTokenResponse>(response);
    this.accessToken = data.access_token;

    return data;
  }

  /**
   * Refresh access token (if refresh token is available)
   */
  async refreshAccessToken(refreshToken: string): Promise<LinkedInOAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await this.handleResponse<LinkedInOAuthTokenResponse>(response);
    this.accessToken = data.access_token;

    return data;
  }

  /**
   * Get authenticated user profile
   */
  async getProfile(): Promise<LinkedInProfile> {
    const response = await this.makeRequest<LinkedInProfile>(
      '/me',
      {
        projection: '(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams),vanityName)',
      }
    );

    return response;
  }

  /**
   * Get organizations that user can post as
   */
  async getOrganizations(): Promise<LinkedInOrganization[]> {
    const response = await this.makeRequest<{ elements: LinkedInOrganization[] }>(
      '/organizationAcls',
      {
        q: 'roleAssignee',
        projection: '(elements*(organization~(id,localizedName,vanityName,logoV2(original~:playableStreams))))',
      }
    );

    // Extract organizations from nested structure
    const orgs: LinkedInOrganization[] = [];
    for (const element of response.elements || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (element as any)['organization~'];
      if (org) {
        orgs.push(org as LinkedInOrganization);
      }
    }

    return orgs;
  }

  /**
   * Get organization details
   */
  async getOrganization(organizationId: string): Promise<LinkedInOrganization> {
    const response = await this.makeRequest<LinkedInOrganization>(
      `/organizations/${organizationId}`,
      {
        projection: '(id,localizedName,vanityName,logoV2(original~:playableStreams),localizedDescription,localizedWebsite,staffCount,followerCount)',
      }
    );

    return response;
  }

  /**
   * Create a text post for an organization
   */
  async createOrganizationPost(
    organizationId: string,
    content: {
      text: string;
      visibility?: 'PUBLIC' | 'CONNECTIONS';
    }
  ): Promise<LinkedInShare> {
    const body = {
      author: `urn:li:organization:${organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': content.visibility || 'PUBLIC',
      },
    };

    const response = await this.makeRequest<LinkedInShare>(
      '/ugcPosts',
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return response;
  }

  /**
   * Create a post with an image for an organization
   */
  async createOrganizationPostWithImage(
    organizationId: string,
    content: {
      text: string;
      imageUrl: string;
      visibility?: 'PUBLIC' | 'CONNECTIONS';
    }
  ): Promise<LinkedInShare> {
    // First, register the image upload
    const uploadData = await this.registerImageUpload(organizationId);

    // Upload the image
    await this.uploadImage(uploadData.uploadUrl, content.imageUrl);

    // Create the post with the image
    const body = {
      author: `urn:li:organization:${organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.text,
          },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              description: {
                text: content.text,
              },
              media: uploadData.asset,
              title: {
                text: 'Image',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': content.visibility || 'PUBLIC',
      },
    };

    const response = await this.makeRequest<LinkedInShare>(
      '/ugcPosts',
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return response;
  }

  /**
   * Create a post with a link for an organization
   */
  async createOrganizationPostWithLink(
    organizationId: string,
    content: {
      text: string;
      linkUrl: string;
      linkTitle?: string;
      linkDescription?: string;
      visibility?: 'PUBLIC' | 'CONNECTIONS';
    }
  ): Promise<LinkedInShare> {
    const body = {
      author: `urn:li:organization:${organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.text,
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: content.linkUrl,
              title: {
                text: content.linkTitle || content.linkUrl,
              },
              description: {
                text: content.linkDescription || '',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': content.visibility || 'PUBLIC',
      },
    };

    const response = await this.makeRequest<LinkedInShare>(
      '/ugcPosts',
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return response;
  }

  /**
   * Register an image upload
   */
  private async registerImageUpload(organizationId: string): Promise<{
    asset: string;
    uploadUrl: string;
  }> {
    const body = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:organization:${organizationId}`,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.makeRequest<any>(
      '/assets?action=registerUpload',
      {},
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return {
      asset: response.value.asset,
      uploadUrl: response.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
        .uploadUrl,
    };
  }

  /**
   * Upload an image to LinkedIn
   */
  private async uploadImage(uploadUrl: string, imageUrl: string): Promise<void> {
    // Validate image URL to prevent SSRF
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Blocked image URL scheme: ${parsed.protocol}`);
    }
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'metadata.google.internal'];
    if (blockedHosts.includes(parsed.hostname)) {
      throw new Error(`Blocked image URL host: ${parsed.hostname}`);
    }
    // Block private IP ranges
    const ipMatch = parsed.hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (a === 10 || a === 127 || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
        throw new Error(`Blocked private IP in image URL: ${parsed.hostname}`);
      }
    }

    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to LinkedIn
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: imageBuffer,
    });
  }

  /**
   * Delete a post
   */
  async deletePost(shareId: string): Promise<void> {
    await this.makeRequest<void>(`/ugcPosts/${shareId}`, {}, { method: 'DELETE' });
  }

  /**
   * Get post statistics
   */
  async getPostStatistics(shareId: string): Promise<LinkedInShareStatistics> {
    const response = await this.makeRequest<LinkedInShareStatistics>(
      `/organizationalEntityShareStatistics`,
      {
        q: 'share',
        share: shareId,
      }
    );

    return response;
  }

  /**
   * Get organization page statistics
   */
  async getOrganizationStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LinkedInAnalytics> {
    const params = {
      q: 'organizationalEntity',
      organizationalEntity: `urn:li:organization:${organizationId}`,
      timeIntervals: `(timeRange:(start:${startDate.getTime()},end:${endDate.getTime()}))`,
    };

    const response = await this.makeRequest<LinkedInAnalytics>(
      '/organizationPageStatistics',
      params
    );

    return response;
  }

  /**
   * Get follower statistics
   */
  async getFollowerStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LinkedInFollowerStatistics> {
    const params = {
      q: 'organizationalEntity',
      organizationalEntity: `urn:li:organization:${organizationId}`,
      timeIntervals: `(timeGranularityType:DAY,timeRange:(start:${startDate.getTime()},end:${endDate.getTime()}))`,
    };

    const response = await this.makeRequest<LinkedInFollowerStatistics>(
      '/organizationalEntityFollowerStatistics',
      params
    );

    return response;
  }

  /**
   * Get organization shares (posts)
   */
  async getOrganizationShares(
    organizationId: string,
    count: number = 20,
    start: number = 0
  ): Promise<{ elements: LinkedInShare[]; paging: unknown }> {
    const response = await this.makeRequest<{ elements: LinkedInShare[]; paging: unknown }>(
      '/ugcPosts',
      {
        q: 'authors',
        authors: `List(urn:li:organization:${organizationId})`,
        count: count.toString(),
        start: start.toString(),
      }
    );

    return response;
  }

  /**
   * Check rate limit status
   */
  getRateLimitInfo(): { remaining?: number; reset?: number } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset,
    };
  }

  /**
   * Check if approaching rate limit
   */
  isApproachingRateLimit(threshold: number = 0.1): boolean {
    if (!this.rateLimitRemaining) return false;
    // LinkedIn doesn&apos;t publish exact limits, but typically ~500 requests per user per day
    // Assume 500 as baseline
    const estimatedLimit = 500;
    const ratio = this.rateLimitRemaining / estimatedLimit;
    return ratio < threshold;
  }

  /**
   * Make authenticated request to LinkedIn API
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
        'X-Restli-Protocol-Version': '2.0.0',
        ...options.headers,
      },
    });

    // Extract rate limit info from headers
    this.extractRateLimitInfo(response.headers);

    return await this.handleResponse<T>(response);
  }

  /**
   * Extract rate limit information from response headers
   */
  private extractRateLimitInfo(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining);
    }

    if (reset) {
      this.rateLimitReset = parseInt(reset);
    }
  }

  /**
   * Handle API response and errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      // No content
      return {} as T;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = data as LinkedInError;
      throw new Error(
        `LinkedIn API Error (${error.serviceErrorCode || response.status}): ${
          error.message || response.statusText
        }`
      );
    }

    return data;
  }
}

/**
 * Helper function to create LinkedIn API client from environment variables
 */
export function createLinkedInClient(accessToken?: string): LinkedInAPIClient {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables required');
  }

  return new LinkedInAPIClient(clientId, clientSecret, accessToken);
}

/**
 * Calculate engagement rate from LinkedIn statistics
 */
export function calculateLinkedInEngagementRate(stats: LinkedInShareStatistics): number {
  const total = stats.totalShareStatistics;
  const engagements =
    total.likeCount + total.commentCount + total.shareCount + total.clickCount;
  const impressions = total.uniqueImpressionsCount;

  if (impressions === 0) return 0;

  return (engagements / impressions) * 100;
}

/**
 * Format LinkedIn URN to ID
 */
export function extractIdFromUrn(urn: string): string {
  const parts = urn.split(':');
  return parts[parts.length - 1];
}

/**
 * Format ID to LinkedIn URN
 */
export function formatAsUrn(type: 'organization' | 'person' | 'share', id: string): string {
  return `urn:li:${type}:${id}`;
}

export default LinkedInAPIClient;

