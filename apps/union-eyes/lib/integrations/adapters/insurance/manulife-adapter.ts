/**
 * Manulife Financial Integration Adapter
 * 
 * Syncs insurance claims data from Manulife:
 * - Insurance claims
 * - Policy information
 * - Beneficiaries
 * - Benefit utilization
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
import { ManulifeClient, type ManulifeConfig } from './manulife-client';
import { db } from '@/db';
import { 
  externalInsuranceClaims,
  externalInsurancePolicies,
  externalInsuranceBeneficiaries,
  externalBenefitUtilization
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Manulife Adapter
// ============================================================================

export class ManulifeAdapter extends BaseIntegration {
  private client?: ManulifeClient;
  private readonly PAGE_SIZE = 100;

  constructor() {
    super(IntegrationType.INSURANCE, IntegrationProvider.MANULIFE, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['claims', 'policies', 'beneficiaries', 'utilization'],
      requiresOAuth: true,
      rateLimitPerMinute: 150,
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const manulifeConfig: ManulifeConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        policyGroupId: (this.config!.settings?.policyGroupId as string) || '',
        refreshToken: this.config!.credentials.refreshToken,
        environment: 'production',
      };

      this.client = new ManulifeClient(manulifeConfig);
      await this.client.authenticate();
      
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Manulife' });
    } catch (error) {
      this.logError('connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Manulife' });
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
            case 'claims':
              const claimResult = await this.syncClaims(modifiedSince);
              recordsProcessed += claimResult.processed;
              recordsCreated += claimResult.created;
              recordsUpdated += claimResult.updated;
              recordsFailed += claimResult.failed;
              break;

            case 'policies':
              const policyResult = await this.syncPolicies();
              recordsProcessed += policyResult.processed;
              recordsCreated += policyResult.created;
              recordsUpdated += policyResult.updated;
              recordsFailed += policyResult.failed;
              break;

            case 'beneficiaries':
              const benefResult = await this.syncBeneficiaries();
              recordsProcessed += benefResult.processed;
              recordsCreated += benefResult.created;
              recordsUpdated += benefResult.updated;
              recordsFailed += benefResult.failed;
              break;

            case 'utilization':
              const utilResult = await this.syncUtilization();
              recordsProcessed += utilResult.processed;
              recordsCreated += utilResult.created;
              recordsUpdated += utilResult.updated;
              recordsFailed += utilResult.failed;
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

  private async syncClaims(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getClaims({
        page,
        pageSize: this.PAGE_SIZE,
        modifiedSince,
      });

      for (const claim of response.data) {
        try {
          const existing = await db.query.externalInsuranceClaims.findFirst({
            where: and(
              eq(externalInsuranceClaims.externalId, claim.claimId),
              eq(externalInsuranceClaims.organizationId, this.config!.organizationId),
              eq(externalInsuranceClaims.externalProvider, 'MANULIFE')
            ),
          });

          const claimData = {
            claimNumber: claim.claimNumber,
            employeeId: claim.employeeId,
            employeeName: claim.employeeName,
            policyNumber: claim.policyNumber,
            claimType: claim.claimType,
            serviceDate: claim.serviceDate,
            submissionDate: claim.submissionDate,
            processedDate: claim.processedDate || null,
            claimAmount: claim.claimAmount != null ? String(claim.claimAmount) : '0',
            approvedAmount: claim.approvedAmount != null ? String(claim.approvedAmount) : null,
            paidAmount: claim.paidAmount != null ? String(claim.paidAmount) : null,
            deniedAmount: claim.deniedAmount != null ? String(claim.deniedAmount) : null,
            status: claim.status,
            denialReason: claim.denialReason || null,
            providerId: claim.providerId || null,
            providerName: claim.providerName || null,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalInsuranceClaims)
              .set(claimData)
              .where(eq(externalInsuranceClaims.id, existing.id));
            updated++;
          } else {
            await db.insert(externalInsuranceClaims).values({
              organizationId: this.config!.organizationId,
              externalId: claim.claimId,
              externalProvider: 'MANULIFE',
              ...claimData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncClaims', error, { claimId: claim.claimId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
    }

    return { processed, created, updated, failed };
  }

  private async syncPolicies(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getPolicies({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const policy of response.data) {
        try {
          const existing = await db.query.externalInsurancePolicies.findFirst({
            where: and(
              eq(externalInsurancePolicies.externalId, policy.policyId),
              eq(externalInsurancePolicies.organizationId, this.config!.organizationId),
              eq(externalInsurancePolicies.externalProvider, 'MANULIFE')
            ),
          });

          const policyData = {
            policyNumber: policy.policyNumber,
            policyType: policy.policyType,
            employeeId: policy.employeeId,
            effectiveDate: policy.effectiveDate,
            terminationDate: policy.terminationDate || null,
            coverageAmount: policy.coverageAmount != null ? String(policy.coverageAmount) : null,
            premium: policy.premium != null ? String(policy.premium) : null,
            status: policy.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalInsurancePolicies)
              .set(policyData)
              .where(eq(externalInsurancePolicies.id, existing.id));
            updated++;
          } else {
            await db.insert(externalInsurancePolicies).values({
              organizationId: this.config!.organizationId,
              externalId: policy.policyId,
              externalProvider: 'MANULIFE',
              ...policyData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncPolicies', error, { policyId: policy.policyId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
    }

    return { processed, created, updated, failed };
  }

  private async syncBeneficiaries(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getBeneficiaries({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const beneficiary of response.data) {
        try {
          const existing = await db.query.externalInsuranceBeneficiaries.findFirst({
            where: and(
              eq(externalInsuranceBeneficiaries.externalId, beneficiary.beneficiaryId),
              eq(externalInsuranceBeneficiaries.organizationId, this.config!.organizationId),
              eq(externalInsuranceBeneficiaries.externalProvider, 'MANULIFE')
            ),
          });

          const beneficiaryData = {
            policyId: beneficiary.policyId,
            employeeId: beneficiary.employeeId,
            firstName: beneficiary.firstName,
            lastName: beneficiary.lastName,
            relationship: beneficiary.relationship,
            percentage: beneficiary.percentage,
            isPrimary: beneficiary.isPrimary,
            status: beneficiary.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalInsuranceBeneficiaries)
              .set(beneficiaryData)
              .where(eq(externalInsuranceBeneficiaries.id, existing.id));
            updated++;
          } else {
            await db.insert(externalInsuranceBeneficiaries).values({
              organizationId: this.config!.organizationId,
              externalId: beneficiary.beneficiaryId,
              externalProvider: 'MANULIFE',
              ...beneficiaryData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncBeneficiaries', error, { beneficiaryId: beneficiary.beneficiaryId });
          failed++;
        }
      }

      hasMore = response.hasMore;
      page = response.nextPage || page + 1;
    }

    return { processed, created, updated, failed };
  }

  private async syncUtilization(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client!.getUtilization({
        page,
        pageSize: this.PAGE_SIZE,
      });

      for (const util of response.data) {
        try {
          const existing = await db.query.externalBenefitUtilization.findFirst({
            where: and(
              eq(externalBenefitUtilization.externalId, util.utilizationId),
              eq(externalBenefitUtilization.organizationId, this.config!.organizationId),
              eq(externalBenefitUtilization.externalProvider, 'MANULIFE')
            ),
          });

          const utilizationData = {
            employeeId: util.employeeId,
            policyId: util.policyId,
            benefitType: util.benefitType,
            periodStart: util.periodStart,
            periodEnd: util.periodEnd,
            maximumBenefit: util.maximumBenefit != null ? String(util.maximumBenefit) : null,
            utilized: util.utilized != null ? String(util.utilized) : null,
            remaining: util.remaining != null ? String(util.remaining) : null,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(externalBenefitUtilization)
              .set(utilizationData)
              .where(eq(externalBenefitUtilization.id, existing.id));
            updated++;
          } else {
            await db.insert(externalBenefitUtilization).values({
              organizationId: this.config!.organizationId,
              externalId: util.utilizationId,
              externalProvider: 'MANULIFE',
              ...utilizationData,
            });
            created++;
          }

          processed++;
        } catch (error) {
          this.logError('syncUtilization', error, { utilizationId: util.utilizationId });
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
    this.logOperation('webhook', { message: 'Manulife does not support webhooks' });
  }
}
