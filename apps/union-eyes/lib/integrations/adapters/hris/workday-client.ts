/**
 * Workday API Client
 * 
 * Handles OAuth2 authentication and API communication with Workday.
 * 
 * @see https://community.workday.com/sites/default/files/file-hosting/restapi/index.html
 */

import { logger } from '@/lib/logger';
import { AuthenticationError, RateLimitError, IntegrationError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface WorkdayConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  environment?: 'production' | 'sandbox';
  refreshToken?: string;
}

export interface WorkdayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface WorkdayEmployee {
  id: string;
  employeeID: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  location?: string;
  hireDate?: string;
  employmentStatus?: string;
  workSchedule?: string;
  supervisor?: {
    id: string;
    name: string;
  };
}

export interface WorkdayPosition {
  id: string;
  title: string;
  description?: string;
  department?: string;
  jobProfile?: string;
  effectiveDate?: string;
}

export interface WorkdayDepartment {
  id: string;
  name: string;
  code?: string;
  manager?: {
    id: string;
    name: string;
  };
  parentDepartment?: string;
}

export interface WorkdayPaginatedResponse<T> {
  data: T[];
  total: number;
  cursor?: string;
}

// ============================================================================
// Workday API Client
// ============================================================================

export class WorkdayClient {
  private config: WorkdayConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private baseUrl: string;

  constructor(config: WorkdayConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'sandbox'
      ? `https://wd2-impl-services1.workday.com`
      : `https://services1.workday.com`;
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate with Workday OAuth2
   */
  async authenticate(): Promise<void> {
    try {
      const tokenUrl = `${this.baseUrl}/ccx/oauth2/${this.config.tenantId}/token`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${this.config.clientId}:${this.config.clientSecret}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: this.config.refreshToken ? 'refresh_token' : 'client_credentials',
          ...(this.config.refreshToken && { refresh_token: this.config.refreshToken }),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AuthenticationError(
          `Workday authentication failed: ${error}`,
          IntegrationProvider.WORKDAY
        );
      }

      const data: WorkdayTokenResponse = await response.json();
      
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      logger.info('Workday authentication successful', {
        tenantId: this.config.tenantId,
        expiresAt: this.tokenExpiresAt,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        `Workday authentication error: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.WORKDAY
      );
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || new Date() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
  }

  // ==========================================================================
  // API Request Helper
  // ==========================================================================

  /**
   * Make authenticated API request to Workday
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}/ccx/api/v1/${this.config.tenantId}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Workday rate limit exceeded',
          IntegrationProvider.WORKDAY,
          parseInt(retryAfter || '60', 10)
        );
      }

      if (!response.ok) {
        const error = await response.text();
        throw new IntegrationError(
          `Workday API error (${response.status}): ${error}`,
          IntegrationProvider.WORKDAY
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof IntegrationError) {
        throw error;
      }
      throw new IntegrationError(
        `Workday request failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.WORKDAY
      );
    }
  }

  // ==========================================================================
  // Employee API
  // ==========================================================================

  /**
   * Get all employees with pagination
   */
  async getEmployees(options?: {
    limit?: number;
    offset?: number;
    cursor?: string;
  }): Promise<WorkdayPaginatedResponse<WorkdayEmployee>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.request<Record<string, any>>(
      `/workers?${params.toString()}`
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: response.data.map((worker: Record<string, any>) => this.mapWorkerToEmployee(worker)),
      total: response.total || response.data.length,
      cursor: response.next_cursor,
    };
  }

  /**
   * Get a single employee by ID
   */
  async getEmployee(employeeId: string): Promise<WorkdayEmployee> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.request<Record<string, any>>(`/workers/${employeeId}`);
    return this.mapWorkerToEmployee(response);
  }

  /**
   * Map Workday worker to our employee format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapWorkerToEmployee(worker: Record<string, any>): WorkdayEmployee {
    return {
      id: worker.id,
      employeeID: worker.descriptor || worker.id,
      firstName: worker.primaryWorkEmail?.email?.split('@')[0] || '',
      lastName: worker.primaryWorkEmail?.email?.split('@')[0] || '',
      email: worker.primaryWorkEmail?.email || '',
      phone: worker.primaryWorkPhone?.formattedPhone,
      position: worker.businessTitle,
      department: worker.location?.descriptor,
      location: worker.location?.descriptor,
      hireDate: worker.hireDate,
      employmentStatus: worker.workerStatus?.descriptor,
      workSchedule: worker.timeType?.descriptor,
      supervisor: worker.manager ? {
        id: worker.manager.id,
        name: worker.manager.descriptor,
      } : undefined,
    };
  }

  // ==========================================================================
  // Position API
  // ==========================================================================

  /**
   * Get all positions
   */
  async getPositions(options?: {
    limit?: number;
    offset?: number;
  }): Promise<WorkdayPaginatedResponse<WorkdayPosition>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.request<Record<string, any>>(
      `/jobProfiles?${params.toString()}`
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: response.data.map((profile: Record<string, any>) => this.mapJobProfileToPosition(profile)),
      total: response.total || response.data.length,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapJobProfileToPosition(profile: Record<string, any>): WorkdayPosition {
    return {
      id: profile.id,
      title: profile.descriptor || profile.id,
      description: profile.jobDescription,
      jobProfile: profile.descriptor,
      effectiveDate: profile.effectiveDate,
    };
  }

  // ==========================================================================
  // Department API
  // ==========================================================================

  /**
   * Get all departments/organizations
   */
  async getDepartments(options?: {
    limit?: number;
    offset?: number;
  }): Promise<WorkdayPaginatedResponse<WorkdayDepartment>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.request<Record<string, any>>(
      `/organizations?${params.toString()}`
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: response.data.map((org: Record<string, any>) => this.mapOrgToDepartment(org)),
      total: response.total || response.data.length,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapOrgToDepartment(org: Record<string, any>): WorkdayDepartment {
    return {
      id: org.id,
      name: org.descriptor || org.id,
      code: org.organizationCode,
      manager: org.manager ? {
        id: org.manager.id,
        name: org.manager.descriptor,
      } : undefined,
      parentDepartment: org.superiorOrganization?.id,
    };
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Test API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      // Simple request to verify connectivity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.request<Record<string, any>>('/workers?limit=1');
      return true;
    } catch (error) {
      logger.error('Workday health check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }
}
