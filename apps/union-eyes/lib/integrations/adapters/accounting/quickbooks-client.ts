/**
 * QuickBooks Online API Client
 * 
 * Handles OAuth2 authentication and API communication with QuickBooks Online.
 * Popular cloud accounting software for small to medium businesses.
 * 
 * @see https://developer.intuit.com/app/developer/qbo/docs/api/accounting/
 */

import { logger } from '@/lib/logger';
import { AuthenticationError, RateLimitError, IntegrationError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  realmId: string; // Company ID
  environment?: 'production' | 'sandbox';
  refreshToken?: string;
}

export interface QuickBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

export interface QuickBooksInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line: Array<{
    Amount: number;
    Description?: string;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef: {
        value: string;
        name?: string;
      };
      Qty?: number;
      UnitPrice?: number;
    };
  }>;
  TotalAmt: number;
  Balance: number;
  TxnStatus?: string;
}

export interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  Balance: number;
}

export interface QuickBooksPayment {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line?: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
}

export interface QuickBooksAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  Classification: string;
  CurrentBalance: number;
  Active: boolean;
}

export interface QuickBooksPaginatedResponse<_T> {
  QueryResponse: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
    startPosition: number;
    maxResults: number;
    totalCount?: number;
  };
}

// ============================================================================
// QuickBooks API Client
// ============================================================================

export class QuickBooksClient {
  private config: QuickBooksConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;
  private baseUrl: string;

  constructor(config: QuickBooksConfig) {
    this.config = config;
    this.refreshToken = config.refreshToken;
    this.baseUrl = config.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate with QuickBooks OAuth2
   */
  async authenticate(): Promise<void> {
    if (!this.refreshToken) {
      throw new AuthenticationError(
        'QuickBooks refresh token required',
        IntegrationProvider.QUICKBOOKS
      );
    }

    try {
      const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${this.config.clientId}:${this.config.clientSecret}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AuthenticationError(
          `QuickBooks authentication failed: ${error}`,
          IntegrationProvider.QUICKBOOKS
        );
      }

      const data: QuickBooksTokenResponse = await response.json();
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      logger.info('QuickBooks authentication successful', {
        realmId: this.config.realmId,
        expiresAt: this.tokenExpiresAt,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        `QuickBooks authentication error: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.QUICKBOOKS
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

  /**
   * Get current refresh token (for storage)
   */
  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  // ==========================================================================
  // API Request Helper
  // ==========================================================================

  /**
   * Make authenticated API request to QuickBooks
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}/v3/company/${this.config.realmId}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle rate limiting (QuickBooks uses 429)
      if (response.status === 429) {
        throw new RateLimitError('QuickBooks rate limit exceeded', IntegrationProvider.QUICKBOOKS, 60);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new IntegrationError(
          `QuickBooks API error (${response.status}): ${error}`,
          IntegrationProvider.QUICKBOOKS
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof IntegrationError) {
        throw error;
      }
      throw new IntegrationError(
        `QuickBooks request failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.QUICKBOOKS
      );
    }
  }

  // ==========================================================================
  // Invoice API
  // ==========================================================================

  /**
   * Query invoices with pagination
   */
  async getInvoices(options?: {
    limit?: number;
    offset?: number;
    modifiedSince?: Date;
  }): Promise<{ invoices: QuickBooksInvoice[]; hasMore: boolean }> {
    let query = 'SELECT * FROM Invoice';
    
    if (options?.modifiedSince) {
      const dateStr = options.modifiedSince.toISOString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('Invalid date format');
      query += ` WHERE MetaData.LastUpdatedTime > '${dateStr}'`;
    }

    const limit = Math.max(1, Math.min(Math.floor(Number(options?.limit) || 100), 1000));
    const offset = Math.max(0, Math.floor(Number(options?.offset) || 0));
    query += ` MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;

    const response = await this.request<QuickBooksPaginatedResponse<QuickBooksInvoice>>(
      `/query?query=${encodeURIComponent(query)}`
    );

    const invoices = response.QueryResponse.Invoice || [];
    const hasMore = invoices.length === limit;

    return { invoices, hasMore };
  }

  // ==========================================================================
  // Customer API
  // ==========================================================================

  /**
   * Query customers
   */
  async getCustomers(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ customers: QuickBooksCustomer[]; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(Math.floor(Number(options?.limit) || 100), 1000));
    const offset = Math.max(0, Math.floor(Number(options?.offset) || 0));
    
    const query = `SELECT * FROM Customer MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;

    const response = await this.request<QuickBooksPaginatedResponse<QuickBooksCustomer>>(
      `/query?query=${encodeURIComponent(query)}`
    );

    const customers = response.QueryResponse.Customer || [];
    const hasMore = customers.length === limit;

    return { customers, hasMore };
  }

  // ==========================================================================
  // Payment API
  // ==========================================================================

  /**
   * Query payments
   */
  async getPayments(options?: {
    limit?: number;
    offset?: number;
    modifiedSince?: Date;
  }): Promise<{ payments: QuickBooksPayment[]; hasMore: boolean }> {
    let query = 'SELECT * FROM Payment';
    
    if (options?.modifiedSince) {
      const dateStr = options.modifiedSince.toISOString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('Invalid date format');
      query += ` WHERE MetaData.LastUpdatedTime > '${dateStr}'`;
    }

    const limit = Math.max(1, Math.min(Math.floor(Number(options?.limit) || 100), 1000));
    const offset = Math.max(0, Math.floor(Number(options?.offset) || 0));
    query += ` MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;

    const response = await this.request<QuickBooksPaginatedResponse<QuickBooksPayment>>(
      `/query?query=${encodeURIComponent(query)}`
    );

    const payments = response.QueryResponse.Payment || [];
    const hasMore = payments.length === limit;

    return { payments, hasMore };
  }

  // ==========================================================================
  // Chart of Accounts API
  // ==========================================================================

  /**
   * Get chart of accounts
   */
  async getAccounts(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ accounts: QuickBooksAccount[]; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(Math.floor(Number(options?.limit) || 100), 1000));
    const offset = Math.max(0, Math.floor(Number(options?.offset) || 0));
    
    const query = `SELECT * FROM Account MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;

    const response = await this.request<QuickBooksPaginatedResponse<QuickBooksAccount>>(
      `/query?query=${encodeURIComponent(query)}`
    );

    const accounts = response.QueryResponse.Account || [];
    const hasMore = accounts.length === limit;

    return { accounts, hasMore };
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
      // Simple query to verify connectivity
      await this.getAccounts({ limit: 1 });
      return true;
    } catch (error) {
      logger.error('QuickBooks health check failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }
}
