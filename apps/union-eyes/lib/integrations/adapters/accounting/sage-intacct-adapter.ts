/**
 * Sage Intacct Integration Adapter
 * 
 * Enterprise cloud financial management system integration.
 * 
 * Features:
 * - Session-based authentication
 * - Multi-entity support
 * - Full and incremental sync
 * - Invoice, payment, customer, and GL account entities
 * 
 * @see https://developer.intacct.com/web-services/
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
import { SageIntacctClient, type SageIntacctConfig } from './sage-intacct-client';
import { db } from '@/db';
import { externalInvoices, externalPayments, externalCustomers, externalAccounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Sage Intacct Adapter
// ============================================================================

export class SageIntacctAdapter extends BaseIntegration {
  private client?: SageIntacctClient;
  private readonly PAGE_SIZE = 100;

  constructor() {
    super(IntegrationType.ACCOUNTING, IntegrationProvider.SAGE_INTACCT, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false, // Sage Intacct uses polling, not webhooks
      supportsRealTime: false,
      supportedEntities: ['invoices', 'payments', 'customers', 'accounts'],
      requiresOAuth: false, // Uses session-based auth
      rateLimitPerMinute: 300, // Varies by plan, conservative estimate
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const intacctConfig: SageIntacctConfig = {
        companyId: (this.config!.credentials.metadata?.companyId as string) || '',
        userId: (this.config!.credentials.metadata?.userId as string) || '',
        userPassword: (this.config!.credentials.metadata?.password as string) || '',
        senderId: (this.config!.credentials.metadata?.senderId as string) || '',
        senderPassword: (this.config!.credentials.metadata?.senderPassword as string) || '',
        entityId: (this.config!.settings?.entityId as string) || undefined,
        environment: (this.config!.settings?.environment as SageIntacctConfig['environment']) || 'production',
      };

      this.client = new SageIntacctClient(intacctConfig);
      await this.client.authenticate();
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Sage Intacct' });
    } catch (error) {
      this.logError('connect', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Sage Intacct' });
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
              const payResult = await this.syncPayments();
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
              this.logOperation('sync', { message: `Unknown entity: ${entity}` });
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
   * Sync invoices from Sage Intacct
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
        pageSize: this.PAGE_SIZE,
        offset,
        modifiedSince,
      });

      for (const invoice of response.invoices) {
        try {
          const existing = await db.query.externalInvoices.findFirst({
            where: and(
              eq(externalInvoices.externalId, invoice.RECORDNO),
              eq(externalInvoices.organizationId, this.config!.organizationId),
              eq(externalInvoices.externalProvider, 'SAGE_INTACCT')
            ),
          });

          const invoiceData = {
            invoiceNumber: invoice.RECORDID,
            customerId: invoice.CUSTOMERID,
            customerName: invoice.CUSTOMERNAME,
            invoiceDate: invoice.WHENCREATED,
            dueDate: invoice.WHENDUE || null,
            totalAmount: (typeof invoice.TOTALENTERED === 'number' ? invoice.TOTALENTERED : parseFloat(invoice.TOTALENTERED)).toFixed(2),
            balanceAmount: (typeof invoice.TOTALDUE === 'number' ? invoice.TOTALDUE : parseFloat(invoice.TOTALDUE)).toFixed(2),
            status: invoice.STATE.toLowerCase(),
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
              externalId: invoice.RECORDNO,
              externalProvider: 'SAGE_INTACCT',
              ...invoiceData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncInvoices', error as Error, { invoiceId: invoice.RECORDNO });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.PAGE_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync payments from Sage Intacct
   */
  private async syncPayments(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getPayments({
        pageSize: this.PAGE_SIZE,
        offset,
      });

      for (const payment of response.payments) {
        try {
          const existing = await db.query.externalPayments.findFirst({
            where: and(
              eq(externalPayments.externalId, payment.RECORDNO),
              eq(externalPayments.organizationId, this.config!.organizationId),
              eq(externalPayments.externalProvider, 'SAGE_INTACCT')
            ),
          });

          const paymentData = {
            customerId: payment.CUSTOMERID,
            customerName: payment.CUSTOMERNAME,
            paymentDate: payment.WHENPAID,
            amount: (typeof payment.AMOUNTPAID === 'number' ? payment.AMOUNTPAID : parseFloat(payment.AMOUNTPAID)).toFixed(2),
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
              externalId: payment.RECORDNO,
              externalProvider: 'SAGE_INTACCT',
              ...paymentData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPayments', error as Error, { paymentId: payment.RECORDNO });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.PAGE_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync customers from Sage Intacct
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
        pageSize: this.PAGE_SIZE,
        offset,
      });

      for (const customer of response.customers) {
        try {
          const existing = await db.query.externalCustomers.findFirst({
            where: and(
              eq(externalCustomers.externalId, customer.RECORDNO),
              eq(externalCustomers.organizationId, this.config!.organizationId),
              eq(externalCustomers.externalProvider, 'SAGE_INTACCT')
            ),
          });

          const customerData = {
            name: customer.NAME,
            companyName: customer.NAME,
            email: customer.EMAIL1,
            phone: customer.PHONE1,
            balance: '0.00', // Would need separate query for balance
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
              externalId: customer.RECORDNO,
              externalProvider: 'SAGE_INTACCT',
              ...customerData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncCustomers', error as Error, { customerId: customer.RECORDNO });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.PAGE_SIZE;
    }

    return { processed, created, updated, failed };
  }

  /**
   * Sync GL accounts from Sage Intacct
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
        pageSize: this.PAGE_SIZE,
        offset,
      });

      for (const account of response.accounts) {
        try {
          const existing = await db.query.externalAccounts.findFirst({
            where: and(
              eq(externalAccounts.externalId, account.RECORDNO),
              eq(externalAccounts.organizationId, this.config!.organizationId),
              eq(externalAccounts.externalProvider, 'SAGE_INTACCT')
            ),
          });

          const accountData = {
            accountName: account.TITLE,
            accountType: account.ACCOUNTTYPE,
            accountSubType: account.ACCOUNTNO,
            classification: account.CLOSINGTYPE === 'balance_sheet' ? 'Asset/Liability' : 'Revenue/Expense',
            currentBalance: '0.00', // Would need separate query
            isActive: account.STATUS.toLowerCase() === 'active',
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
              externalId: account.RECORDNO,
              externalProvider: 'SAGE_INTACCT',
              ...accountData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncAccounts', error as Error, { accountId: account.RECORDNO });
          failed++;
        }
      }

      hasMore = response.hasMore;
      offset += this.PAGE_SIZE;
    }

    return { processed, created, updated, failed };
  }

  // ==========================================================================
  // Webhook Support (Not Supported)
  // ==========================================================================

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    // Sage Intacct doesn&apos;t support webhooks
    return false;
  }

  async processWebhook(_event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { message: 'Sage Intacct does not support webhooks' });
  }
}
