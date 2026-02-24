/**
 * Industrial Alliance (iA Financial) Integration Adapter
 * 
 * Syncs insurance and benefits data from Industrial Alliance:
 * - Insurance policies (life, disability, critical illness)
 * - Insurance claims
 * - Policy beneficiaries
 * - Benefit utilization
 * 
 * Features:
 * - Full and incremental sync
 * - Organization isolation via group account
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
import { IndustrialAllianceClient, type IndustrialAllianceConfig } from './ia-client';
import { db } from '@/db';
import { 
  externalInsurancePolicies,
  externalInsuranceClaims,
  externalInsuranceBeneficiaries,
  externalBenefitUtilization,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class IndustrialAllianceAdapter extends BaseIntegration {
  private client?: IndustrialAllianceClient;
  private readonly PAGE_SIZE = 100;

  constructor() {
    super(IntegrationType.INSURANCE, IntegrationProvider.INDUSTRIAL_ALLIANCE, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['policies', 'claims', 'beneficiaries', 'utilization'],
      requiresOAuth: true,
      rateLimitPerMinute: 150,
    });
  }

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const config: IndustrialAllianceConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        groupAccountId: (this.config!.settings?.groupAccountId as string) || '',
        refreshToken: this.config!.credentials.refreshToken,
        environment: 'production',
      };

      this.client = new IndustrialAllianceClient(config);
      await this.client.authenticate();
      
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect', { message: 'Connected to Industrial Alliance' });
    } catch (error) {
      this.logError('connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect', { message: 'Disconnected from Industrial Alliance' });
  }

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
          switch (entity) {
            case 'policies':
              const policiesResult = await this.syncPolicies(modifiedSince);
              recordsProcessed += policiesResult.processed;
              recordsCreated += policiesResult.created;
              recordsUpdated += policiesResult.updated;
              recordsFailed += policiesResult.failed;
              break;

            case 'claims':
              const claimsResult = await this.syncClaims(modifiedSince);
              recordsProcessed += claimsResult.processed;
              recordsCreated += claimsResult.created;
              recordsUpdated += claimsResult.updated;
              recordsFailed += claimsResult.failed;
              break;

            case 'beneficiaries':
              const beneficiariesResult = await this.syncBeneficiaries();
              recordsProcessed += beneficiariesResult.processed;
              recordsCreated += beneficiariesResult.created;
              recordsUpdated += beneficiariesResult.updated;
              recordsFailed += beneficiariesResult.failed;
              break;

            case 'utilization':
              const utilizationResult = await this.syncUtilization();
              recordsProcessed += utilizationResult.processed;
              recordsCreated += utilizationResult.created;
              recordsUpdated += utilizationResult.updated;
              recordsFailed += utilizationResult.failed;
              break;
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

  private async syncPolicies(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0, created = 0, updated = 0, failed = 0;
    let page = 1;

    while (true) {
      const policies = await this.client!.getPolicies(page, this.PAGE_SIZE, modifiedSince);
      if (policies.length === 0) break;

      for (const policy of policies) {
        try {
          const existing = await db.select().from(externalInsurancePolicies).where(
            and(
              eq(externalInsurancePolicies.organizationId, this.config!.organizationId),
              eq(externalInsurancePolicies.externalProvider, 'industrial_alliance'),
              eq(externalInsurancePolicies.externalId, policy.external_id)
            )
          ).limit(1);

          const policyData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'industrial_alliance' as const,
            externalId: policy.external_id,
            policyNumber: policy.policy_number,
            policyType: policy.policy_type,
            employeeId: policy.policy_holder || '',
            coverageAmount: policy.coverage_amount.toString(),
            premium: policy.premium.toString(),
            effectiveDate: policy.effective_date,
            terminationDate: policy.expiry_date || null,
            status: policy.status,
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db.update(externalInsurancePolicies).set(policyData).where(eq(externalInsurancePolicies.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalInsurancePolicies).values(policyData);
            created++;
          }
          processed++;
        } catch (error) {
          this.logError('syncPolicies', error);
          failed++;
        }
      }

      if (policies.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncClaims(modifiedSince?: Date): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0, created = 0, updated = 0, failed = 0;
    let page = 1;

    while (true) {
      const claims = await this.client!.getClaims(page, this.PAGE_SIZE, modifiedSince);
      if (claims.length === 0) break;

      for (const claim of claims) {
        try {
          const existing = await db.select().from(externalInsuranceClaims).where(
            and(
              eq(externalInsuranceClaims.organizationId, this.config!.organizationId),
              eq(externalInsuranceClaims.externalProvider, 'industrial_alliance'),
              eq(externalInsuranceClaims.externalId, claim.external_id)
            )
          ).limit(1);

          const claimData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'industrial_alliance' as const,
            externalId: claim.external_id,
            claimNumber: claim.claim_number,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            employeeId: (claim as any).employee_id || '',
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
            await db.update(externalInsuranceClaims).set(claimData).where(eq(externalInsuranceClaims.id, existing[0].id));
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

  private async syncBeneficiaries(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0, created = 0, updated = 0, failed = 0;
    let page = 1;

    while (true) {
      const beneficiaries = await this.client!.getBeneficiaries(page, this.PAGE_SIZE);
      if (beneficiaries.length === 0) break;

      for (const beneficiary of beneficiaries) {
        try {
          const existing = await db.select().from(externalInsuranceBeneficiaries).where(
            and(
              eq(externalInsuranceBeneficiaries.organizationId, this.config!.organizationId),
              eq(externalInsuranceBeneficiaries.externalProvider, 'industrial_alliance'),
              eq(externalInsuranceBeneficiaries.externalId, beneficiary.external_id)
            )
          ).limit(1);

          const beneficiaryData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'industrial_alliance' as const,
            externalId: beneficiary.external_id,
            policyId: beneficiary.policy_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            employeeId: (beneficiary as any).employee_id || '',
            firstName: beneficiary.beneficiary_name?.split(' ')[0] || '',
            lastName: beneficiary.beneficiary_name?.split(' ').slice(1).join(' ') || '',
            relationship: beneficiary.relationship,
            percentage: Math.round(beneficiary.percentage),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            isPrimary: (beneficiary as any).is_primary ?? false,
            status: beneficiary.status,
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db.update(externalInsuranceBeneficiaries).set(beneficiaryData).where(eq(externalInsuranceBeneficiaries.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalInsuranceBeneficiaries).values(beneficiaryData);
            created++;
          }
          processed++;
        } catch (error) {
          this.logError('syncBeneficiaries', error);
          failed++;
        }
      }

      if (beneficiaries.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  private async syncUtilization(): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    let processed = 0, created = 0, updated = 0, failed = 0;
    let page = 1;

    while (true) {
      const utilizations = await this.client!.getUtilization(page, this.PAGE_SIZE);
      if (utilizations.length === 0) break;

      for (const utilization of utilizations) {
        try {
          const existing = await db.select().from(externalBenefitUtilization).where(
            and(
              eq(externalBenefitUtilization.organizationId, this.config!.organizationId),
              eq(externalBenefitUtilization.externalProvider, 'industrial_alliance'),
              eq(externalBenefitUtilization.externalId, utilization.external_id)
            )
          ).limit(1);

          const utilizationData = {
            organizationId: this.config!.organizationId,
            externalProvider: 'industrial_alliance' as const,
            externalId: utilization.external_id,
            employeeId: utilization.member_id,
            benefitType: utilization.benefit_type,
            periodStart: `${utilization.coverage_year}-01-01`,
            periodEnd: `${utilization.coverage_year}-12-31`,
            maximumBenefit: utilization.maximum_benefit.toString(),
            utilized: utilization.utilized_amount.toString(),
            remaining: utilization.remaining_amount.toString(),
            lastSyncedAt: new Date(),
          };

          if (existing.length > 0) {
            await db.update(externalBenefitUtilization).set(utilizationData).where(eq(externalBenefitUtilization.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalBenefitUtilization).values(utilizationData);
            created++;
          }
          processed++;
        } catch (error) {
          this.logError('syncUtilization', error);
          failed++;
        }
      }

      if (utilizations.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    return false;
  }

  async processWebhook(_event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { message: 'Industrial Alliance does not support webhooks' });
  }
}
