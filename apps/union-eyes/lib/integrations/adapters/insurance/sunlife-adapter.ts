/**
 * Sun Life Financial Integration Adapter
 * 
 * Syncs group benefits data from Sun Life:
 * - Benefit plans
 * - Employee enrollments
 * - Dependents
 * - Coverage details
 * 
 * Features:
 * - Full and incremental sync
 * - Organization isolation
 * - Automatic retry on token expiry
 */

import { BaseIntegration } from '../../base-integration';
import {
  IntegrationType,
  IntegrationProvider,
  SyncOptions,
  SyncResult,
  SyncError,
  HealthCheckResult,
  ConnectionStatus,
  WebhookEvent,
} from '../../types';
import { SunLifeClient, type SunLifeConfig } from './sunlife-client';
import { db } from '@/db';
import { 
  externalBenefitPlans, 
  externalBenefitEnrollments,
  externalBenefitDependents,
  externalBenefitCoverage 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Sun Life Adapter
// ============================================================================

export class SunLifeAdapter extends BaseIntegration {
  private client?: SunLifeClient;
  private readonly PAGE_SIZE = 100;

  constructor() {
    super(IntegrationType.INSURANCE, IntegrationProvider.SUNLIFE, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['plans', 'enrollments', 'dependents', 'coverage'],
      requiresOAuth: true,
      rateLimitPerMinute: 200,
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const sunLifeConfig: SunLifeConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        groupNumber: (this.config!.settings?.groupNumber as string) || '',
        refreshToken: this.config!.credentials.refreshToken,
        environment: 'production',
      };

      this.client = new SunLifeClient(sunLifeConfig);
      await this.client.authenticate();
      
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Sun Life' });
    } catch (error) {
      this.logError('connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Sun Life' });
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      this.ensureConnected();

      const startTime = Date.now();
      const isHealthy = await this.client!.healthCheck();
      const latency = Date.now() - startTime;

      return {
        healthy: isHealthy,
        status: ConnectionStatus.CONNECTED,
        latencyMs: latency,
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
    const errors: SyncError[] = [];

    try {
      const entities = options.entities || this.capabilities.supportedEntities;
      const modifiedSince = options.cursor ? new Date(options.cursor) : undefined;

      for (const entity of entities) {
        try {
          this.logOperation('sync', { message: `Syncing ${entity}` });

          switch (entity) {
            case 'plans':
              const planResult = await this.syncPlans();
              recordsProcessed += planResult.processed;
              recordsCreated += planResult.created;
              recordsUpdated += planResult.updated;
              recordsFailed += planResult.failed;
              break;

            case 'enrollments':
              const enrollResult = await this.syncEnrollments(modifiedSince);
              recordsProcessed += enrollResult.processed;
              recordsCreated += enrollResult.created;
              recordsUpdated += enrollResult.updated;
              recordsFailed += enrollResult.failed;
              break;

            case 'dependents':
              const depResult = await this.syncDependents();
              recordsProcessed += depResult.processed;
              recordsCreated += depResult.created;
              recordsUpdated += depResult.updated;
              recordsFailed += depResult.failed;
              break;

            case 'coverage':
              const covResult = await this.syncCoverage();
              recordsProcessed += covResult.processed;
              recordsCreated += covResult.created;
              recordsUpdated += covResult.updated;
              recordsFailed += covResult.failed;
              break;

            default:
              this.logOperation('sync', { message: `Unknown entity: ${entity}` });
          }
        } catch (error) {
          const errorMsg = `Failed to sync ${entity}: ${error instanceof Error ? error.message : 'Unknown'}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errors.push({ entity, error: errorMsg } as any);
          this.logError('sync', error, { entity });
        }
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        cursor: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logError('sync', error);

      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errors: [{ entity: 'sync', error: error instanceof Error ? error.message : 'Unknown error' }] as any,
      };
    }
  }

  // ==========================================================================
  // Entity Sync Methods
  // ==========================================================================

  private async syncPlans(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getPlans({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const plan of response.data) {
        try {
          const existing = await db.query.externalBenefitPlans.findFirst({
            where: and(
              eq(externalBenefitPlans.externalId, plan.planId),
              eq(externalBenefitPlans.organizationId, this.config!.organizationId),
              eq(externalBenefitPlans.externalProvider, 'SUNLIFE')
            ),
          });

          const planData = {
            planName: plan.planName,
            planType: plan.planType,
            coverageLevel: plan.coverageLevel,
            effectiveDate: plan.effectiveDate,
            terminationDate: plan.terminationDate || null,
            premium: plan.premium != null ? String(plan.premium) : null,
            employerContribution: plan.employerContribution != null ? String(plan.employerContribution) : null,
            employeeContribution: plan.employeeContribution != null ? String(plan.employeeContribution) : null,
            status: plan.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalBenefitPlans)
              .set(planData)
              .where(eq(externalBenefitPlans.id, existing.id));
            updated++;
          } else {
            await db.insert(externalBenefitPlans).values({
              organizationId: this.config!.organizationId,
              externalId: plan.planId,
              externalProvider: 'SUNLIFE',
              ...planData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPlans', error, { planId: plan.planId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
    }

    return { processed, created, updated, failed };
  }

  private async syncEnrollments(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getEnrollments({
        page,
        pageSize: this.PAGE_SIZE,
        modifiedSince,
      });

      for (const enrollment of response.data) {
        try {
          const existing = await db.query.externalBenefitEnrollments.findFirst({
            where: and(
              eq(externalBenefitEnrollments.externalId, enrollment.enrollmentId),
              eq(externalBenefitEnrollments.organizationId, this.config!.organizationId),
              eq(externalBenefitEnrollments.externalProvider, 'SUNLIFE')
            ),
          });

          const enrollmentData = {
            employeeId: enrollment.employeeId,
            employeeName: enrollment.employeeName,
            planId: enrollment.planId,
            planName: enrollment.planName,
            coverageLevel: enrollment.coverageLevel,
            enrollmentDate: enrollment.enrollmentDate,
            effectiveDate: enrollment.effectiveDate,
            terminationDate: enrollment.terminationDate || null,
            status: enrollment.status,
            premium: enrollment.premium != null ? String(enrollment.premium) : null,
            employeeContribution: enrollment.employeeContribution != null ? String(enrollment.employeeContribution) : null,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalBenefitEnrollments)
              .set(enrollmentData)
              .where(eq(externalBenefitEnrollments.id, existing.id));
            updated++;
          } else {
            await db.insert(externalBenefitEnrollments).values({
              organizationId: this.config!.organizationId,
              externalId: enrollment.enrollmentId,
              externalProvider: 'SUNLIFE',
              ...enrollmentData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncEnrollments', error, { enrollmentId: enrollment.enrollmentId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
    }

    return { processed, created, updated, failed };
  }

  private async syncDependents(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getDependents({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const dependent of response.data) {
        try {
          const existing = await db.query.externalBenefitDependents.findFirst({
            where: and(
              eq(externalBenefitDependents.externalId, dependent.dependentId),
              eq(externalBenefitDependents.organizationId, this.config!.organizationId),
              eq(externalBenefitDependents.externalProvider, 'SUNLIFE')
            ),
          });

          const dependentData = {
            employeeId: dependent.employeeId,
            firstName: dependent.firstName,
            lastName: dependent.lastName,
            dateOfBirth: dependent.dateOfBirth,
            relationship: dependent.relationship,
            status: dependent.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalBenefitDependents)
              .set(dependentData)
              .where(eq(externalBenefitDependents.id, existing.id));
            updated++;
          } else {
            await db.insert(externalBenefitDependents).values({
              organizationId: this.config!.organizationId,
              externalId: dependent.dependentId,
              externalProvider: 'SUNLIFE',
              ...dependentData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncDependents', error, { dependentId: dependent.dependentId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
    }

    return { processed, created, updated, failed };
  }

  private async syncCoverage(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getCoverage({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const coverage of response.data) {
        try {
          const existing = await db.query.externalBenefitCoverage.findFirst({
            where: and(
              eq(externalBenefitCoverage.externalId, coverage.coverageId),
              eq(externalBenefitCoverage.organizationId, this.config!.organizationId),
              eq(externalBenefitCoverage.externalProvider, 'SUNLIFE')
            ),
          });

          const coverageData = {
            enrollmentId: coverage.enrollmentId,
            employeeId: coverage.employeeId,
            planId: coverage.planId,
            planType: coverage.planType,
            coverageAmount: coverage.coverageAmount != null ? String(coverage.coverageAmount) : null,
            deductible: coverage.deductible != null ? String(coverage.deductible) : null,
            effectiveDate: coverage.effectiveDate,
            terminationDate: coverage.terminationDate || null,
            status: coverage.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalBenefitCoverage)
              .set(coverageData)
              .where(eq(externalBenefitCoverage.id, existing.id));
            updated++;
          } else {
            await db.insert(externalBenefitCoverage).values({
              organizationId: this.config!.organizationId,
              externalId: coverage.coverageId,
              externalProvider: 'SUNLIFE',
              ...coverageData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncCoverage', error, { coverageId: coverage.coverageId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
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
    this.logOperation('webhook', { message: 'Sun Life does not support webhooks' });
  }
}
