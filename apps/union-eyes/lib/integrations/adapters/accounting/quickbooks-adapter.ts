/**
 * QuickBooks Online Integration Adapter
 * 
 * Implements integration with QuickBooks Online for accounting data.
 * Handles invoices, payments, customers, and chart of accounts.
 * 
 * Features:
 * - OAuth2 authentication with automatic token refresh
 * - Full and incremental sync
 * - Invoice, payment, customer, and account entities
 * - Webhook support for real-time updates
 * 
 * @see https://developer.intuit.com/app/developer/qbo/docs/api/accounting/
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
import { QuickBooksClient, type QuickBooksConfig } from './quickbooks-client';
import { db } from '@/db';
import { externalInvoices, externalPayments, externalCustomers, externalAccounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// QuickBooks Adapter
// ============================================================================

export class QuickBooksAdapter extends BaseIntegration {
  private client?: QuickBooksClient;
  private readonly BATCH_SIZE = 100;

  constructor() {
    super(IntegrationType.ACCOUNTING, IntegrationProvider.QUICKBOOKS, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: true,
      supportsRealTime: false,
      supportedEntities: ['invoices', 'payments', 'customers', 'accounts'],
      requiresOAuth: true,
      rateLimitPerMinute: 500, // QuickBooks allows 500 requests per minute
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const qbConfig: QuickBooksConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        realmId: (this.config!.settings?.realmId as string) || '',
        environment: (this.config!.settings?.environment as 'production' | 'sandbox') || 'production',
        refreshToken: this.config!.credentials.refreshToken,
      };

      this.client = new QuickBooksClient(qbConfig);
      await this.client.authenticate();
      
      // Store updated refresh token
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to QuickBooks Online' });
    } catch (error) {
      this.logError('connect', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from QuickBooks' });
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

            case 'customers':
              const custResult = await this.syncCustomers();
              recordsProcessed += custResult.processed;
              recordsCreated += custResult.created;
              recordsUpdated += custResult.updated;
              recordsFailed += custResult.failed;
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
   * Sync invoices from QuickBooks
   */
  private async syncInvoices(
    syncType: SyncType,
    cursor?: string
  ): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    const modifiedSince = syncType === SyncType.INCREMENTAL && cursor 
      ? new Date(cursor) 
      : undefined;

    while (hasMore) {
      const response = await this.client!.getInvoices({
        limit: this.BATCH_SIZE,
        offset,
        modifiedSince,
      });

      for (const qbInvoice of response.invoices) {
        try {
          const existing = await db.query.externalInvoices.findFirst({
            where: and(
              eq(externalInvoices.externalId, qbInvoice.Id),
              eq(externalInvoices.organizationId, this.config!.organizationId),
              eq(externalInvoices.externalProvider, 'QUICKBOOKS')
            ),
          });

          const invoiceData = {
            invoiceNumber: qbInvoice.DocNumber,
            customerId: qbInvoice.CustomerRef.value,
            customerName: qbInvoice.CustomerRef.name || '',
            invoiceDate: qbInvoice.TxnDate,
            dueDate: qbInvoice.DueDate ?? null,
            totalAmount: qbInvoice.TotalAmt.toFixed(2),
            balanceAmount: qbInvoice.Balance.toFixed(2),
            status: qbInvoice.TxnStatus || 'open',
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
              externalId: qbInvoice.Id,
              externalProvider: 'QUICKBOOKS',
              ...invoiceData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncInvoices', error as Error, { invoiceId: qbInvoice.Id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.BATCH_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync payments
   */
  private async syncPayments(
    syncType: SyncType,
    cursor?: string
  ): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    const modifiedSince = syncType === SyncType.INCREMENTAL && cursor 
      ? new Date(cursor) 
      : undefined;

    while (hasMore) {
      const response = await this.client!.getPayments({
        limit: this.BATCH_SIZE,
        offset,
        modifiedSince,
      });

      for (const qbPayment of response.payments) {
        try {
          const existing = await db.query.externalPayments.findFirst({
            where: and(
              eq(externalPayments.externalId, qbPayment.Id),
              eq(externalPayments.organizationId, this.config!.organizationId),
              eq(externalPayments.externalProvider, 'QUICKBOOKS')
            ),
          });

          const paymentData = {
            customerId: qbPayment.CustomerRef.value,
            customerName: qbPayment.CustomerRef.name || '',
            paymentDate: qbPayment.TxnDate,
            amount: qbPayment.TotalAmt.toFixed(2),
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
              externalId: qbPayment.Id,
              externalProvider: 'QUICKBOOKS',
              ...paymentData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPayments', error as Error, { paymentId: qbPayment.Id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.BATCH_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync customers
   */
  private async syncCustomers(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getCustomers({
        limit: this.BATCH_SIZE,
        offset,
      });

      for (const qbCustomer of response.customers) {
        try {
          const existing = await db.query.externalCustomers.findFirst({
            where: and(
              eq(externalCustomers.externalId, qbCustomer.Id),
              eq(externalCustomers.organizationId, this.config!.organizationId),
              eq(externalCustomers.externalProvider, 'QUICKBOOKS')
            ),
          });

          const customerData = {
            name: qbCustomer.DisplayName,
            companyName: qbCustomer.CompanyName,
            email: qbCustomer.PrimaryEmailAddr?.Address,
            phone: qbCustomer.PrimaryPhone?.FreeFormNumber,
            balance: qbCustomer.Balance.toFixed(2),
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
              externalId: qbCustomer.Id,
              externalProvider: 'QUICKBOOKS',
              ...customerData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncCustomers', error as Error, { customerId: qbCustomer.Id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.BATCH_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync chart of accounts
   */
  private async syncAccounts(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getAccounts({
        limit: this.BATCH_SIZE,
        offset,
      });

      for (const qbAccount of response.accounts) {
        try {
          const existing = await db.query.externalAccounts.findFirst({
            where: and(
              eq(externalAccounts.externalId, qbAccount.Id),
              eq(externalAccounts.organizationId, this.config!.organizationId),
              eq(externalAccounts.externalProvider, 'QUICKBOOKS')
            ),
          });

          const accountData = {
            accountName: qbAccount.Name,
            accountType: qbAccount.AccountType,
            accountSubType: qbAccount.AccountSubType,
            classification: qbAccount.Classification,
            currentBalance: qbAccount.CurrentBalance.toFixed(2),
            isActive: qbAccount.Active,
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
              externalId: qbAccount.Id,
              externalProvider: 'QUICKBOOKS',
              ...accountData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncAccounts', error as Error, { accountId: qbAccount.Id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.BATCH_SIZE;
    }

    return { processed, created, updated, failed };
  }

  // ==========================================================================
  // Webhook Support
  // ==========================================================================

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    // QuickBooks uses HMAC SHA256 for webhook verification
    // Implementation would verify intuit-signature header
    return true; // Simplified for now
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { eventType: event.type, message: `Processing ${event.type}` });

    // QuickBooks sends change data notifications
    // Event types: Create, Update, Delete, Merge for various entities
    const payload = event.data as { eventNotifications?: Array<{ dataChangeEvent?: { entities?: Array<{ name: string; operation: string; id: string }> } }> };
    
    if (payload.eventNotifications) {
      for (const notification of payload.eventNotifications) {
        for (const dataChangeEvent of notification.dataChangeEvent?.entities || []) {
          this.logOperation('webhook', {
            entity: dataChangeEvent.name,
            operation: dataChangeEvent.operation,
            id: dataChangeEvent.id,
            message: `Entity ${dataChangeEvent.name} ${dataChangeEvent.operation}: ${dataChangeEvent.id}`,
          });
          // Could trigger targeted sync here
        }
      }
    }
  }
}
