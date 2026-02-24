/**
 * Sync Engine
 * Orchestrates data synchronization between external systems and UnionEyes
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { integrationSyncLog, syncJobs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import cron from 'node-cron';
import {
  _IntegrationType,
  IntegrationProvider,
  SyncType,
  SyncStatus,
  SyncOptions,
  SyncResult,
  IntegrationError,
} from './types';
import { IntegrationFactory } from './factory';

/**
 * Sync job configuration
 */
export interface SyncJobConfig {
  organizationId: string;
  provider: IntegrationProvider;
  type: SyncType;
  entities?: string[];
  schedule?: string; // Cron expression
  enabled: boolean;
  lastSyncAt?: Date;
  cursor?: string;
}

/**
 * Sync Engine
 * Manages sync jobs and execution
 */
export class SyncEngine {
  private static instance: SyncEngine;
  private factory: IntegrationFactory;
  private runningJobs: Set<string> = new Set();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {
    this.factory = IntegrationFactory.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Execute sync job
   */
  async executeSync(
    organizationId: string,
    provider: IntegrationProvider,
    options: SyncOptions
  ): Promise<SyncResult> {
    const jobKey = `${organizationId}:${provider}:${options.type}`;

    // Check if job already running
    if (this.runningJobs.has(jobKey)) {
      throw new IntegrationError(
        'Sync job already running',
        provider,
        'SYNC_IN_PROGRESS'
      );
    }

    this.runningJobs.add(jobKey);
    const startTime = Date.now();

    try {
      logger.info('Starting sync job', {
        organizationId,
        provider,
        syncType: options.type,
        entities: options.entities,
      });

      // Create sync log entry
      const logId = await this.createSyncLog(organizationId, provider, options);

      // Get integration instance
      const integration = await this.factory.getIntegration(organizationId, provider);

      // Determine sync parameters
      const syncOptions = await this.prepareSyncOptions(
        organizationId,
        provider,
        options
      );

      // Execute sync
      const result = await integration.sync(syncOptions);

      // Update sync log
      await this.updateSyncLog(logId, {
        status: result.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        cursor: result.cursor,
        error: result.errors?.[0]?.error,
        completedAt: new Date(),
      });

      logger.info('Sync job completed', {
        organizationId,
        provider,
        success: result.success,
        recordsProcessed: result.recordsProcessed,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Sync job failed', error instanceof Error ? error : new Error(errorMessage), {
        organizationId,
        provider,
        syncType: options.type,
        durationMs: Date.now() - startTime,
      });

      throw error;
    } finally {
      this.runningJobs.delete(jobKey);
    }
  }

  /**
   * Execute full sync
   */
  async executeFullSync(
    organizationId: string,
    provider: IntegrationProvider,
    entities?: string[]
  ): Promise<SyncResult> {
    return this.executeSync(organizationId, provider, {
      type: SyncType.FULL,
      entities,
    });
  }

  /**
   * Execute incremental sync
   */
  async executeIncrementalSync(
    organizationId: string,
    provider: IntegrationProvider,
    entities?: string[]
  ): Promise<SyncResult> {
    // Get last sync timestamp and cursor
    const lastSync = await this.getLastSync(organizationId, provider);

    return this.executeSync(organizationId, provider, {
      type: SyncType.INCREMENTAL,
      entities,
      since: lastSync?.completedAt,
      cursor: lastSync?.cursor,
    });
  }

  /**
   * Schedule sync job
   */
  async scheduleSync(config: SyncJobConfig): Promise<void> {
    logger.info('Sync job scheduled', {
      organizationId: config.organizationId,
      provider: config.provider,
      schedule: config.schedule,
      type: config.type,
    });

    // Store sync job configuration in database
    await db.insert(syncJobs).values({
      organizationId: config.organizationId,
      connectorId: '', // Would need to resolve connector ID from provider
      entityType: config.entities?.join(',') || 'all',
      direction: 'pull',
      status: 'pending',
      startedAt: new Date(),
      metadata: {
        provider: config.provider,
        syncType: config.type,
        schedule: config.schedule,
        enabled: config.enabled,
      },
    });

    const jobKey = `${config.organizationId}:${config.provider}:${config.type}`;

    if (!config.schedule || !config.enabled) {
      const existing = this.scheduledTasks.get(jobKey);
      if (existing) {
        existing.stop();
        this.scheduledTasks.delete(jobKey);
      }
      return;
    }

    if (!cron.validate(config.schedule)) {
      throw new IntegrationError(
        `Invalid cron expression: ${config.schedule}`,
        config.provider,
        'INVALID_SCHEDULE'
      );
    }

    const existing = this.scheduledTasks.get(jobKey);
    if (existing) {
      existing.stop();
      this.scheduledTasks.delete(jobKey);
    }

    const task = cron.schedule(config.schedule, async () => {
      try {
        await this.executeSync(config.organizationId, config.provider, {
          type: config.type,
          entities: config.entities,
        });
      } catch (error) {
        logger.error('Scheduled sync job failed', error instanceof Error ? error : new Error(String(error)), {
          organizationId: config.organizationId,
          provider: config.provider,
          syncType: config.type,
        });
      }
    });

    this.scheduledTasks.set(jobKey, task);
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    organizationId: string,
    provider?: IntegrationProvider,
    limit: number = 50
  ): Promise<unknown[]> {
    const conditions = [eq(integrationSyncLog.organizationId, organizationId)];

    if (provider) {
      conditions.push(eq(integrationSyncLog.provider, provider));
    }

    return db
      .select()
      .from(integrationSyncLog)
      .where(and(...conditions))
      .orderBy(desc(integrationSyncLog.startedAt))
      .limit(limit);
  }

  /**
   * Get last successful sync
   */
  private async getLastSync(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<unknown> {
    const [lastSync] = await db
      .select()
      .from(integrationSyncLog)
      .where(
        and(
          eq(integrationSyncLog.organizationId, organizationId),
          eq(integrationSyncLog.provider, provider),
          eq(integrationSyncLog.status, SyncStatus.SUCCESS)
        )
      )
      .orderBy(desc(integrationSyncLog.completedAt))
      .limit(1);

    return lastSync;
  }

  /**
   * Prepare sync options based on last sync
   */
  private async prepareSyncOptions(
    organizationId: string,
    provider: IntegrationProvider,
    options: SyncOptions
  ): Promise<SyncOptions> {
    if (options.type === SyncType.FULL) {
      return options;
    }

    // For incremental sync, get cursor and timestamp from last sync
    if (!options.since || !options.cursor) {
      const lastSync = await this.getLastSync(organizationId, provider);
      return {
        ...options,
        since: options.since || lastSync?.completedAt,
        cursor: options.cursor || lastSync?.cursor,
      };
    }

    return options;
  }

  /**
   * Create sync log entry
   */
  private async createSyncLog(
    organizationId: string,
    provider: IntegrationProvider,
    options: SyncOptions
  ): Promise<string> {
    const [log] = await db
      .insert(integrationSyncLog)
      .values({
        organizationId,
        provider,
        syncType: options.type,
        entities: options.entities || [],
        status: SyncStatus.RUNNING,
        startedAt: new Date(),
      })
      .returning({ id: integrationSyncLog.id });

    return log.id;
  }

  /**
   * Update sync log entry
   */
  private async updateSyncLog(
    logId: string,
    updates: {
      status: SyncStatus;
      recordsProcessed?: number;
      recordsCreated?: number;
      recordsUpdated?: number;
      recordsFailed?: number;
      cursor?: string;
      error?: string;
      completedAt?: Date;
    }
  ): Promise<void> {
    await db
      .update(integrationSyncLog)
      .set(updates)
      .where(eq(integrationSyncLog.id, logId));
  }

  /**
   * Check if sync is currently running
   */
  isSyncRunning(
    organizationId: string,
    provider: IntegrationProvider,
    type: SyncType
  ): boolean {
    const jobKey = `${organizationId}:${provider}:${type}`;
    return this.runningJobs.has(jobKey);
  }
}

/**
 * Convenience functions
 */

export async function executeFullSync(
  organizationId: string,
  provider: IntegrationProvider,
  entities?: string[]
): Promise<SyncResult> {
  const engine = SyncEngine.getInstance();
  return engine.executeFullSync(organizationId, provider, entities);
}

export async function executeIncrementalSync(
  organizationId: string,
  provider: IntegrationProvider,
  entities?: string[]
): Promise<SyncResult> {
  const engine = SyncEngine.getInstance();
  return engine.executeIncrementalSync(organizationId, provider, entities);
}

export async function getSyncHistory(
  organizationId: string,
  provider?: IntegrationProvider,
  limit?: number
): Promise<unknown[]> {
  const engine = SyncEngine.getInstance();
  return engine.getSyncHistory(organizationId, provider, limit);
}
