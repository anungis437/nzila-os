/**
 * Wave API Client
 * 
 * Free accounting software for small businesses with GraphQL API.
 * 
 * API Documentation: https://developer.waveapps.com/hc/en-us/articles/360019762711
 * 
 * Features:
 * - OAuth2 authentication
 * - GraphQL API
 * - Free tier with API access
 * - Support for invoices, customers, payments
 */

import { IntegrationError, AuthenticationError, RateLimitError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface WaveConfig {
  clientId: string;
  clientSecret: string;
  businessId: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: Date;
  environment?: 'production';
}

export interface WaveInvoice {
  id: string;
  invoiceNumber: string;
  customer: {
    id: string;
    name: string;
  };
  invoiceDate: string;
  dueDate: string;
  total: number;
  amountDue: number;
  status: string; // DRAFT, SENT, VIEWED, PAID, PARTIAL, OVERDUE
}

export interface WaveCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  currency: string;
}

export interface WavePayment {
  id: string;
  invoice: {
    id: string;
  };
  customer: {
    id: string;
    name: string;
  };
  date: string;
  amount: number;
}

interface WaveTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// ============================================================================
// Wave Client
// ============================================================================

export class WaveClient {
  private config: WaveConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;
  private readonly graphqlUrl = 'https://gql.waveapps.com/graphql/public';
  private readonly authUrl = 'https://api.waveapps.com/oauth2/token/';

  constructor(config: WaveConfig) {
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
      throw new AuthenticationError('No refresh token available', IntegrationProvider.WAVE);
    }

    await this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<void> {
    const token = this.refreshToken || this.config.refreshToken;
    if (!token) {
      throw new AuthenticationError('No refresh token available', IntegrationProvider.WAVE);
    }

    try {
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: token,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new AuthenticationError(`Token refresh failed: ${error}`, IntegrationProvider.WAVE);
      }

      const data: WaveTokenResponse = await response.json();
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
        IntegrationProvider.WAVE
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
  // GraphQL Helper
  // ==========================================================================

  private async graphql<T>(query: string, variables: unknown = {}): Promise<T> {
    await this.ensureValidToken();

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429) {
        throw new RateLimitError('Wave rate limit exceeded', IntegrationProvider.WAVE, 60);
      }

      if (response.status === 401) {
        await this.refreshAccessToken();
        return this.graphql<T>(query, variables);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new IntegrationError(
          `Wave API error (${response.status}): ${errorText}`,
          IntegrationProvider.WAVE
        );
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new IntegrationError(
          `GraphQL errors: ${JSON.stringify(result.errors)}`,
          IntegrationProvider.WAVE
        );
      }

      return result.data;
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
        IntegrationProvider.WAVE
      );
    }
  }

  // ==========================================================================
  // Invoice Operations
  // ==========================================================================

  async getInvoices(options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ invoices: WaveInvoice[]; hasMore: boolean }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;

    const query = `
      query GetInvoices($businessId: ID!, $page: Int!, $pageSize: Int!) {
        business(id: $businessId) {
          invoices(page: $page, pageSize: $pageSize) {
            pageInfo {
              currentPage
              totalPages
            }
            edges {
              node {
                id
                invoiceNumber
                customer {
                  id
                  name
                }
                invoiceDate
                dueDate
                total
                amountDue
                status
              }
            }
          }
        }
      }
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.graphql<any>(query, {
      businessId: this.config.businessId,
      page,
      pageSize,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices = result.business.invoices.edges.map((edge: any) => edge.node);
    const hasMore = page < result.business.invoices.pageInfo.totalPages;

    return { invoices, hasMore };
  }

  // ==========================================================================
  // Customer Operations
  // ==========================================================================

  async getCustomers(options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ customers: WaveCustomer[]; hasMore: boolean }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;

    const query = `
      query GetCustomers($businessId: ID!, $page: Int!, $pageSize: Int!) {
        business(id: $businessId) {
          customers(page: $page, pageSize: $pageSize) {
            pageInfo {
              currentPage
              totalPages
            }
            edges {
              node {
                id
                name
                email
                phone
                currency {
                  code
                }
              }
            }
          }
        }
      }
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.graphql<any>(query, {
      businessId: this.config.businessId,
      page,
      pageSize,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customers = result.business.customers.edges.map((edge: any) => ({
      ...edge.node,
      currency: edge.node.currency?.code || 'USD',
    }));
    const hasMore = page < result.business.customers.pageInfo.totalPages;

    return { customers, hasMore };
  }

  // ==========================================================================
  // Payment Operations (Money In Transactions)
  // ==========================================================================

  async getPayments(options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ payments: WavePayment[]; hasMore: boolean }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;

    const query = `
      query GetPayments($businessId: ID!, $page: Int!, $pageSize: Int!) {
        business(id: $businessId) {
          moneyTransactions(page: $page, pageSize: $pageSize) {
            pageInfo {
              currentPage
              totalPages
            }
            edges {
              node {
                id
                date
                amount
                ... on MoneyIn {
                  invoice {
                    id
                  }
                  customer {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.graphql<any>(query, {
      businessId: this.config.businessId,
      page,
      pageSize,
    });

    const payments = result.business.moneyTransactions.edges
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((edge: any) => edge.node)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((node: any) => node.invoice); // Only transactions linked to invoices

    const hasMore = page < result.business.moneyTransactions.pageInfo.totalPages;

    return { payments, hasMore };
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const query = `
        query {
          user {
            id
          }
        }
      `;
      await this.graphql(query);
      return true;
    } catch {
      return false;
    }
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }
}
