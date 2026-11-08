/**
 * Sync Engine
 * Orchestrates data synchronization between external systems and UnionEyes
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { integrationSyncLog } from '@/db/schema';
import { integrationProviderEnum, syncStatusEnum, syncTypeEnum } from '@/db/schema/domains/infrastructure/integrations';
import { eq, and, desc } from 'drizzle-orm';
import cron, { type ScheduledTask } from 'node-cron';
import { acquireLock, releaseLock, extendLock, isLocked } from '@/lib/services/cache-service';
import {
  IntegrationProvider,
  SyncType,
  SyncStatus,
  SyncOptions,
  SyncResult,
  IntegrationError,
} from './types';
import { IntegrationFactory } from './factory';

type DbIntegrationProvider = (typeof integrationProviderEnum.enumValues)[number];
type DbSyncStatus = (typeof syncStatusEnum.enumValues)[number];
type DbSyncType = (typeof syncTypeEnum.enumValues)[number];

/**
 * Sync job configuration
 */
export interface SyncJobConfig {
  organizationId: string;
  provider: IntegrationProvider;
  type: SyncType;
  orgs?: string[];
  schedule?: string; // Cron expression
  enabled: boolean;
  lastSyncAt?: Date;
  cursor?: string;
}

/**
 * Sync Engine
 * Manages sync jobs and execution
 */
// A sync's external network calls (HRIS/accounting/insurance providers) have no fixed upper bound, so the lock TTL is a
// generous safety net, not the normal release path: the finally block below releases it immediately on completion.
// A lock that outlives a crashed process still expires instead of blocking that job forever.
const SYNC_LOCK_TTL_SECONDS = 600;
const SYNC_LOCK_NAMESPACE = 'integration-sync';
// Renew at roughly half the TTL so at least one renewal attempt can still land (and be retried by the next tick) before
// the lock would otherwise expire from a missed or slow renewal.
const SYNC_LOCK_RENEWAL_INTERVAL_MS = (SYNC_LOCK_TTL_SECONDS * 1000) / 2;

export class SyncEngine {
  private static instance: SyncEngine;
  private factory: IntegrationFactory;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();

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
    if (options.trustedContext) {
      if (
        options.trustedContext.organizationId !== organizationId ||
        options.trustedContext.provider !== provider
      ) {
        throw new IntegrationError(
          'Trusted integration execution context does not match requested sync target',
          provider,
          'TRUSTED_CONTEXT_MISMATCH'
        );
      }
    }

    const jobKey = `${organizationId}:${provider}:${options.type}`;

    // A distributed lock (not a process-local Set) so two instances of this app cannot run the same
    // organization/provider/type sync at once.
    const lockToken = await acquireLock(jobKey, SYNC_LOCK_TTL_SECONDS, SYNC_LOCK_NAMESPACE);
    if (!lockToken) {
      throw new IntegrationError(
        'Sync job already running',
        provider,
        'SYNC_IN_PROGRESS'
      );
    }

    // Fires the moment the lease can no longer be confirmed, so the integration (if it checks options.abortSignal
    // between external calls - see BaseIntegration.throwIfAborted) stops making further ones instead of continuing
    // unsupervised, and so this method itself stops waiting on/trusting the sync's eventual result (see the race
    // below). JavaScript has no true preemption: a call already in flight at the moment of loss still completes and
    // its side effects still happen: this narrows the window of unsupervised work for an adapter that cooperates,
    // it does not guarantee zero overlap for one that does not.
    const abortController = new AbortController();

    // A sync whose external calls run longer than the TTL must keep renewing its own lock, or a second instance would
    // acquire the same jobKey while this one is still running. The renewal is token-bound (cache-service's extendLock
    // only extends the TTL if the stored value still matches our token), so it can never extend a lock another holder
    // has since acquired. If a renewal tick fails - the token no longer matches (another holder won the lock after an
    // expiry) or Redis could not be reached to confirm - the lease is treated as lost: no further renewal is attempted
    // (a lock we no longer provably hold must not keep being claimed), the abort signal fires, and the eventual result
    // is downgraded below rather than reported as a clean, fully-exclusive success.
    let leaseLost = false;
    let renewalInFlight = false;
    const renewalTimer: ReturnType<typeof setInterval> = setInterval(() => {
      if (renewalInFlight || leaseLost) return;
      renewalInFlight = true;
      extendLock(jobKey, lockToken, SYNC_LOCK_TTL_SECONDS, SYNC_LOCK_NAMESPACE)
        .then((renewed) => {
          if (!renewed && !leaseLost) {
            leaseLost = true;
            clearInterval(renewalTimer);
            abortController.abort(new Error('SYNC_LEASE_RENEWAL_FAILED'));
            logger.error('Sync lease lost: renewal did not confirm this instance still holds the lock', new Error('SYNC_LEASE_RENEWAL_FAILED'), {
              organizationId,
              provider,
              syncType: options.type,
            });
          }
        })
        .catch((error) => {
          // extendLock itself fails closed (catches internally and returns false), so reaching a rejection here would be
          // unexpected; still treat it as lease loss rather than silently keep going on an unconfirmed lock.
          if (!leaseLost) {
            leaseLost = true;
            clearInterval(renewalTimer);
            abortController.abort(error instanceof Error ? error : new Error(String(error)));
            logger.error('Sync lease renewal threw unexpectedly', error instanceof Error ? error : new Error(String(error)), {
              organizationId,
              provider,
              syncType: options.type,
            });
          }
        })
        .finally(() => {
          renewalInFlight = false;
        });
    }, SYNC_LOCK_RENEWAL_INTERVAL_MS);

    const startTime = Date.now();
    let logId: string | undefined;

    try {
      logger.info('Starting sync job', {
        organizationId,
        provider,
        syncType: options.type,
        orgs: options.orgs,
      });

      // Create sync log entry
      logId = await this.createSyncLog(organizationId, provider, options);

      // Get integration instance
      const integration = await this.factory.getIntegration(organizationId, provider);

      // Determine sync parameters
      const preparedOptions = await this.prepareSyncOptions(
        organizationId,
        provider,
        options
      );
      const syncOptions: SyncOptions = { ...preparedOptions, abortSignal: abortController.signal };

      // Races the integration's sync() against the lease-loss signal. If the lease is lost before sync() resolves,
      // this method stops waiting on it rather than trusting however much further progress it silently makes: the
      // eventual settlement is still observed in the background (logged, never thrown as an unhandled rejection)
      // for operator forensics, but it is not what gets reported as this call's result.
      const syncPromise = integration.sync(syncOptions);
      const abortedEarly = await Promise.race([
        syncPromise.then(() => false as const),
        new Promise<true>((resolve) => {
          if (abortController.signal.aborted) {
            resolve(true);
            return;
          }
          abortController.signal.addEventListener('abort', () => resolve(true), { once: true });
        }),
      ]);

      if (abortedEarly) {
        // The integration either does not check the abort signal, or had not yet reached a checkpoint when the
        // lease was lost: either way, this call no longer waits for or trusts its result. Observe what eventually
        // happens without letting it crash the process or feed back into the result already being returned.
        void syncPromise
          .then((lateResult) => {
            logger.warn('Sync result arrived after the lease was already lost and the run was reported cancelled; it was not applied', {
              organizationId,
              provider,
              syncType: options.type,
              lateSuccess: lateResult.success,
              lateRecordsProcessed: lateResult.recordsProcessed,
            });
          })
          .catch((lateError) => {
            logger.warn('Sync eventually failed after the lease was already lost and the run was reported cancelled', {
              organizationId,
              provider,
              syncType: options.type,
              lateError: lateError instanceof Error ? lateError.message : String(lateError),
            });
          });

        const cancelledResult: SyncResult = {
          success: false,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [{ entity: 'sync', error: 'Sync lease was lost; the run was cancelled before it could be confirmed complete' }] as any,
          metadata: { leaseRenewalLost: true, abortedEarly: true },
        };

        await this.updateSyncLog(logId, organizationId, {
          status: SyncStatus.CANCELLED,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          error: 'Sync lease renewal failed or was lost before the run could be confirmed complete; the run was cancelled rather than trusted.',
          completedAt: new Date(),
        });

        logger.error('Sync job cancelled: lease lost before completion could be confirmed', new Error('SYNC_LEASE_LOST'), {
          organizationId,
          provider,
          syncType: options.type,
          durationMs: Date.now() - startTime,
        });

        return cancelledResult;
      }

      const result = await syncPromise;

      // A lease lost mid-run means exclusivity could not be guaranteed for the full duration: a real success is not
      // reported as a clean one, so an operator reviewing sync history can go looking for a possible concurrent/duplicate
      // run instead of trusting the result at face value. A sync that already failed stays failed; the note is appended,
      // not used to mask the original error.
      const status = result.success
        ? (leaseLost ? SyncStatus.PARTIAL : SyncStatus.SUCCESS)
        : SyncStatus.FAILED;
      const leaseLostNote = 'Sync lease renewal failed or was lost during this run; exclusive ownership of the job lock is not guaranteed for its full duration.';
      const error = leaseLost
        ? [result.errors?.[0]?.error, leaseLostNote].filter(Boolean).join(' | ')
        : result.errors?.[0]?.error;

      // Update sync log
      await this.updateSyncLog(logId, organizationId, {
        status,
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        cursor: result.cursor,
        error,
        completedAt: new Date(),
      });

      logger.info('Sync job completed', {
        organizationId,
        provider,
        success: result.success,
        leaseLost,
        recordsProcessed: result.recordsProcessed,
        durationMs: Date.now() - startTime,
      });

      return leaseLost ? { ...result, metadata: { ...result.metadata, leaseRenewalLost: true } } : result;
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
      clearInterval(renewalTimer);
      await releaseLock(jobKey, lockToken, SYNC_LOCK_NAMESPACE);
    }
  }


  /**
   * Execute full sync
   */
  async executeFullSync(
    organizationId: string,
    provider: IntegrationProvider,
    orgs?: string[]
  ): Promise<SyncResult> {
    return this.executeSync(organizationId, provider, {
      type: SyncType.FULL,
      orgs,
    });
  }

  /**
   * Execute incremental sync
   */
  async executeIncrementalSync(
    organizationId: string,
    provider: IntegrationProvider,
    orgs?: string[]
  ): Promise<SyncResult> {
    // Get last sync timestamp and cursor
    const lastSync = await this.getLastSync(organizationId, provider);

    return this.executeSync(organizationId, provider, {
      type: SyncType.INCREMENTAL,
      orgs,
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
          orgs: config.orgs,
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
  ): Promise<any[]> {
    const conditions = [eq(integrationSyncLog.organizationId, organizationId)];

    if (provider) {
      conditions.push(eq(integrationSyncLog.provider, provider as DbIntegrationProvider));
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
  ): Promise<any> {
    const [lastSync] = await db
      .select()
      .from(integrationSyncLog)
      .where(
        and(
          eq(integrationSyncLog.organizationId, organizationId),
          eq(integrationSyncLog.provider, provider as DbIntegrationProvider),
          eq(integrationSyncLog.status, SyncStatus.SUCCESS as DbSyncStatus)
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
        provider: provider as DbIntegrationProvider,
        syncType: options.type as DbSyncType,
        orgs: options.orgs || [],
        status: SyncStatus.RUNNING as DbSyncStatus,
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
    organizationId: string,
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
      .set({ ...updates, status: updates.status as DbSyncStatus })
      .where(and(eq(integrationSyncLog.id, logId), eq(integrationSyncLog.organizationId, organizationId)));
  }

  /**
   * Check if sync is currently running (reads the distributed lock; does not acquire it).
   *
   * Returns null when Redis could not be reached to confirm either way - callers must not treat null the same as
   * false. A caller deciding whether it is safe to start something else should treat null as "unknown, do not assume
   * it is safe", not as a confirmed "not running".
   */
  async isSyncRunning(
    organizationId: string,
    provider: IntegrationProvider,
    type: SyncType
  ): Promise<boolean | null> {
    const jobKey = `${organizationId}:${provider}:${type}`;
    return isLocked(jobKey, SYNC_LOCK_NAMESPACE);
  }
}

/**
 * Convenience functions
 */

export async function executeFullSync(
  organizationId: string,
  provider: IntegrationProvider,
  orgs?: string[]
): Promise<SyncResult> {
  const engine = SyncEngine.getInstance();
  return engine.executeFullSync(organizationId, provider, orgs);
}

export async function executeIncrementalSync(
  organizationId: string,
  provider: IntegrationProvider,
  orgs?: string[]
): Promise<SyncResult> {
  const engine = SyncEngine.getInstance();
  return engine.executeIncrementalSync(organizationId, provider, orgs);
}

export async function getSyncHistory(
  organizationId: string,
  provider?: IntegrationProvider,
  limit?: number
): Promise<any[]> {
  const engine = SyncEngine.getInstance();
  return engine.getSyncHistory(organizationId, provider, limit);
}
