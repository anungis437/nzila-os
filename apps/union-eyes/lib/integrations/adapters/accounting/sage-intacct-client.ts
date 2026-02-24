/**
 * Sage Intacct API Client
 * 
 * Low-level client for Sage Intacct Web Services API.
 * Enterprise-grade cloud financial management system.
 * 
 * API Documentation: https://developer.intacct.com/web-services/
 * 
 * Features:
 * - Session-based authentication
 * - XML-based API (Web Services)
 * - Multi-entity support
 * - Rate limiting (varies by plan)
 * - Support for invoices, customers, payments, GL accounts
 */

import { IntegrationError, AuthenticationError, IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface SageIntacctConfig {
  companyId: string;
  userId: string;
  userPassword: string;
  senderId: string;
  senderPassword: string;
  entityId?: string; // For multi-entity setups
  environment?: 'production' | 'sandbox';
}

export interface SageIntacctInvoice {
  RECORDNO: string;
  RECORDID: string;
  CUSTOMERID: string;
  CUSTOMERNAME: string;
  WHENDUE: string;
  WHENCREATED: string;
  TOTALDUE: number;
  TOTALENTERED: number;
  STATE: string; // Draft, Submitted, Approved, Paid, etc.
}

export interface SageIntacctCustomer {
  RECORDNO: string;
  CUSTOMERID: string;
  NAME: string;
  EMAIL1?: string;
  PHONE1?: string;
  STATUS: string; // active, inactive
}

export interface SageIntacctPayment {
  RECORDNO: string;
  RECORDKEY: string;
  CUSTOMERID: string;
  CUSTOMERNAME: string;
  WHENPAID: string;
  AMOUNTPAID: number;
  BANKACCOUNTID?: string;
}

export interface SageIntacctAccount {
  RECORDNO: string;
  ACCOUNTNO: string;
  TITLE: string;
  ACCOUNTTYPE: string;
  NORMALBALANCE: string; // debit or credit
  CLOSINGTYPE: string; // balance_sheet or income_statement
  STATUS: string;
}

interface _SageIntacctResponse {
  response: {
    control?: {
      status: string;
    };
    operation?: {
      authentication?: {
        status: string;
        sessionid?: string;
      };
      result?: Array<{
        status: string;
        data?: unknown;
        errormessage?: Array<{
          error?: Array<{
            description2?: string;
          }>;
        }>;
      }>;
    };
  };
}

// ============================================================================
// Sage Intacct Client
// ============================================================================

export class SageIntacctClient {
  private config: SageIntacctConfig;
  private sessionId?: string;
  private sessionExpiry?: Date;
  private readonly apiUrl: string;

  constructor(config: SageIntacctConfig) {
    this.config = config;
    this.apiUrl =
      config.environment === 'sandbox'
        ? 'https://api.intacct.com/ia/xml/xmlgw.phtml'
        : 'https://api.intacct.com/ia/xml/xmlgw.phtml';
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate and create session
   */
  async authenticate(): Promise<void> {
    const xml = this.buildAuthRequest();

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: xml,
      });

      if (!response.ok) {
        throw new AuthenticationError('Sage Intacct authentication failed', IntegrationProvider.SAGE_INTACCT);
      }

      const text = await response.text();
      const sessionId = this.extractSessionId(text);

      if (!sessionId) {
        throw new AuthenticationError('Failed to extract session ID', IntegrationProvider.SAGE_INTACCT);
      }

      this.sessionId = sessionId;
      // Sessions typically last 1 hour
      this.sessionExpiry = new Date(Date.now() + 60 * 60 * 1000);
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.SAGE_INTACCT
      );
    }
  }

  /**
   * Build authentication request XML
   */
  private buildAuthRequest(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${this.config.senderId}</senderid>
    <password>${this.config.senderPassword}</password>
    <controlid>testControlId</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <login>
        <userid>${this.config.userId}</userid>
        <companyid>${this.config.companyId}</companyid>
        <password>${this.config.userPassword}</password>
        ${this.config.entityId ? `<locationid>${this.config.entityId}</locationid>` : ''}
      </login>
    </authentication>
    <content>
      <function controlid="getApiSession">
        <getAPISession />
      </function>
    </content>
  </operation>
</request>`;
  }

  /**
   * Extract session ID from XML response
   */
  private extractSessionId(xml: string): string | null {
    const match = xml.match(/<sessionid>([^<]+)<\/sessionid>/);
    return match ? match[1] : null;
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureValidSession(): Promise<void> {
    if (!this.sessionId || !this.sessionExpiry) {
      await this.authenticate();
      return;
    }

    // Refresh if expiring in less than 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (this.sessionExpiry < fiveMinutesFromNow) {
      await this.authenticate();
    }
  }

  // ==========================================================================
  // API Request Helper
  // ==========================================================================

  /**
   * Make API request to Sage Intacct
   */
  private async request(functionXml: string): Promise<unknown> {
    await this.ensureValidSession();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${this.config.senderId}</senderid>
    <password>${this.config.senderPassword}</password>
    <controlid>control-${Date.now()}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <sessionid>${this.sessionId}</sessionid>
    </authentication>
    <content>
      ${functionXml}
    </content>
  </operation>
</request>`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: xml,
      });

      if (!response.ok) {
        throw new IntegrationError(
          `Sage Intacct API error: ${response.status}`,
          IntegrationProvider.SAGE_INTACCT
        );
      }

      const text = await response.text();
      return this.parseXmlResponse(text);
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      throw new IntegrationError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        IntegrationProvider.SAGE_INTACCT
      );
    }
  }

  /**
   * Parse XML response and extract data
   */
  private parseXmlResponse(xml: string): unknown {
    // Check for errors
    const errorMatch = xml.match(/<description2>([^<]+)<\/description2>/);
    if (errorMatch) {
      throw new IntegrationError(`Sage Intacct error: ${errorMatch[1]}`, IntegrationProvider.SAGE_INTACCT);
    }

    // Extract data elements
    const dataMatch = xml.match(/<data>([\s\S]*?)<\/data>/);
    if (!dataMatch) {
      return [];
    }

    return dataMatch[1];
  }

  // ==========================================================================
  // Invoice Operations
  // ==========================================================================

  /**
   * Get invoices (AR Invoices)
   */
  async getInvoices(options: {
    pageSize?: number;
    offset?: number;
    modifiedSince?: Date;
  } = {}): Promise<{ invoices: SageIntacctInvoice[]; hasMore: boolean }> {
    const pageSize = options.pageSize || 100;
    const offset = options.offset || 0;

    let filter = '';
    if (options.modifiedSince) {
      const dateStr = options.modifiedSince.toISOString().split('T')[0];
      filter = `<and><greaterthan><field>WHENMODIFIED</field><value>${dateStr}</value></greaterthan></and>`;
    }

    const functionXml = `
      <function controlid="readInvoices">
        <readByQuery>
          <object>ARINVOICE</object>
          <fields>*</fields>
          ${filter ? `<query>${filter}</query>` : ''}
          <pagesize>${pageSize}</pagesize>
          <offset>${offset}</offset>
        </readByQuery>
      </function>`;

    const data = await this.request(functionXml);
    const invoices = this.parseInvoices(data as string);

    return {
      invoices,
      hasMore: invoices.length === pageSize,
    };
  }

  /**
   * Parse invoice XML data
   */
  private parseInvoices(xml: string): SageIntacctInvoice[] {
    const invoices: SageIntacctInvoice[] = [];
    const invoiceMatches = xml.matchAll(/<ARINVOICE>([\s\S]*?)<\/ARINVOICE>/g);

    for (const match of invoiceMatches) {
      const invoiceXml = match[1];
      invoices.push({
        RECORDNO: this.extractValue(invoiceXml, 'RECORDNO'),
        RECORDID: this.extractValue(invoiceXml, 'RECORDID'),
        CUSTOMERID: this.extractValue(invoiceXml, 'CUSTOMERID'),
        CUSTOMERNAME: this.extractValue(invoiceXml, 'CUSTOMERNAME'),
        WHENDUE: this.extractValue(invoiceXml, 'WHENDUE'),
        WHENCREATED: this.extractValue(invoiceXml, 'WHENCREATED'),
        TOTALDUE: parseFloat(this.extractValue(invoiceXml, 'TOTALDUE') || '0'),
        TOTALENTERED: parseFloat(this.extractValue(invoiceXml, 'TOTALENTERED') || '0'),
        STATE: this.extractValue(invoiceXml, 'STATE'),
      });
    }

    return invoices;
  }

  // ==========================================================================
  // Customer Operations
  // ==========================================================================

  /**
   * Get customers
   */
  async getCustomers(options: {
    pageSize?: number;
    offset?: number;
  } = {}): Promise<{ customers: SageIntacctCustomer[]; hasMore: boolean }> {
    const pageSize = options.pageSize || 100;
    const offset = options.offset || 0;

    const functionXml = `
      <function controlid="readCustomers">
        <readByQuery>
          <object>CUSTOMER</object>
          <fields>*</fields>
          <pagesize>${pageSize}</pagesize>
          <offset>${offset}</offset>
        </readByQuery>
      </function>`;

    const data = await this.request(functionXml);
    const customers = this.parseCustomers(data as string);

    return {
      customers,
      hasMore: customers.length === pageSize,
    };
  }

  /**
   * Parse customer XML data
   */
  private parseCustomers(xml: string): SageIntacctCustomer[] {
    const customers: SageIntacctCustomer[] = [];
    const customerMatches = xml.matchAll(/<CUSTOMER>([\s\S]*?)<\/CUSTOMER>/g);

    for (const match of customerMatches) {
      const customerXml = match[1];
      customers.push({
        RECORDNO: this.extractValue(customerXml, 'RECORDNO'),
        CUSTOMERID: this.extractValue(customerXml, 'CUSTOMERID'),
        NAME: this.extractValue(customerXml, 'NAME'),
        EMAIL1: this.extractValue(customerXml, 'EMAIL1'),
        PHONE1: this.extractValue(customerXml, 'PHONE1'),
        STATUS: this.extractValue(customerXml, 'STATUS'),
      });
    }

    return customers;
  }

  // ==========================================================================
  // Payment Operations
  // ==========================================================================

  /**
   * Get payments (AR Payments)
   */
  async getPayments(options: {
    pageSize?: number;
    offset?: number;
  } = {}): Promise<{ payments: SageIntacctPayment[]; hasMore: boolean }> {
    const pageSize = options.pageSize || 100;
    const offset = options.offset || 0;

    const functionXml = `
      <function controlid="readPayments">
        <readByQuery>
          <object>ARPAYMENT</object>
          <fields>*</fields>
          <pagesize>${pageSize}</pagesize>
          <offset>${offset}</offset>
        </readByQuery>
      </function>`;

    const data = await this.request(functionXml);
    const payments = this.parsePayments(data as string);

    return {
      payments,
      hasMore: payments.length === pageSize,
    };
  }

  /**
   * Parse payment XML data
   */
  private parsePayments(xml: string): SageIntacctPayment[] {
    const payments: SageIntacctPayment[] = [];
    const paymentMatches = xml.matchAll(/<ARPAYMENT>([\s\S]*?)<\/ARPAYMENT>/g);

    for (const match of paymentMatches) {
      const paymentXml = match[1];
      payments.push({
        RECORDNO: this.extractValue(paymentXml, 'RECORDNO'),
        RECORDKEY: this.extractValue(paymentXml, 'RECORDKEY'),
        CUSTOMERID: this.extractValue(paymentXml, 'CUSTOMERID'),
        CUSTOMERNAME: this.extractValue(paymentXml, 'CUSTOMERNAME'),
        WHENPAID: this.extractValue(paymentXml, 'WHENPAID'),
        AMOUNTPAID: parseFloat(this.extractValue(paymentXml, 'AMOUNTPAID') || '0'),
        BANKACCOUNTID: this.extractValue(paymentXml, 'BANKACCOUNTID'),
      });
    }

    return payments;
  }

  // ==========================================================================
  // Account Operations (GL Accounts)
  // ==========================================================================

  /**
   * Get chart of accounts
   */
  async getAccounts(options: {
    pageSize?: number;
    offset?: number;
  } = {}): Promise<{ accounts: SageIntacctAccount[]; hasMore: boolean }> {
    const pageSize = options.pageSize || 100;
    const offset = options.offset || 0;

    const functionXml = `
      <function controlid="readAccounts">
        <readByQuery>
          <object>GLACCOUNT</object>
          <fields>*</fields>
          <pagesize>${pageSize}</pagesize>
          <offset>${offset}</offset>
        </readByQuery>
      </function>`;

    const data = await this.request(functionXml);
    const accounts = this.parseAccounts(data as string);

    return {
      accounts,
      hasMore: accounts.length === pageSize,
    };
  }

  /**
   * Parse account XML data
   */
  private parseAccounts(xml: string): SageIntacctAccount[] {
    const accounts: SageIntacctAccount[] = [];
    const accountMatches = xml.matchAll(/<GLACCOUNT>([\s\S]*?)<\/GLACCOUNT>/g);

    for (const match of accountMatches) {
      const accountXml = match[1];
      accounts.push({
        RECORDNO: this.extractValue(accountXml, 'RECORDNO'),
        ACCOUNTNO: this.extractValue(accountXml, 'ACCOUNTNO'),
        TITLE: this.extractValue(accountXml, 'TITLE'),
        ACCOUNTTYPE: this.extractValue(accountXml, 'ACCOUNTTYPE'),
        NORMALBALANCE: this.extractValue(accountXml, 'NORMALBALANCE'),
        CLOSINGTYPE: this.extractValue(accountXml, 'CLOSINGTYPE'),
        STATUS: this.extractValue(accountXml, 'STATUS'),
      });
    }

    return accounts;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Extract value from XML
   */
  private extractValue(xml: string, field: string): string {
    const match = xml.match(new RegExp(`<${field}>([^<]*)<\/${field}>`));
    return match ? match[1] : '';
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureValidSession();
      return !!this.sessionId;
    } catch {
      return false;
    }
  }

  /**
   * Get session ID for debugging
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }
}
