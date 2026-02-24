/**
 * Slack API Client
 * 
 * Provides communication with Slack API for workspace messaging,
 * channel management, and user activity tracking.
 * 
 * API Reference: https://api.slack.com/methods
 * Rate Limits: Tier-based (Tier 1: 1/min, Tier 2: 20/min, Tier 3: 50/min, Tier 4: 100/min)
 * Authentication: OAuth2 with Bot Token
 */

 
import type {
  IntegrationError,
  RateLimitError as _RateLimitError,
  AuthenticationError,
} from '../../types';

interface SlackConfig {
  botToken: string;
  apiUrl?: string;
  workspaceId?: string;
}

interface SlackResponse<T> {
  ok: boolean;
  error?: string;
  data?: T;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
  created: number;
  creator: string;
  num_members?: number;
  topic?: { value: string; creator: string; last_set: number };
  purpose?: { value: string; creator: string; last_set: number };
}

export interface SlackMessage {
  client_msg_id?: string;
  type: string;
  text: string;
  user: string;
  ts: string;
  channel?: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  real_name?: string;
  profile?: {
    email?: string;
    phone?: string;
    title?: string;
    display_name?: string;
    status_text?: string;
    status_emoji?: string;
    first_name?: string;
    last_name?: string;
    image_24?: string;
    image_48?: string;
    image_72?: string;
  };
  is_admin?: boolean;
  is_owner?: boolean;
  is_bot?: boolean;
  deleted?: boolean;
  updated?: number;
}

export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  user: string;
  size: number;
  url_private?: string;
  url_private_download?: string;
  permalink?: string;
  channels?: string[];
  groups?: string[];
  comments_count?: number;
}

export class SlackClient {
  private config: SlackConfig;
  private readonly baseUrl: string;

  constructor(config: SlackConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://slack.com/api';
  }

  /**
   * Execute API request with rate limit and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${this.config.botToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });

      // Check for rate limiting
      const _rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');
      const rateLimitReset = response.headers.get('X-Rate-Limit-Reset');
      
      if (response.status === 429) {
        const _resetTime = rateLimitReset 
          ? new Date(parseInt(rateLimitReset) * 1000)
          : new Date(Date.now() + 60000);
        
        const error = new Error('Rate limit exceeded');
        error.name = 'RateLimitError';
        throw error;
      }

      if (!response.ok) {
        if (response.status === 401) {
          const error = new Error('Authentication failed - invalid bot token') as AuthenticationError;
          error.name = 'AuthenticationError';
          throw error;
        }

        const errorBody = await response.text();
        const error = new Error(`Slack API error: ${response.status} - ${errorBody}`) as IntegrationError;
        error.name = 'IntegrationError';
        throw error;
      }

      const data: SlackResponse<T> = await response.json();
      
      if (!data.ok && data.error) {
        if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
          const error = new Error(`Authentication error: ${data.error}`) as AuthenticationError;
          error.name = 'AuthenticationError';
          throw error;
        }

        const error = new Error(`Slack API error: ${data.error}`) as IntegrationError;
        error.name = 'IntegrationError';
        throw error;
      }

      return data.data || (data as unknown as T);
    } catch (error) {
      if (error instanceof Error && (
        error.name === 'RateLimitError' ||
        error.name === 'AuthenticationError' ||
        error.name === 'IntegrationError'
      )) {
        throw error;
      }

      const integrationError = new Error(
        `Failed to communicate with Slack API: ${error instanceof Error ? error.message : String(error)}`
      ) as IntegrationError;
      integrationError.name = 'IntegrationError';
      throw integrationError;
    }
  }

  /**
   * Get all channels in the workspace
   */
  async getChannels(options: {
    cursor?: string;
    limit?: number;
    excludeArchived?: boolean;
  } = {}): Promise<{ channels: SlackChannel[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.excludeArchived) params.append('exclude_archived', 'true');

    const endpoint = `conversations.list?${params.toString()}`;
    const response = await this.request<{ channels: SlackChannel[]; response_metadata?: { next_cursor?: string } }>(
      endpoint,
      { method: 'GET' }
    );

    return {
      channels: response.channels || [],
      nextCursor: response.response_metadata?.next_cursor,
    };
  }

  /**
   * Get messages from a channel
   */
  async getChannelMessages(
    channelId: string,
    options: {
      cursor?: string;
      limit?: number;
      oldest?: string; // Timestamp for incremental sync
      latest?: string;
    } = {}
  ): Promise<{ messages: SlackMessage[]; nextCursor?: string }> {
    const params = new URLSearchParams({ channel: channelId });
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.oldest) params.append('oldest', options.oldest);
    if (options.latest) params.append('latest', options.latest);

    const endpoint = `conversations.history?${params.toString()}`;
    const response = await this.request<{ messages: SlackMessage[]; response_metadata?: { next_cursor?: string } }>(
      endpoint,
      { method: 'GET' }
    );

    return {
      messages: response.messages || [],
      nextCursor: response.response_metadata?.next_cursor,
    };
  }

  /**
   * Get all users in the workspace
   */
  async getUsers(options: {
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ users: SlackUser[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('limit', options.limit.toString());

    const endpoint = `users.list?${params.toString()}`;
    const response = await this.request<{ members: SlackUser[]; response_metadata?: { next_cursor?: string } }>(
      endpoint,
      { method: 'GET' }
    );

    return {
      users: response.members || [],
      nextCursor: response.response_metadata?.next_cursor,
    };
  }

  /**
   * Get files shared in the workspace
   */
  async getFiles(options: {
    cursor?: string;
    limit?: number;
    channel?: string;
    user?: string;
    tsFrom?: string; // Timestamp for incremental sync
    tsTo?: string;
  } = {}): Promise<{ files: SlackFile[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('count', options.limit.toString());
    if (options.channel) params.append('channel', options.channel);
    if (options.user) params.append('user', options.user);
    if (options.tsFrom) params.append('ts_from', options.tsFrom);
    if (options.tsTo) params.append('ts_to', options.tsTo);

    const endpoint = `files.list?${params.toString()}`;
    const response = await this.request<{ files: SlackFile[]; paging?: { page: number; pages: number } }>(
      endpoint,
      { method: 'GET' }
    );

    return {
      files: response.files || [],
      nextCursor: undefined, // Files API uses page-based pagination
    };
  }

  /**
   * Post a message to a channel
   */
  async postMessage(
    channelId: string,
    text: string,
    options: {
      threadTs?: string;
      blocks?: unknown[];
      attachments?: unknown[];
    } = {}
  ): Promise<SlackMessage> {
    const body = {
      channel: channelId,
      text,
      ...options,
    };

    const response = await this.request<{ message: SlackMessage }>(
      'chat.postMessage',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return response.message;
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(): Promise<{
    id: string;
    name: string;
    domain: string;
    email_domain?: string;
  }> {
    const response = await this.request<{
      team: {
        id: string;
        name: string;
        domain: string;
        email_domain?: string;
      };
    }>('team.info', { method: 'GET' });

    return response.team;
  }

  /**
   * Health check - verify bot token is valid
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      await this.request<{ ok: boolean }>('auth.test', { method: 'POST' });
      return { status: 'ok', message: 'Connection successful' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
