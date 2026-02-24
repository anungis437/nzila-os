/**
 * CanadaLife Integration Adapter
 * 
 * Syncs insurance and benefits data from Canada Life (formerly Great-West Life):
 * - Insurance policies (life, disability, health)
 * - Insurance claims
 * - Policy beneficiaries
 * 
 * Features:
 * - Full and incremental sync
 * - Organization isolation via policy group
 * - Automatic token refresh
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
  SyncError,
} from '../../types';
import { CanadaLifeClient, type CanadaLifeConfig } from './canadalife-client';
import { db } from '@/db';
import { 
  externalInsurancePolicies,
  externalInsuranceClaims,
  externalInsuranceBeneficiaries,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class CanadaLifeAdapter extends BaseIntegration {
  private client?: CanadaLifeClient;
  private readonly PAGE_SIZE = 100;

  constructor() {
    super(IntegrationType.INSURANCE, IntegrationProvider.CANADA_LIFE, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['policies', 'claims', 'beneficiaries'],
      requiresOAuth: true,
      rateLimitPerMinute: 150,
    });
  }

  async connect(): Promise<void> {
    this.ensureInitialized();

    try {
      const policyGroupId = typeof this.config!.settings?.policyGroupId === 'string' 
        ? this.config!.settings.policyGroupId 
        : 'DEFAULT_GROUP';
      
      const config: CanadaLifeConfig = {
        clientId: this.config!.credentials.clientId!,
        clientSecret: this.config!.credentials.clientSecret!,
        policyGroupId,
        refreshToken: this.config!.credentials.refreshToken,
        environment: 'production',
      };

      this.client = new CanadaLifeClient(config);
      await this.client.authenticate();
      
      const newRefreshToken = this.client.getRefreshToken();
      if (newRefreshToken && this.config) {
        this.config.credentials.refreshToken = newRefreshToken;
      }
      
      this.connected = true;
      this.logOperation('connect');
    } catch (error) {
      this.logError('connect', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
    this.logOperation('disconnect');
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
    const errors: Array<{ entity: string; entityId?: string; error: string; details?: unknown }> = [];

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
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ entity, error: `Failed to sync ${entity}: ${errorMessage}` });
          this.logError('sync', error instanceof Error ? error : new Error(String(error)));
        }
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        errors: errors.length > 0 ? errors as unknown as SyncError[] : undefined,
        cursor: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        recordsProcessed,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        errors: [{ entity: 'sync', error: errorMessage } as unknown as SyncError],
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
              eq(externalInsurancePolicies.externalProvider, 'canada_life'),
              eq(externalInsurancePolicies.externalId, policy.external_id)
            )
          ).limit(1);

          const policyData = {
            policyNumber: policy.policy_number,
            policyType: policy.policy_type,
            employeeId: policy.policy_holder,
            coverageAmount: policy.coverage_amount.toString(),
            premium: policy.premium.toString(),
            effectiveDate: policy.effective_date,
            terminationDate: policy.expiry_date || null,
            status: policy.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing.length > 0) {
            await db.update(externalInsurancePolicies).set(policyData).where(eq(externalInsurancePolicies.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalInsurancePolicies).values({
              organizationId: this.config!.organizationId,
              externalProvider: 'canada_life',
              externalId: policy.external_id,
              ...policyData,
            });
            created++;
          }
          processed++;
        } catch (error) {
          this.logError('syncPolicies', error instanceof Error ? error : new Error(String(error)));
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
              eq(externalInsuranceClaims.externalProvider, 'canada_life'),
              eq(externalInsuranceClaims.externalId, claim.external_id)
            )
          ).limit(1);

          const claimData = {
            claimNumber: claim.claim_number,
            employeeId: claim.member_name,
            employeeName: claim.member_name,
            claimType: claim.claim_type,
            claimAmount: claim.claim_amount.toString(),
            approvedAmount: claim.approved_amount?.toString(),
            paidAmount: claim.paid_amount?.toString(),
            status: claim.status,
            providerName: claim.provider_name,
            serviceDate: claim.service_date || null,
            submissionDate: claim.claim_date,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing.length > 0) {
            await db.update(externalInsuranceClaims).set(claimData).where(eq(externalInsuranceClaims.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalInsuranceClaims).values({
              organizationId: this.config!.organizationId,
              externalProvider: 'canada_life',
              externalId: claim.external_id,
              ...claimData,
            });
            created++;
          }
          processed++;
        } catch (error) {
          this.logError('syncClaims', error instanceof Error ? error : new Error(String(error)));
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
              eq(externalInsuranceBeneficiaries.externalProvider, 'canada_life'),
              eq(externalInsuranceBeneficiaries.externalId, beneficiary.external_id)
            )
          ).limit(1);

          const [firstName, ...lastNameParts] = beneficiary.beneficiary_name.split(' ');
          const lastName = lastNameParts.join(' ') || firstName;

          const beneficiaryData = {
            policyId: beneficiary.policy_id,
            employeeId: beneficiary.policy_id,
            firstName: firstName,
            lastName: lastName,
            relationship: beneficiary.relationship,
            percentage: Math.round(beneficiary.percentage),
            isPrimary: false,
            status: beneficiary.status,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing.length > 0) {
            await db.update(externalInsuranceBeneficiaries).set(beneficiaryData).where(eq(externalInsuranceBeneficiaries.id, existing[0].id));
            updated++;
          } else {
            await db.insert(externalInsuranceBeneficiaries).values({
              organizationId: this.config!.organizationId,
              externalProvider: 'canada_life',
              externalId: beneficiary.external_id,
              ...beneficiaryData,
            });
            created++;
          }
          processed++;
        } catch (error) {
          this.logError('syncBeneficiaries', error instanceof Error ? error : new Error(String(error)));
          failed++;
        }
      }

      if (beneficiaries.length < this.PAGE_SIZE) break;
      page++;
    }

    return { processed, created, updated, failed };
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    return false;
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { eventId: event.id, message: 'Webhooks not supported' });
  }
}
