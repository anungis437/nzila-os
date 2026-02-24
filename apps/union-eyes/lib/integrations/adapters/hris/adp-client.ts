/**
 * ADP Workforce Now API Client
 * 
 * Handles OAuth2 authentication and API communication with ADP Workforce Now.
 * One of the more complex HRIS integrations due to comprehensive payroll features.
 * 
 * @see https://developers.adp.com/articles/api/workforce-now-api
 */

import { logger } from '@/lib/logger';
import { AuthenticationError, RateLimitError, IntegrationError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ADPConfig {
  clientId: string;
  clientSecret: string;
  certificateKey?: string; // For SSL certificate authentication
  environment?: 'production' | 'sandbox';
}

export interface ADPTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ADPWorker {
  associateOID: string;
  workerID: {
    idValue: string;
  };
  person: {
    legalName: {
      givenName: string;
      familyName: string;
    };
    communication?: {
      emails?: Array<{
        emailUri: string;
      }>;
      phones?: Array<{
        areaDialing?: string;
        dialNumber?: string;
      }>;
    };
  };
  workerDates?: {
    originalHireDate?: string;
  };
  workerStatus?: {
    statusCode: {
      codeValue: string;
    };
  };
  businessCommunication?: {
    emails?: Array<{
      emailUri: string;
    }>;
  };
  workAssignments?: Array<{
    positionTitle?: string;
    organizationalUnits?: Array<{
      nameCode: {
        codeValue: string;
        shortName: string;
      };
    }>;
    homeOrganizationalUnits?: Array<{
      nameCode: {
        codeValue: string;
        shortName: string;
      };
    }>;
    reportsTo?: Array<{
      associateOID: string;
      workerID: {
        idValue: string;
      };
    }>;
  }>;
}

export interface ADPPosition {
  positionID: string;
  positionTitle: string;
  positionDescription?: string;
  organizationalUnitID?: string;
}

export interface ADPOrganizationalUnit {
  organizationalUnitID: string;
  nameCode: {
    codeValue: string;
    shortName: string;
  };
  parentOrganizationalUnitID?: string;
}

export interface ADPPaginatedResponse<T> {
  workers?: T[];
  meta?: {
    totalCount?: number;
  };
}

// ============================================================================
// ADP API Client
// ============================================================================

export class ADPClient {
  private config: ADPConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private baseUrl: string;

  constructor(config: ADPConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'sandbox'
      ? 'https://api-sandbox.adp.com'
      : 'https://api.adp.com';
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate with ADP OAuth2
   * ADP uses client credentials grant
   */
  async authenticate(): Promise<void> {
    try {
      const tokenUrl = `${this.baseUrl}/auth/oauth/v2/token`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${this.config.clientId}:${this.config.clientSecret}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AuthenticationError(
          `ADP authentication failed: ${error}`,
          IntegrationProvider.ADP
        );
      }

      const data: ADPTokenResponse = await response.json();
      
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      logger.info('ADP authentication successful', {
        expiresAt: this.tokenExpiresAt,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        `ADP authentication error: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.ADP
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
   * Make authenticated API request to ADP
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}${endpoint}`;

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
          'ADP rate limit exceeded',
          IntegrationProvider.ADP,
          parseInt(retryAfter || '60', 10)
        );
      }

      if (!response.ok) {
        const error = await response.text();
        throw new IntegrationError(
          `ADP API error (${response.status}): ${error}`,
          IntegrationProvider.ADP
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof IntegrationError) {
        throw error;
      }
      throw new IntegrationError(
        `ADP request failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.ADP
      );
    }
  }

  // ==========================================================================
  // Worker API (ADP's term for employees)
  // ==========================================================================

  /**
   * Get all workers with pagination
   */
  async getWorkers(options?: {
    limit?: number;
    skip?: number;
  }): Promise<ADPPaginatedResponse<ADPWorker>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('$top', options.limit.toString());
    if (options?.skip) params.set('$skip', options.skip.toString());

    const query = params.toString();
    const endpoint = query 
      ? `/hr/v2/workers?${query}`
      : `/hr/v2/workers`;

    return await this.request<ADPPaginatedResponse<ADPWorker>>(endpoint);
  }

  /**
   * Get a single worker by ID
   */
  async getWorker(associateOID: string): Promise<ADPWorker> {
    const response = await this.request<{ workers: ADPWorker[] }>(
      `/hr/v2/workers/${associateOID}`
    );
    
    if (!response.workers || response.workers.length === 0) {
      throw new IntegrationError(`Worker ${associateOID} not found`, IntegrationProvider.ADP);
    }

    return response.workers[0];
  }

  /**
   * Map ADP worker to our employee format
   */
  mapWorkerToEmployee(worker: ADPWorker): {
    id: string;
    employeeID: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position?: string;
    department?: string;
    hireDate?: string;
    employmentStatus?: string;
    supervisorId?: string;
  } {
    const workAssignment = worker.workAssignments?.[0];
    const email = worker.businessCommunication?.emails?.[0]?.emailUri || 
                  worker.person.communication?.emails?.[0]?.emailUri;
    const phone = worker.person.communication?.phones?.[0];
    const phoneNumber = phone ? `${phone.areaDialing}-${phone.dialNumber}` : undefined;

    return {
      id: worker.associateOID,
      employeeID: worker.workerID.idValue,
      firstName: worker.person.legalName.givenName,
      lastName: worker.person.legalName.familyName,
      email,
      phone: phoneNumber,
      position: workAssignment?.positionTitle,
      department: workAssignment?.organizationalUnits?.[0]?.nameCode.shortName ||
                 workAssignment?.homeOrganizationalUnits?.[0]?.nameCode.shortName,
      hireDate: worker.workerDates?.originalHireDate,
      employmentStatus: worker.workerStatus?.statusCode.codeValue,
      supervisorId: workAssignment?.reportsTo?.[0]?.associateOID,
    };
  }

  // ==========================================================================
  // Organizational Unit API
  // ==========================================================================

  /**
   * Get organizational units (departments)
   */
  async getOrganizationalUnits(options?: {
    limit?: number;
    skip?: number;
  }): Promise<ADPPaginatedResponse<ADPOrganizationalUnit>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('$top', options.limit.toString());
    if (options?.skip) params.set('$skip', options.skip.toString());

    const query = params.toString();
    const endpoint = query
      ? `/hr/v2/organizational-units?${query}`
      : `/hr/v2/organizational-units`;

    return await this.request<ADPPaginatedResponse<ADPOrganizationalUnit>>(endpoint);
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
      await this.getWorkers({ limit: 1 });
      return true;
    } catch (error) {
      logger.error('ADP health check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }
}
