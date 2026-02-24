/**
 * Xero Integration Adapter
 * 
 * Implements integration with Xero for accounting data.
 * Handles invoices, payments, contacts (customers), and chart of accounts.
 * 
 * Features:
 * - OAuth2 authentication with automatic token refresh
 * - Full and incremental sync
 * - Invoice, payment, contact, and account entities
 * - Webhook support for real-time updates
 * 
 * @see https://developer.xero.com/documentation/api/accounting/overview
 */

import { BaseIntegration } from '../../base-integration';
import {
  IntegrationType,
  IntegrationProvider,
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
  SyncType,
  ConnectionStatus,
} from '../../types';
import { XeroClient, type XeroConfig } from './xero-client';
import { db } from '@/db';
import { externalInvoices, externalPayments, externalCustomers, externalAccounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Xero Adapter
// ============================================================================

export class XeroAdapter extends BaseIntegration {
  private client?: XeroClient;
  private readonly PAGE_SIZE = 100; // Xero's default/max page size

  constructor() {
    super(IntegrationType.ACCOUNTING, IntegrationProvider.XERO, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: true,
      supportsRealTime: false,
      supportedEntities: ['invoices', 'payments', 'contacts', 'accounts'],
      requiresOAuth: true,
      rateLimitPerMinute: 60, // Xero allows 60 requests per minute
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const xeroConfig: XeroConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        tenantId: (this.config!.settings?.organizationId as string) || '',
        environment: (this.config!.settings?.environment as 'production' | 'sandbox') || 'production',
        refreshToken: this.config!.credentials.refreshToken,
      };

      this.client = new XeroClient(xeroConfig);
      await this.client.authenticate();
      
      // Store updated refresh token
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Xero' });
    } catch (error) {
      this.logError('connect', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Xero' });
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      this.ensureConnected();

      const startTime = Date.now();
      const isHealthy = await this.client!.healthCheck();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: isHealthy,
        status: this.connected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED,
        latencyMs,
        lastCheckedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: ConnectionStatus.ERROR,
        latencyMs: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheckedAt: new Date(),
      };
    }
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  async sync(options: SyncOptions): Promise<SyncResult> {
    this.ensureConnected();

    const _startTime = Date.now();
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      const entities = options.entities || this.capabilities.supportedEntities;

      for (const entity of entities) {
        try {
          this.logOperation('sync', { entity, message: `Syncing ${entity}` });

          switch (entity) {
            case 'invoices':
              const invResult = await this.syncInvoices(options.type, options.cursor);
              recordsProcessed += invResult.processed;
              recordsCreated += invResult.created;
              recordsUpdated += invResult.updated;
              recordsFailed += invResult.failed;
              break;

            case 'payments':
              const payResult = await this.syncPayments(options.type, options.cursor);
              recordsProcessed += payResult.processed;
              recordsCreated += payResult.created;
              recordsUpdated += payResult.updated;
              recordsFailed += payResult.failed;
              break;

            case 'contacts':
              const contactResult = await this.syncContacts();
              recordsProcessed += contactResult.processed;
              recordsCreated += contactResult.created;
              recordsUpdated += contactResult.updated;
              recordsFailed += contactResult.failed;
              break;

            case 'accounts':
              const acctResult = await this.syncAccounts();
              recordsProcessed += acctResult.processed;
              recordsCreated += acctResult.created;
              recordsUpdated += acctResult.updated;
              recordsFailed += acctResult.failed;
              break;

            default:
              this.logOperation('sync', { entity, message: `Unknown entity: ${entity}` });
          }
        } catch (error) {
          const errorMsg = `Failed to sync ${entity}: ${error instanceof Error ? error.message : 'Unknown'}`;
          errors.push(errorMsg);
          this.logError('sync', error as Error, { entity });
        }
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        cursor: undefined,
        metadata: { error: errors.length > 0 ? errors.join('; ') : undefined },
      };
    } catch (error) {
      this.logError('sync', error as Error);

      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ==========================================================================
  // Entity Sync Methods
  // ==========================================================================

  /**
   * Sync invoices from Xero
   */
  private async syncInvoices(
    syncType: SyncType,
    cursor?: string
  ): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    const modifiedSince = syncType === SyncType.INCREMENTAL && cursor 
      ? new Date(cursor) 
      : undefined;

    while (hasMore) {
      const response = await this.client!.getInvoices({
        page,
        modifiedSince,
      });

      for (const xeroInvoice of response.invoices) {
        try {
          const existing = await db.query.externalInvoices.findFirst({
            where: and(
              eq(externalInvoices.externalId, xeroInvoice.InvoiceID),
              eq(externalInvoices.organizationId, this.config!.organizationId),
              eq(externalInvoices.externalProvider, 'XERO')
            ),
          });

          const invoiceData = {
            invoiceNumber: xeroInvoice.InvoiceNumber,
            customerId: xeroInvoice.Contact.ContactID,
            customerName: xeroInvoice.Contact.Name,
            invoiceDate: xeroInvoice.DateString,
            dueDate: xeroInvoice.DueDateString ?? null,
            totalAmount: xeroInvoice.Total.toFixed(2),
            balanceAmount: xeroInvoice.AmountDue.toFixed(2),
            status: xeroInvoice.Status.toLowerCase(),
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalInvoices)
              .set(invoiceData)
              .where(eq(externalInvoices.id, existing.id));
            updated++;
          } else {
            await db.insert(externalInvoices).values({
              organizationId: this.config!.organizationId,
              externalId: xeroInvoice.InvoiceID,
              externalProvider: 'XERO',
              ...invoiceData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncInvoices', error as Error, { invoiceId: xeroInvoice.InvoiceID });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync payments from Xero
   */
  private async syncPayments(
    syncType: SyncType,
    cursor?: string
  ): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    const modifiedSince = syncType === SyncType.INCREMENTAL && cursor 
      ? new Date(cursor) 
      : undefined;

    while (hasMore) {
      const response = await this.client!.getPayments({
        page,
        modifiedSince,
      });

      for (const xeroPayment of response.payments) {
        try {
          const existing = await db.query.externalPayments.findFirst({
            where: and(
              eq(externalPayments.externalId, xeroPayment.PaymentID),
              eq(externalPayments.organizationId, this.config!.organizationId),
              eq(externalPayments.externalProvider, 'XERO')
            ),
          });

          // Get contact name from invoice
          let customerName = '';
          try {
            const invoice = await this.client!.getInvoice(xeroPayment.Invoice.InvoiceID);
            customerName = invoice.Contact.Name;
          } catch {
            // Use invoice number if contact lookup fails
            customerName = xeroPayment.Invoice.InvoiceNumber;
          }

          const paymentData = {
            customerId: xeroPayment.Invoice.InvoiceID, // Using invoice ID as reference
            customerName,
            paymentDate: xeroPayment.Date,
            amount: xeroPayment.Amount.toFixed(2),
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalPayments)
              .set(paymentData)
              .where(eq(externalPayments.id, existing.id));
            updated++;
          } else {
            await db.insert(externalPayments).values({
              organizationId: this.config!.organizationId,
              externalId: xeroPayment.PaymentID,
              externalProvider: 'XERO',
              ...paymentData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPayments', error as Error, { paymentId: xeroPayment.PaymentID });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync contacts (customers) from Xero
   */
  private async syncContacts(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getContacts({ page });

      for (const xeroContact of response.contacts) {
        try {
          const existing = await db.query.externalCustomers.findFirst({
            where: and(
              eq(externalCustomers.externalId, xeroContact.ContactID),
              eq(externalCustomers.organizationId, this.config!.organizationId),
              eq(externalCustomers.externalProvider, 'XERO')
            ),
          });

          const customerData = {
            name: xeroContact.Name,
            companyName: xeroContact.Name, // Xero uses Name for both
            email: xeroContact.EmailAddress,
            phone: xeroContact.ContactNumber,
            balance: '0.00', // Xero doesn&apos;t provide balance directly in contact
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalCustomers)
              .set(customerData)
              .where(eq(externalCustomers.id, existing.id));
            updated++;
          } else {
            await db.insert(externalCustomers).values({
              organizationId: this.config!.organizationId,
              externalId: xeroContact.ContactID,
              externalProvider: 'XERO',
              ...customerData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncContacts', error as Error, { contactId: xeroContact.ContactID });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync chart of accounts from Xero
   */
  private async syncAccounts(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getAccounts({ page });

      for (const xeroAccount of response.accounts) {
        try {
          const existing = await db.query.externalAccounts.findFirst({
            where: and(
              eq(externalAccounts.externalId, xeroAccount.AccountID),
              eq(externalAccounts.organizationId, this.config!.organizationId),
              eq(externalAccounts.externalProvider, 'XERO')
            ),
          });

          const accountData = {
            accountName: xeroAccount.Name,
            accountType: xeroAccount.Type,
            accountSubType: xeroAccount.Code, // Using account code as subtype
            classification: xeroAccount.Class || null,
            currentBalance: '0.00', // Xero doesn&apos;t provide balance in account list
            isActive: xeroAccount.Status === 'ACTIVE',
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalAccounts)
              .set(accountData)
              .where(eq(externalAccounts.id, existing.id));
            updated++;
          } else {
            await db.insert(externalAccounts).values({
              organizationId: this.config!.organizationId,
              externalId: xeroAccount.AccountID,
              externalProvider: 'XERO',
              ...accountData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncAccounts', error as Error, { accountId: xeroAccount.AccountID });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  // ==========================================================================
  // Webhook Support
  // ==========================================================================

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    // Xero uses HMAC SHA256 for webhook verification
    // Implementation would verify X-Xero-Signature header
    return true; // Simplified for now
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { eventType: event.type, message: `Processing ${event.type}` });

    // Xero sends webhook events for various entity changes
    const payload = event.data as { events?: Array<{ resourceUrl: string; eventCategory: string }> };
    
    if (payload.events) {
      for (const evt of payload.events) {
        this.logOperation('webhook', {
          resourceUrl: evt.resourceUrl,
          eventCategory: evt.eventCategory,
          message: `Entity ${evt.resourceUrl} changed: ${evt.eventCategory}`,
        });
        // Could trigger targeted sync here
      }
    }
  }
}
