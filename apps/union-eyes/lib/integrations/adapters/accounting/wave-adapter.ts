/**
 * Wave Integration Adapter
 * 
 * Free cloud accounting software with GraphQL API.
 * 
 * Features:
 * - OAuth2 authentication
 * - GraphQL API
 * - Full sync (no incremental - Wave doesn&apos;t provide modification dates easily)
 * - Invoice, customer, payment entities
 * 
 * @see https://developer.waveapps.com/hc/en-us
 */

import { BaseIntegration } from '../../base-integration';
import {
  IntegrationType,
  IntegrationProvider,
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
  ConnectionStatus,
} from '../../types';
import { WaveClient, type WaveConfig } from './wave-client';
import { db } from '@/db';
import { externalInvoices, externalPayments, externalCustomers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Wave Adapter
// ============================================================================

export class WaveAdapter extends BaseIntegration {
  private client?: WaveClient;
  private readonly PAGE_SIZE = 50;

  constructor() {
    super(IntegrationType.ACCOUNTING, IntegrationProvider.WAVE, {
      supportsFullSync: true,
      supportsIncrementalSync: false, // Wave GraphQL doesn&apos;t easily support incremental
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['invoices', 'payments', 'customers'],
      requiresOAuth: true,
      rateLimitPerMinute: 300,
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const waveConfig: WaveConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        businessId: (this.config!.settings?.businessId as string) || '',
        refreshToken: this.config!.credentials.refreshToken,
        environment: 'production',
      };

      this.client = new WaveClient(waveConfig);
      await this.client.authenticate();
      
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Wave' });
    } catch (error) {
      this.logError('connect', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Wave' });
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
              const invResult = await this.syncInvoices();
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

  private async syncInvoices(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getInvoices({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const invoice of response.invoices) {
        try {
          const existing = await db.query.externalInvoices.findFirst({
            where: and(
              eq(externalInvoices.externalId, invoice.id),
              eq(externalInvoices.organizationId, this.config!.organizationId),
              eq(externalInvoices.externalProvider, 'WAVE')
            ),
          });

          const invoiceData = {
            invoiceNumber: invoice.invoiceNumber,
            customerId: invoice.customer.id,
            customerName: invoice.customer.name,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            totalAmount: invoice.total.toFixed(2),
            balanceAmount: invoice.amountDue.toFixed(2),
            status: invoice.status.toLowerCase(),
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
              externalId: invoice.id,
              externalProvider: 'WAVE',
              ...invoiceData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncInvoices', error as Error, { invoiceId: invoice.id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncPayments(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getPayments({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const payment of response.payments) {
        try {
          const existing = await db.query.externalPayments.findFirst({
            where: and(
              eq(externalPayments.externalId, payment.id),
              eq(externalPayments.organizationId, this.config!.organizationId),
              eq(externalPayments.externalProvider, 'WAVE')
            ),
          });

          const paymentData = {
            customerId: payment.customer.id,
            customerName: payment.customer.name,
            paymentDate: payment.date,
            amount: payment.amount.toFixed(2),
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
              externalId: payment.id,
              externalProvider: 'WAVE',
              ...paymentData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPayments', error as Error, { paymentId: payment.id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncCustomers(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getCustomers({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const customer of response.customers) {
        try {
          const existing = await db.query.externalCustomers.findFirst({
            where: and(
              eq(externalCustomers.externalId, customer.id),
              eq(externalCustomers.organizationId, this.config!.organizationId),
              eq(externalCustomers.externalProvider, 'WAVE')
            ),
          });

          const customerData = {
            name: customer.name,
            companyName: customer.name,
            email: customer.email,
            phone: customer.phone,
            balance: '0.00', // Wave doesn&apos;t provide balance easily
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
              externalId: customer.id,
              externalProvider: 'WAVE',
              ...customerData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncCustomers', error as Error, { customerId: customer.id });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page++;
    }

    return { processed, created, updated, failed };
  }

  // ==========================================================================
  // Webhook Support (Not Supported)
  // ==========================================================================

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    return false;
  }

  async processWebhook(_event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { message: 'Wave does not support webhooks' });
  }
}
