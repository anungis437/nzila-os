/**
 * LinkedIn Learning API Client
 * 
 * Provides communication with LinkedIn Learning API for course data,
 * enrollments, progress tracking, and completion records.
 * 
 * API Reference: https://docs.microsoft.com/en-us/linkedin/learning/
 * Rate Limits: 500 requests per day (varies by tier)
 * Authentication: OAuth2
 */

 
import type {
  IntegrationError,
  RateLimitError as _RateLimitError,
  AuthenticationError,
} from '../../types';

interface LinkedInLearningConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  apiUrl?: string;
}

interface LinkedInAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface LinkedInCourse {
  urn: string;
  title: { locale: { language: string; country: string }; value: string };
  description?: { locale: { language: string; country: string }; value: string };
  publishedAt: number;
  lastUpdatedAt: number;
  difficultyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  timeToComplete: { duration: number; unit: 'HOUR' | 'MINUTE' };
  availableLocales: Array<{ language: string; country: string }>;
  primaryCategoryUrn?: string;
  provider: string;
}

export interface LinkedInEnrollment {
  learnerUrn: string;
  courseUrn: string;
  enrolledAt: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED';
  progressPercentage: number;
  lastAccessedAt?: number;
}

export interface LinkedInProgress {
  learnerUrn: string;
  courseUrn: string;
  contentUrn: string;
  progressPercentage: number;
  completedAt?: number;
  timeSpent: number; // seconds
}

export interface LinkedInCompletion {
  learnerUrn: string;
  courseUrn: string;
  completedAt: number;
  certificateUrn?: string;
  grade?: number;
}

export interface LinkedInLearner {
  urn: string;
  firstName: string;
  lastName: string;
  email: string;
  profileUrl?: string;
}

export class LinkedInLearningClient {
  private config: LinkedInLearningConfig;
  private readonly baseUrl: string;
  private readonly authUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: LinkedInLearningConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://api.linkedin.com/v2';
    this.authUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    this.accessToken = config.accessToken || null;
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
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = new Error('LinkedIn Learning authentication failed') as AuthenticationError;
        error.name = 'AuthenticationError';
        throw error;
      }

      const data: LinkedInAuthResponse = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthenticationError') {
        throw error;
      }
      const authError = new Error('Failed to authenticate with LinkedIn Learning') as AuthenticationError;
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
      'LinkedIn-Version': '202401',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });

      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const _resetTime = retryAfter
          ? new Date(Date.now() + parseInt(retryAfter) * 1000)
          : new Date(Date.now() + 3600000);

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
        const error = new Error(`LinkedIn Learning API error: ${response.status} - ${errorBody}`) as IntegrationError;
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
        `Failed to communicate with LinkedIn Learning API: ${error instanceof Error ? error.message : String(error)}`
      ) as IntegrationError;
      integrationError.name = 'IntegrationError';
      throw integrationError;
    }
  }

  /**
   * Get courses from catalog
   */
  async getCourses(options: {
    start?: number;
    count?: number;
    modifiedSince?: string; // ISO timestamp for incremental sync
  } = {}): Promise<{ courses: LinkedInCourse[]; total?: number }> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.append('start', options.start.toString());
    if (options.count) params.append('count', options.count.toString());
    if (options.modifiedSince) params.append('modifiedSince', options.modifiedSince);

    const endpoint = `learningAssets?${params.toString()}`;
    const response = await this.request<{ elements: LinkedInCourse[]; paging?: { total: number } }>(
      endpoint
    );

    return {
      courses: response.elements || [],
      total: response.paging?.total,
    };
  }

  /**
   * Get enrollments for organization
   */
  async getEnrollments(options: {
    start?: number;
    count?: number;
    modifiedSince?: string;
  } = {}): Promise<{ enrollments: LinkedInEnrollment[]; total?: number }> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.append('start', options.start.toString());
    if (options.count) params.append('count', options.count.toString());
    if (options.modifiedSince) params.append('modifiedSince', options.modifiedSince);

    const endpoint = `learningEnrollments?${params.toString()}`;
    const response = await this.request<{ elements: LinkedInEnrollment[]; paging?: { total: number } }>(
      endpoint
    );

    return {
      enrollments: response.elements || [],
      total: response.paging?.total,
    };
  }

  /**
   * Get learner progress
   */
  async getProgress(options: {
    start?: number;
    count?: number;
    learnerUrn?: string;
  } = {}): Promise<{ progress: LinkedInProgress[]; total?: number }> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.append('start', options.start.toString());
    if (options.count) params.append('count', options.count.toString());
    if (options.learnerUrn) params.append('learner', options.learnerUrn);

    const endpoint = `learningProgress?${params.toString()}`;
    const response = await this.request<{ elements: LinkedInProgress[]; paging?: { total: number } }>(
      endpoint
    );

    return {
      progress: response.elements || [],
      total: response.paging?.total,
    };
  }

  /**
   * Get course completions
   */
  async getCompletions(options: {
    start?: number;
    count?: number;
    completedSince?: string; // ISO timestamp for incremental sync
  } = {}): Promise<{ completions: LinkedInCompletion[]; total?: number }> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.append('start', options.start.toString());
    if (options.count) params.append('count', options.count.toString());
    if (options.completedSince) params.append('completedSince', options.completedSince);

    const endpoint = `learningCompletions?${params.toString()}`;
    const response = await this.request<{ elements: LinkedInCompletion[]; paging?: { total: number } }>(
      endpoint
    );

    return {
      completions: response.elements || [],
      total: response.paging?.total,
    };
  }

  /**
   * Get learners (organization members)
   */
  async getLearners(options: {
    start?: number;
    count?: number;
  } = {}): Promise<{ learners: LinkedInLearner[]; total?: number }> {
    const params = new URLSearchParams();
    if (options.start !== undefined) params.append('start', options.start.toString());
    if (options.count) params.append('count', options.count.toString());

    const endpoint = `learningLearners?${params.toString()}`;
    const response = await this.request<{ elements: LinkedInLearner[]; paging?: { total: number } }>(
      endpoint
    );

    return {
      learners: response.elements || [],
      total: response.paging?.total,
    };
  }

  /**
   * Health check - verify credentials are valid
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      await this.authenticate();
      // Try to list courses to verify permissions
      await this.getCourses({ count: 1 });
      return { status: 'ok', message: 'Connection successful' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
