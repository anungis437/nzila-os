/**
 * FreshBooks API Client
 * 
 * Cloud-based accounting software for small businesses and freelancers.
 * 
 * API Documentation: https://www.freshbooks.com/api/start
 * 
 * Features:
 * - OAuth2 authentication
 * - RESTful JSON API
 * - Rate limiting (100 requests per minute)
 * - Support for invoices, clients, payments, expenses
 */

import { IntegrationError, AuthenticationError, RateLimitError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface FreshBooksConfig {
  clientId: string;
  clientSecret: string;
  accountId: string; // Business ID
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: Date;
  environment?: 'production' | 'sandbox';
}

export interface FreshBooksInvoice {
  id: number;
  invoiceid: number;
  invoice_number: string;
  customerid: number;
  organization: string;
  create_date: string;
  due_date: string;
  amount: {
    amount: string;
    code: string;
  };
  outstanding: {
    amount: string;
    code: string;
  };
  status: number; // 1=draft, 2=sent, 3=viewed, 4=paid, 5=auto-paid
  v3_status: string;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface FreshBooksClient {
  id: number;
  userid: number;
  organization: string;
  fname: string;
  lname: string;
  email: string;
  business_phone: string;
  outstanding_balance: Array<{
    amount: string;
    code: string;
  }>;
}

export interface FreshBooksPayment {
  id: number;
  invoiceid: number;
  amount: {
    amount: string;
    code: string;
  };
  date: string;
  type: string;
  note?: string;
}

export interface FreshBooksExpense {
  id: number;
  category_name: string;
  amount: {
    amount: string;
    code: string;
  };
  date: string;
  vendor: string;
  status: number;
}

interface FreshBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// ============================================================================
// FreshBooks Client
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class FreshBooksClient {
  private config: FreshBooksConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;
  private readonly baseUrl = 'https://api.freshbooks.com';
  private readonly authUrl = 'https://auth.freshbooks.com/oauth';

  constructor(config: FreshBooksConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiry = config.tokenExpiry;
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  async authenticate(): Promise<void> {
    if (!this.refreshToken && !this.config.refreshToken) {
      throw new AuthenticationError('No refresh token available', IntegrationProvider.FRESHBOOKS);
    }

    await this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<void> {
    const token = this.refreshToken || this.config.refreshToken;
    if (!token) {
      throw new AuthenticationError('No refresh token available', IntegrationProvider.FRESHBOOKS);
    }

    try {
      const response = await fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: token,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AuthenticationError(`Token refresh failed: ${error}`, IntegrationProvider.FRESHBOOKS);
      }

      const data: FreshBooksTokenResponse = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      this.config.accessToken = this.accessToken;
      this.config.refreshToken = this.refreshToken;
      this.config.tokenExpiry = this.tokenExpiry;
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.FRESHBOOKS
      );
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry) {
      await this.refreshAccessToken();
      return;
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (this.tokenExpiry < fiveMinutesFromNow) {
      await this.refreshAccessToken();
    }
  }

  // ==========================================================================
  // HTTP Helper
  // ==========================================================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (response.status === 429) {
        throw new RateLimitError('FreshBooks rate limit exceeded', IntegrationProvider.FRESHBOOKS, 60);
      }

      if (response.status === 401) {
        await this.refreshAccessToken();
        return this.request<T>(endpoint, options);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new IntegrationError(
          `FreshBooks API error (${response.status}): ${errorText}`,
          IntegrationProvider.FRESHBOOKS
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
        IntegrationProvider.FRESHBOOKS
      );
    }
  }

  // ==========================================================================
  // Invoice Operations
  // ==========================================================================

  async getInvoices(options: {
    page?: number;
    perPage?: number;
    updatedSince?: Date;
  } = {}): Promise<{ invoices: FreshBooksInvoice[]; hasMore: boolean }> {
    const page = options.page || 1;
    const perPage = options.perPage || 100;

    let url = `/accounting/account/${this.config.accountId}/invoices/invoices?page=${page}&per_page=${perPage}`;

    if (options.updatedSince) {
      const dateStr = options.updatedSince.toISOString().split('T')[0];
      url += `&updated_from=${dateStr}`;
    }

    const response = await this.request<{ response: { result: { invoices: FreshBooksInvoice[]; per_page: number; pages: number } } }>(url);

    const invoices = response.response.result.invoices;
    const hasMore = page < response.response.result.pages;

    return { invoices, hasMore };
  }

  // ==========================================================================
  // Client Operations
  // ==========================================================================

  async getClients(options: {
    page?: number;
    perPage?: number;
  } = {}): Promise<{ clients: FreshBooksClient[]; hasMore: boolean }> {
    const page = options.page || 1;
    const perPage = options.perPage || 100;

    const url = `/accounting/account/${this.config.accountId}/users/clients?page=${page}&per_page=${perPage}`;

    const response = await this.request<{ response: { result: { clients: FreshBooksClient[]; per_page: number; pages: number } } }>(url);

    const clients = response.response.result.clients;
    const hasMore = page < response.response.result.pages;

    return { clients, hasMore };
  }

  // ==========================================================================
  // Payment Operations
  // ==========================================================================

  async getPayments(options: {
    page?: number;
    perPage?: number;
  } = {}): Promise<{ payments: FreshBooksPayment[]; hasMore: boolean }> {
    const page = options.page || 1;
    const perPage = options.perPage || 100;

    const url = `/accounting/account/${this.config.accountId}/payments/payments?page=${page}&per_page=${perPage}`;

    const response = await this.request<{ response: { result: { payments: FreshBooksPayment[]; per_page: number; pages: number } } }>(url);

    const payments = response.response.result.payments;
    const hasMore = page < response.response.result.pages;

    return { payments, hasMore };
  }

  // ==========================================================================
  // Expense Operations (used as chart of accounts proxy)
  // ==========================================================================

  async getExpenses(options: {
    page?: number;
    perPage?: number;
  } = {}): Promise<{ expenses: FreshBooksExpense[]; hasMore: boolean }> {
    const page = options.page || 1;
    const perPage = options.perPage || 100;

    const url = `/accounting/account/${this.config.accountId}/expenses/expenses?page=${page}&per_page=${perPage}`;

    const response = await this.request<{ response: { result: { expenses: FreshBooksExpense[]; per_page: number; pages: number } } }>(url);

    const expenses = response.response.result.expenses;
    const hasMore = page < response.response.result.pages;

    return { expenses, hasMore };
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.getClients({ page: 1, perPage: 1 });
      return true;
    } catch {
      return false;
    }
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }
}
