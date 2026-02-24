/**
 * Xero API Client
 * 
 * Low-level client for making authenticated requests to Xero API.
 * Handles OAuth2 authentication, token refresh, rate limiting, and error handling.
 * 
 * API Documentation: https://developer.xero.com/documentation/api/accounting/overview
 * 
 * Features:
 * - OAuth2 with automatic token refresh
 * - Rate limiting (60 requests per minute)
 * - Pagination with page parameter
 * - Support for invoices, contacts, payments, accounts
 * - Tenant (organization) support
 * 
 * Rate Limits:
 * - 60 requests per minute per tenant
 * - 5000 requests per day
 */

import { IntegrationError, AuthenticationError, RateLimitError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface XeroConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string; // Xero organization ID
  redirectUri?: string;
  environment?: 'production' | 'sandbox';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: 'ACCREC' | 'ACCPAY'; // Accounts Receivable or Accounts Payable
  Contact: {
    ContactID: string;
    Name: string;
  };
  DateString: string; // YYYY-MM-DD
  DueDateString: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax';
  SubTotal: number;
  TotalTax: number;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  AmountCredited: number;
  UpdatedDateUTC: string;
  CurrencyCode: string;
}

export interface XeroContact {
  ContactID: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  ContactNumber?: string;
  AccountNumber?: string;
  ContactStatus: 'ACTIVE' | 'ARCHIVED';
  IsSupplier: boolean;
  IsCustomer: boolean;
  UpdatedDateUTC: string;
}

export interface XeroPayment {
  PaymentID: string;
  Invoice: {
    InvoiceID: string;
    InvoiceNumber: string;
  };
  Account: {
    AccountID: string;
    Code: string;
  };
  Date: string; // YYYY-MM-DD
  Amount: number;
  CurrencyRate?: number;
  PaymentType: 'ACCRECPAYMENT' | 'ACCPAYPAYMENT';
  Status: 'AUTHORISED' | 'DELETED';
  UpdatedDateUTC: string;
  Reference?: string;
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type:
    | 'BANK'
    | 'CURRENT'
    | 'CURRLIAB'
    | 'DEPRECIATN'
    | 'DIRECTCOSTS'
    | 'EQUITY'
    | 'EXPENSE'
    | 'FIXED'
    | 'INVENTORY'
    | 'LIABILITY'
    | 'NONCURRENT'
    | 'OTHERINCOME'
    | 'OVERHEADS'
    | 'PREPAYMENT'
    | 'REVENUE'
    | 'SALES'
    | 'TERMLIAB'
    | 'PAYGLIABILITY';
  TaxType?: string;
  Class?: 'ASSET' | 'EQUITY' | 'EXPENSE' | 'LIABILITY' | 'REVENUE';
  Status: 'ACTIVE' | 'ARCHIVED';
  EnablePaymentsToAccount: boolean;
  BankAccountNumber?: string;
  CurrencyCode?: string;
  UpdatedDateUTC: string;
}

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// Xero Client
// ============================================================================

export class XeroClient {
  private config: XeroConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;
  private readonly baseUrl: string;
  private readonly tokenUrl = 'https://identity.xero.com/connect/token';
  private readonly MAX_RETRIES = 3;

  constructor(config: XeroConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiry = config.tokenExpiry;
    this.baseUrl = 'https://api.xero.com/api.xro/2.0';
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate using OAuth2 refresh token
   */
  async authenticate(): Promise<void> {
    if (!this.refreshToken && !this.config.refreshToken) {
      throw new AuthenticationError('No refresh token available', IntegrationProvider.XERO);
    }

    await this.refreshAccessToken();
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    const token = this.refreshToken || this.config.refreshToken;
    if (!token) {
      throw new AuthenticationError('No refresh token available', IntegrationProvider.XERO);
    }

    try {
      const auth = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
      ).toString('base64');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AuthenticationError(`Token refresh failed: ${error}`, IntegrationProvider.XERO);
      }

      const data: XeroTokenResponse = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      // Update config
      this.config.accessToken = this.accessToken;
      this.config.refreshToken = this.refreshToken;
      this.config.tokenExpiry = this.tokenExpiry;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.XERO
      );
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry) {
      await this.refreshAccessToken();
      return;
    }

    // Refresh if token expires in less than 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (this.tokenExpiry < fiveMinutesFromNow) {
      await this.refreshAccessToken();
    }
  }

  // ==========================================================================
  // HTTP Request Helper
  // ==========================================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}/${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.accessToken}`,
      'xero-tenant-id': this.config.tenantId,
      Accept: 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || '60',
          10
        );
        throw new RateLimitError(
          `Rate limit exceeded. Retry after ${retryAfter} seconds`,
          IntegrationProvider.XERO,
          retryAfter
        );
      }

      // Handle authentication errors
      if (response.status === 401) {
        if (retryCount < this.MAX_RETRIES) {
          await this.refreshAccessToken();
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        throw new AuthenticationError('Authentication failed after retry', IntegrationProvider.XERO);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new IntegrationError(
          `Xero API error (${response.status}): ${errorText}`,
          IntegrationProvider.XERO
        );
      }

      return await response.json();
    } catch (error) {
      if (
        error instanceof RateLimitError ||
        error instanceof AuthenticationError ||
        error instanceof IntegrationError
      ) {
        throw error;
      }
      throw new IntegrationError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.XERO
      );
    }
  }

  // ==========================================================================
  // Invoice Operations
  // ==========================================================================

  /**
   * Get invoices from Xero
   * @param options Pagination and filtering options
   */
  async getInvoices(options: {
    page?: number;
    modifiedSince?: Date;
    type?: 'ACCREC' | 'ACCPAY';
  } = {}): Promise<{ invoices: XeroInvoice[]; hasMore: boolean }> {
    const params = new URLSearchParams();

    if (options.page) {
      params.append('page', options.page.toString());
    }

    if (options.modifiedSince) {
      // Xero uses If-Modified-Since header
      const _modifiedHeader = options.modifiedSince.toUTCString();
    }

    let endpoint = 'Invoices';
    if (options.type) {
      params.append('where', `Type="${options.type}"`);
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const headers: HeadersInit = {};
    if (options.modifiedSince) {
      headers['If-Modified-Since'] = options.modifiedSince.toUTCString();
    }

    const response = await this.request<{ Invoices: XeroInvoice[] }>(
      endpoint,
      { headers }
    );

    // Xero returns up to 100 invoices per page
    const hasMore = response.Invoices.length === 100;

    return {
      invoices: response.Invoices,
      hasMore,
    };
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<XeroInvoice> {
    const response = await this.request<{ Invoices: XeroInvoice[] }>(
      `Invoices/${invoiceId}`
    );
    return response.Invoices[0];
  }

  // ==========================================================================
  // Contact Operations
  // ==========================================================================

  /**
   * Get contacts from Xero
   */
  async getContacts(options: {
    page?: number;
    modifiedSince?: Date;
  } = {}): Promise<{ contacts: XeroContact[]; hasMore: boolean }> {
    const params = new URLSearchParams();

    if (options.page) {
      params.append('page', options.page.toString());
    }

    let endpoint = 'Contacts';
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const headers: HeadersInit = {};
    if (options.modifiedSince) {
      headers['If-Modified-Since'] = options.modifiedSince.toUTCString();
    }

    const response = await this.request<{ Contacts: XeroContact[] }>(
      endpoint,
      { headers }
    );

    const hasMore = response.Contacts.length === 100;

    return {
      contacts: response.Contacts,
      hasMore,
    };
  }

  /**
   * Get a single contact by ID
   */
  async getContact(contactId: string): Promise<XeroContact> {
    const response = await this.request<{ Contacts: XeroContact[] }>(
      `Contacts/${contactId}`
    );
    return response.Contacts[0];
  }

  // ==========================================================================
  // Payment Operations
  // ==========================================================================

  /**
   * Get payments from Xero
   */
  async getPayments(options: {
    page?: number;
    modifiedSince?: Date;
  } = {}): Promise<{ payments: XeroPayment[]; hasMore: boolean }> {
    const params = new URLSearchParams();

    if (options.page) {
      params.append('page', options.page.toString());
    }

    let endpoint = 'Payments';
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const headers: HeadersInit = {};
    if (options.modifiedSince) {
      headers['If-Modified-Since'] = options.modifiedSince.toUTCString();
    }

    const response = await this.request<{ Payments: XeroPayment[] }>(
      endpoint,
      { headers }
    );

    const hasMore = response.Payments.length === 100;

    return {
      payments: response.Payments,
      hasMore,
    };
  }

  // ==========================================================================
  // Account Operations
  // ==========================================================================

  /**
   * Get chart of accounts from Xero
   */
  async getAccounts(options: {
    page?: number;
  } = {}): Promise<{ accounts: XeroAccount[]; hasMore: boolean }> {
    const params = new URLSearchParams();

    if (options.page) {
      params.append('page', options.page.toString());
    }

    let endpoint = 'Accounts';
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await this.request<{ Accounts: XeroAccount[] }>(endpoint);

    const hasMore = response.Accounts.length === 100;

    return {
      accounts: response.Accounts,
      hasMore,
    };
  }

  /**
   * Get a single account by ID
   */
  async getAccount(accountId: string): Promise<XeroAccount> {
    const response = await this.request<{ Accounts: XeroAccount[] }>(
      `Accounts/${accountId}`
    );
    return response.Accounts[0];
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Perform a health check by making a minimal API request
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccounts({ page: 1 });
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  /**
   * Get the current refresh token (for storage)
   */
  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * Get token expiry
   */
  getTokenExpiry(): Date | undefined {
    return this.tokenExpiry;
  }
}
