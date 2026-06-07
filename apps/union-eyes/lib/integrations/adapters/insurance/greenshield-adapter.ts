/**
 * Green Shield Canada Integration Adapter
 * 
 * Syncs health and dental insurance data from Green Shield Canada:
 * - Benefit plans
 * - Enrollments
 * - Claims (medical, dental, prescription)
 * - Coverage details
 * 
 * Features:
 * - Full and incremental sync
 * - Organization isolation via group number
 * - Automatic token refresh
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
import { GreenShieldClient, type GreenShieldConfig } from './greenshield-client';
import { db } from '@/db';
import { 
  externalBenefitPlans,
  externalBenefitEnrollments,
  externalInsuranceClaims,
  externalBenefitCoverage
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Green Shield Adapter
// ============================================================================

export class GreenShieldAdapter extends BaseIntegration {
  private client?: GreenShieldClient;
  private readonly PAGE_SIZE = 100;

  constructor() {
    super(IntegrationType.INSURANCE, IntegrationProvider.GREEN_SHIELD_CANADA, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['plans', 'enrollments', 'claims', 'coverage'],
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
      const gscConfig: GreenShieldConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        groupNumber: (this.config!.settings?.groupNumber as string) || '',
        refreshToken: this.config!.credentials.refreshToken,
        environment: 'production',
      };

      this.client = new GreenShieldClient(gscConfig);
      await this.client.authenticate();
      
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Green Shield Canada' });
    } catch (error) {
      this.logError('connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Green Shield Canada' });
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
      const orgs = options.orgs || this.capabilities.supportedEntities;
      const modifiedSince = options.cursor ? new Date(options.cursor) : undefined;

      for (const entity of orgs) {
        try {
          this.logOperation('sync', { message: `Syncing ${entity}` });

          switch (entity) {
            case 'plans':
              const plansResult = await this.syncPlans(modifiedSince);
              recordsProcessed += plansResult.processed;
              recordsCreated += plansResult.created;
              recordsUpdated += plansResult.updated;
              recordsFailed += plansResult.failed;
              break;

            case 'enrollments':
              const enrollmentsResult = await this.syncEnrollments(modifiedSince);
              recordsProcessed += enrollmentsResult.processed;
              recordsCreated += enrollmentsResult.created;
              recordsUpdated += enrollmentsResult.updated;
              recordsFailed += enrollmentsResult.failed;
              break;

            case 'claims':
              const claimsResult = await this.syncClaims(modifiedSince);
              recordsProcessed += claimsResult.processed;
              recordsCreated += claimsResult.created;
              recordsUpdated += claimsResult.updated;
              recordsFailed += claimsResult.failed;
              break;

            case 'coverage':
              const coverageResult = await this.syncCoverage();
              recordsProcessed += coverageResult.processed;
              recordsCreated += coverageResult.created;
              recordsUpdated += coverageResult.updated;
              recordsFailed += coverageResult.failed;
              break;

            default:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              errors.push({ entity, error: `Unknown entity type: ${entity}` } as any);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errors.push({ entity, error: `Failed to sync ${entity}: ${errorMessage}` } as any);
          this.logError('sync', error);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errors: [{ entity: 'sync', error: errorMessage }] as any,
      };
    }
  }

  // ==========================================================================
  // Entity-Specific Sync Methods
  // ==========================================================================

  private async syncPlans(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;

    while (true) {
      const plans = await this.client!.getPlans(page, this.PAGE_SIZE, modifiedSince);
      
      if (plans.length === 0) break;

      for (const plan of plans) {
        try {
          const existing = await db
            .select()
            .from(externalBenefitPlans)
            .where(
              and(
                eq(externalBenefitPlans.organizationId, this.config!.organizationId),
                eq(externalBenefitPlans.externalProvider, 'green_shield_canada'),
                eq(externalBenefitPlans.externalId, plan.external_id)
              )
            )
            .limit(1);

          const planData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'green_shield_canada' as const,
            externalId: plan.external_id,
            planName: plan.plan_name,
            planType: plan.plan_type,
            coverageLevel: plan.coverage_level,
            premium: plan.premium.toString(),
            status: plan.status,
            effectiveDate: plan.effective_date,
            terminationDate: plan.expiry_date || null,
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db
              .update(externalBenefitPlans)
              .set(planData)
              .where(eq(externalBenefitPlans.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalBenefitPlans).values(planData);
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPlans', error);
          failed++;
        }
      }

      if (plans.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncEnrollments(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;

    while (true) {
      const enrollments = await this.client!.getEnrollments(page, this.PAGE_SIZE, modifiedSince);
      
      if (enrollments.length === 0) break;

      for (const enrollment of enrollments) {
        try {
          const existing = await db
            .select()
            .from(externalBenefitEnrollments)
            .where(
              and(
                eq(externalBenefitEnrollments.organizationId, this.config!.organizationId),
                eq(externalBenefitEnrollments.externalProvider, 'green_shield_canada'),
                eq(externalBenefitEnrollments.externalId, enrollment.external_id)
              )
            )
            .limit(1);

          const enrollmentData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'green_shield_canada' as const,
            externalId: enrollment.external_id,
            employeeId: enrollment.employee_id,
            employeeName: enrollment.employee_name,
            planId: enrollment.plan_id,
            enrollmentDate: enrollment.coverage_start,
            effectiveDate: enrollment.coverage_start,
            terminationDate: enrollment.coverage_end || null,
            employeeContribution: enrollment.employee_contribution.toString(),
            status: enrollment.status,
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db
              .update(externalBenefitEnrollments)
              .set(enrollmentData)
              .where(eq(externalBenefitEnrollments.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalBenefitEnrollments).values(enrollmentData);
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncEnrollments', error);
          failed++;
        }
      }

      if (enrollments.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncClaims(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;

    while (true) {
      const claims = await this.client!.getClaims(page, this.PAGE_SIZE, modifiedSince);
      
      if (claims.length === 0) break;

      for (const claim of claims) {
        try {
          const existing = await db
            .select()
            .from(externalInsuranceClaims)
            .where(
              and(
                eq(externalInsuranceClaims.organizationId, this.config!.organizationId),
                eq(externalInsuranceClaims.externalProvider, 'green_shield_canada'),
                eq(externalInsuranceClaims.externalId, claim.external_id)
              )
            )
            .limit(1);

          const claimData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'green_shield_canada' as const,
            externalId: claim.external_id,
            claimNumber: claim.claim_number,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            employeeId: (claim as any).employee_id || claim.external_id,
            employeeName: claim.member_name,
            submissionDate: claim.claim_date,
            claimType: claim.claim_type,
            claimAmount: claim.claim_amount.toString(),
            approvedAmount: claim.approved_amount?.toString(),
            paidAmount: claim.paid_amount?.toString(),
            status: claim.status,
            providerName: claim.provider_name,
            serviceDate: claim.service_date || null,
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db
              .update(externalInsuranceClaims)
              .set(claimData)
              .where(eq(externalInsuranceClaims.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalInsuranceClaims).values(claimData);
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncClaims', error);
          failed++;
        }
      }

      if (claims.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncCoverage(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;

    while (true) {
      const coverageList = await this.client!.getCoverage(page, this.PAGE_SIZE);
      
      if (coverageList.length === 0) break;

      for (const coverage of coverageList) {
        try {
          const existing = await db
            .select()
            .from(externalBenefitCoverage)
            .where(
              and(
                eq(externalBenefitCoverage.organizationId, this.config!.organizationId),
                eq(externalBenefitCoverage.externalProvider, 'green_shield_canada'),
                eq(externalBenefitCoverage.externalId, coverage.external_id)
              )
            )
            .limit(1);

          const coverageData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'green_shield_canada' as const,
            externalId: coverage.external_id,
            employeeId: coverage.member_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            planId: (coverage as any).plan_id || '',
            planType: coverage.coverage_type,
            coverageAmount: coverage.coverage_amount.toString(),
            deductible: coverage.deductible.toString(),
            status: coverage.status,
            effectiveDate: coverage.effective_date,
            terminationDate: coverage.expiry_date || null,
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db
              .update(externalBenefitCoverage)
              .set(coverageData)
              .where(eq(externalBenefitCoverage.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalBenefitCoverage).values(coverageData);
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncCoverage', error);
          failed++;
        }
      }

      if (coverageList.length < this.PAGE_SIZE) break;
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
    this.logOperation('webhook', { message: 'Green Shield Canada does not support webhooks' });
  }
}
