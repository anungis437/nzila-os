/**
 * SharePoint API Client
 * 
 * Provides communication with Microsoft Graph API for SharePoint document data
 * including sites, document libraries, files, and permissions.
 * 
 * API Reference: https://docs.microsoft.com/en-us/graph/api/resources/sharepoint
 * Rate Limits: 2000 requests per app per mailbox per minute
 * Authentication: OAuth2 with Microsoft identity platform
 */

 
import type {
  IntegrationError,
  RateLimitError as _RateLimitError,
  AuthenticationError,
} from '../../types';

interface SharePointConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  siteUrl?: string;
  apiUrl?: string;
}

interface SharePointAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SharePointSite {
  id: string;
  displayName: string;
  name: string;
  description?: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export interface SharePointLibrary {
  id: string;
  name: string;
  description?: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  driveType: string;
  createdBy?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
}

export interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  createdBy?: {
    user?: {
      id: string;
      displayName: string;
      email?: string;
    };
  };
  lastModifiedBy?: {
    user?: {
      id: string;
      displayName: string;
      email?: string;
    };
  };
  parentReference?: {
    driveId: string;
    path: string;
  };
}

export interface SharePointPermission {
  id: string;
  roles: string[];
  grantedToIdentitiesV2?: Array<{
    user?: {
      id: string;
      displayName: string;
      email?: string;
    };
    group?: {
      id: string;
      displayName: string;
    };
  }>;
  link?: {
    type: string;
    scope: string;
    webUrl: string;
  };
}

export class SharePointClient {
  private config: SharePointConfig;
  private readonly baseUrl: string;
  private readonly authUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: SharePointConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://graph.microsoft.com/v1.0';
    this.authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  }

  /**
   * Authenticate and get access token
   */
  private async authenticate(): Promise<void> {
    // Check if current token is still valid (with 5-minute buffer)
    if (this.accessToken && this.tokenExpiresAt) {
      const bufferMs = 5 * 60 * 1000;
      if (this.tokenExpiresAt.getTime() - bufferMs > Date.now()) {
        return;
      }
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    try {
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = new Error('SharePoint authentication failed') as AuthenticationError;
        error.name = 'AuthenticationError';
        throw error;
      }

      const data: SharePointAuthResponse = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthenticationError') {
        throw error;
      }
      const authError = new Error('Failed to authenticate with SharePoint') as AuthenticationError;
      authError.name = 'AuthenticationError';
      throw authError;
    }
  }

  /**
   * Execute API request with authentication and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.authenticate();

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });

      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const _resetTime = retryAfter
          ? new Date(Date.now() + parseInt(retryAfter) * 1000)
          : new Date(Date.now() + 60000);

        const error = new Error('Rate limit exceeded');
        error.name = 'RateLimitError';
        throw error;
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.accessToken = null;
          this.tokenExpiresAt = null;
          const error = new Error('Authentication failed') as AuthenticationError;
          error.name = 'AuthenticationError';
          throw error;
        }

        const errorBody = await response.text();
        const error = new Error(`SharePoint API error: ${response.status} - ${errorBody}`) as IntegrationError;
        error.name = 'IntegrationError';
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && (
        error.name === 'RateLimitError' ||
        error.name === 'AuthenticationError' ||
        error.name === 'IntegrationError'
      )) {
        throw error;
      }

      const integrationError = new Error(
        `Failed to communicate with SharePoint API: ${error instanceof Error ? error.message : String(error)}`
      ) as IntegrationError;
      integrationError.name = 'IntegrationError';
      throw integrationError;
    }
  }

  /**
   * Get SharePoint sites
   */
  async getSites(options: {
    skipToken?: string;
    top?: number;
  } = {}): Promise<{ sites: SharePointSite[]; nextLink?: string }> {
    const params = new URLSearchParams();
    if (options.top) params.append('$top', options.top.toString());

    const endpoint = options.skipToken
      ? options.skipToken
      : `sites?search=*&${params.toString()}`;

    const response = await this.request<{ value: SharePointSite[]; '@odata.nextLink'?: string }>(
      endpoint
    );

    return {
      sites: response.value || [],
      nextLink: response['@odata.nextLink'],
    };
  }

  /**
   * Get document libraries for a site
   */
  async getLibraries(
    siteId: string,
    options: { skipToken?: string; top?: number } = {}
  ): Promise<{ libraries: SharePointLibrary[]; nextLink?: string }> {
    const params = new URLSearchParams();
    if (options.top) params.append('$top', options.top.toString());

    const endpoint = options.skipToken
      ? options.skipToken
      : `sites/${siteId}/drives?${params.toString()}`;

    const response = await this.request<{ value: SharePointLibrary[]; '@odata.nextLink'?: string }>(
      endpoint
    );

    return {
      libraries: response.value || [],
      nextLink: response['@odata.nextLink'],
    };
  }

  /**
   * Get files from a document library
   */
  async getFiles(
    driveId: string,
    options: {
      skipToken?: string;
      top?: number;
      filter?: string; // For incremental sync: lastModifiedDateTime gt 2024-01-01T00:00:00Z
    } = {}
  ): Promise<{ files: SharePointFile[]; nextLink?: string }> {
    const params = new URLSearchParams();
    if (options.top) params.append('$top', options.top.toString());
    if (options.filter) params.append('$filter', options.filter);

    const endpoint = options.skipToken
      ? options.skipToken
      : `drives/${driveId}/root/children?${params.toString()}`;

    const response = await this.request<{ value: SharePointFile[]; '@odata.nextLink'?: string }>(
      endpoint
    );

    return {
      files: response.value || [],
      nextLink: response['@odata.nextLink'],
    };
  }

  /**
   * Get permissions for a file
   */
  async getFilePermissions(
    driveId: string,
    itemId: string,
    options: { skipToken?: string; top?: number } = {}
  ): Promise<{ permissions: SharePointPermission[]; nextLink?: string }> {
    const params = new URLSearchParams();
    if (options.top) params.append('$top', options.top.toString());

    const endpoint = options.skipToken
      ? options.skipToken
      : `drives/${driveId}/items/${itemId}/permissions?${params.toString()}`;

    const response = await this.request<{ value: SharePointPermission[]; '@odata.nextLink'?: string }>(
      endpoint
    );

    return {
      permissions: response.value || [],
      nextLink: response['@odata.nextLink'],
    };
  }

  /**
   * Health check - verify credentials are valid
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      await this.authenticate();
      // Try to list sites to verify permissions
      await this.getSites({ top: 1 });
      return { status: 'ok', message: 'Connection successful' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
