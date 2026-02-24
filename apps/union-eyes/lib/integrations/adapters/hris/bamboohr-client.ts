/**
 * BambooHR API Client
 * 
 * Handles API key authentication and API communication with BambooHR.
 * Simpler than Workday - uses API key authentication.
 * 
 * @see https://documentation.bamboohr.com/docs
 */

import { logger } from '@/lib/logger';
import { AuthenticationError, RateLimitError, IntegrationError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface BambooHRConfig {
  companyDomain: string; // e.g., 'acmecorp'
  apiKey: string;
}

export interface BambooHREmployee {
  id: string;
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  workPhone?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  hireDate?: string;
  employmentStatus?: string;
  supervisor?: string;
  supervisorId?: string;
}

export interface BambooHRDepartment {
  id: string;
  name: string;
}

export interface BambooHRLocation {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
}

// ============================================================================
// BambooHR API Client
// ============================================================================

export class BambooHRClient {
  private config: BambooHRConfig;
  private baseUrl: string;

  constructor(config: BambooHRConfig) {
    this.config = config;
    this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${config.companyDomain}/v1`;
  }

  // ==========================================================================
  // API Request Helper
  // ==========================================================================

  /**
   * Make authenticated API request to BambooHR
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:x`).toString('base64')}`,
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      // Handle rate limiting (BambooHR uses 429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'BambooHR rate limit exceeded',
          IntegrationProvider.BAMBOOHR,
          parseInt(retryAfter || '60', 10)
        );
      }

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(
          'BambooHR authentication failed - check API key',
          IntegrationProvider.BAMBOOHR
        );
      }

      if (!response.ok) {
        const error = await response.text();
        throw new IntegrationError(
          `BambooHR API error (${response.status}): ${error}`,
          IntegrationProvider.BAMBOOHR
        );
      }

      // BambooHR returns empty response for some endpoints
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      if (error instanceof RateLimitError || 
          error instanceof AuthenticationError || 
          error instanceof IntegrationError) {
        throw error;
      }
      throw new IntegrationError(
        `BambooHR request failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.BAMBOOHR
      );
    }
  }

  // ==========================================================================
  // Employee API
  // ==========================================================================

  /**
   * Get all employees with custom fields
   */
  async getEmployees(fields?: string[]): Promise<BambooHREmployee[]> {
    const defaultFields = [
      'id',
      'employeeNumber',
      'firstName',
      'lastName',
      'email',
      'mobilePhone',
      'workPhone',
      'jobTitle',
      'department',
      'location',
      'hireDate',
      'employmentStatus',
      'supervisor',
      'supervisorId',
    ];

    const fieldsToFetch = fields || defaultFields;
    const fieldsParam = fieldsToFetch.join(',');

    const response = await this.request<{ employees: BambooHREmployee[] }>(
      `/employees/directory?fields=${encodeURIComponent(fieldsParam)}`
    );

    return response.employees || [];
  }

  /**
   * Get a single employee by ID
   */
  async getEmployee(employeeId: string, fields?: string[]): Promise<BambooHREmployee> {
    const defaultFields = [
      'id',
      'employeeNumber',
      'firstName',
      'lastName',
      'email',
      'mobilePhone',
      'workPhone',
      'jobTitle',
      'department',
      'location',
      'hireDate',
      'employmentStatus',
      'supervisor',
      'supervisorId',
    ];

    const fieldsToFetch = fields || defaultFields;
    const fieldsParam = fieldsToFetch.join(',');

    return await this.request<BambooHREmployee>(
      `/employees/${employeeId}?fields=${encodeURIComponent(fieldsParam)}`
    );
  }

  /**
   * Get employees who changed since a specific date
   * Useful for incremental sync
   */
  async getChangedEmployees(since: Date): Promise<{ changes: unknown[] }> {
    const sinceDate = since.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return await this.request<{ changes: unknown[] }>(
      `/employees/changed?since=${sinceDate}`
    );
  }

  // ==========================================================================
  // Department API (via meta data)
  // ==========================================================================

  /**
   * Get all departments
   */
  async getDepartments(): Promise<BambooHRDepartment[]> {
    const response = await this.request<{ departments: BambooHRDepartment[] }>(
      `/meta/lists/department`
    );

    return response.departments || [];
  }

  // ==========================================================================
  // Location API (via meta data)
  // ==========================================================================

  /**
   * Get all locations
   */
  async getLocations(): Promise<BambooHRLocation[]> {
    const response = await this.request<{ locations: BambooHRLocation[] }>(
      `/meta/lists/location`
    );

    return response.locations || [];
  }

  // ==========================================================================
  // Time Off API (for leave tracking)
  // ==========================================================================

  /**
   * Get time off requests
   */
  async getTimeOffRequests(params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    status?: string;
  }): Promise<unknown[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('start', params.startDate);
    if (params?.endDate) queryParams.set('end', params.endDate);
    if (params?.type) queryParams.set('type', params.type);
    if (params?.status) queryParams.set('status', params.status);

    const query = queryParams.toString();
    const endpoint = query ? `/time_off/requests?${query}` : `/time_off/requests`;

    return await this.request<unknown[]>(endpoint);
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Test API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple metadata request to verify connectivity
      await this.request<unknown>('/meta/lists/department');
      return true;
    } catch (error) {
      logger.error('BambooHR health check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }
}
