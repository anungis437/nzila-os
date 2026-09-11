/**
 * Minimal Integration Control Plane.
 *
 * This is the production authority root for the existing adapter framework.
 * It does not expose generic external-table CRUD and never accepts tenant
 * authority from the request payload.
 */

import { db } from '@/db/db';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { integrationConfigs, integrationProviderEnum, integrationTypeEnum } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { IntegrationRegistry } from './registry';
import { SyncEngine } from './sync-engine';
import {
  findDisallowedSettingsKeys,
  findUnapprovedEntities,
  isProviderApprovedForControlPlane,
} from './provider-policy';
import {
  IntegrationError,
  IntegrationProvider,
  IntegrationType,
  SyncOptions,
  SyncResult,
  SyncType,
  TrustedIntegrationExecutionContext,
} from './types';

type IntegrationConfigRow = typeof integrationConfigs.$inferSelect;

export interface ConfigureIntegrationInput {
  provider: IntegrationProvider;
  type: IntegrationType;
  enabled?: boolean;
  settings?: Record<string, unknown>;
  webhookUrl?: string | null;
  credentialRef?: string;
}

export interface TenantSyncRequest {
  integrationId: string;
  syncType: SyncType;
  entities?: string[];
  dryRun?: boolean;
  limit?: number;
}

export interface ServerIssuedSyncBinding {
  readonly organizationId: string;
  readonly integrationId: string;
  readonly provider: IntegrationProvider;
  readonly syncType: SyncType;
  readonly entities?: readonly string[];
  readonly issuedAt: string;
}

function assertKnownProvider(provider: IntegrationProvider): void {
  // The control-plane approval decision — NOT IntegrationRegistry.isAvailable(),
  // which is a product/catalog flag (available|beta|deprecated|unavailable) and
  // must never double as the security authorization boundary. See
  // provider-policy.ts's doc comment for the incident this guards against.
  if (!isProviderApprovedForControlPlane(provider)) {
    throw new IntegrationError(`Integration provider ${provider} is not approved for activation`, provider, 'PROVIDER_NOT_APPROVED');
  }
}

function assertApprovedSettingsKeys(provider: IntegrationProvider, settings: Record<string, unknown> | undefined): void {
  if (!settings) return;
  const disallowed = findDisallowedSettingsKeys(provider, Object.keys(settings));
  if (disallowed.length > 0) {
    throw new IntegrationError(
      `settings contains keys not approved for ${provider}: ${disallowed.join(', ')}. settings is echoed back verbatim via GET and must never hold secret-shaped values — use credentialRef for credential material.`,
      provider,
      'SETTINGS_KEY_NOT_APPROVED',
    );
  }
}

function assertApprovedEntities(provider: IntegrationProvider, entities: readonly string[] | undefined): void {
  if (!entities || entities.length === 0) return;
  const unapproved = findUnapprovedEntities(provider, entities);
  if (unapproved.length > 0) {
    throw new IntegrationError(
      `entities not approved for ${provider}: ${unapproved.join(', ')}`,
      provider,
      'ENTITY_NOT_APPROVED',
    );
  }
}

function assertProviderType(provider: IntegrationProvider, type: IntegrationType): void {
  const metadata = IntegrationRegistry.getInstance().getMetadata(provider);
  if (!metadata || metadata.type !== type) {
    throw new IntegrationError(`Provider ${provider} is not registered for integration type ${type}`, provider, 'PROVIDER_TYPE_MISMATCH');
  }
}

function toPublicConfig(row: IntegrationConfigRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    type: row.type,
    provider: row.provider,
    enabled: row.enabled ?? false,
    webhookUrl: row.webhookUrl,
    settings: row.settings ?? {},
    lastSyncAt: row.lastSyncAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    credentialsStored: true,
  };
}

function trustedTenantContext(
  organizationId: string,
  integrationId: string,
  provider: IntegrationProvider,
  userId: string,
): TrustedIntegrationExecutionContext {
  return Object.freeze({
    organizationId,
    integrationId,
    provider,
    actor: Object.freeze({ type: 'tenant_user' as const, userId }),
    principal: 'TENANT_RUNTIME' as const,
    issuedAt: new Date().toISOString(),
  });
}

function trustedSystemContext(binding: ServerIssuedSyncBinding): TrustedIntegrationExecutionContext {
  return Object.freeze({
    organizationId: binding.organizationId,
    integrationId: binding.integrationId,
    provider: binding.provider,
    actor: Object.freeze({ type: 'system_worker' as const }),
    principal: 'SYSTEM_RUNTIME' as const,
    issuedAt: new Date().toISOString(),
  });
}

async function loadIntegrationById(organizationId: string, integrationId: string, queryClient: typeof db = db): Promise<IntegrationConfigRow> {
  const [config] = await queryClient
    .select()
    .from(integrationConfigs)
    .where(and(eq(integrationConfigs.id, integrationId), eq(integrationConfigs.organizationId, organizationId)))
    .limit(1);

  if (!config) {
    throw new IntegrationError('Integration was not found for the authenticated organization', IntegrationProvider.CUSTOM, 'CONFIG_NOT_FOUND');
  }

  return config;
}

export async function listIntegrationConfigsForOrg(organizationId: string) {
  return withRLSContext({ organizationId }, async () => {
    const rows = await db
      .select()
      .from(integrationConfigs)
      .where(eq(integrationConfigs.organizationId, organizationId));

    return rows.map(toPublicConfig);
  });
}

export async function configureIntegrationForOrg(
  organizationId: string,
  input: ConfigureIntegrationInput,
) {
  assertKnownProvider(input.provider);
  assertProviderType(input.provider, input.type);
  assertApprovedSettingsKeys(input.provider, input.settings);

  return withRLSContext({ organizationId }, async () => {
    const [existing] = await db
      .select()
      .from(integrationConfigs)
      .where(
        and(
          eq(integrationConfigs.organizationId, organizationId),
          eq(integrationConfigs.provider, input.provider as (typeof integrationProviderEnum.enumValues)[number]),
        ),
      )
      .limit(1);

    const values = {
      organizationId,
      type: input.type as (typeof integrationTypeEnum.enumValues)[number],
      provider: input.provider as (typeof integrationProviderEnum.enumValues)[number],
      credentials: { credentialRef: input.credentialRef ?? 'managed' },
      settings: input.settings ?? {},
      webhookUrl: input.webhookUrl ?? null,
      enabled: input.enabled ?? false,
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(integrationConfigs)
        .set({
          ...values,
          credentials: input.credentialRef ? values.credentials : existing.credentials,
        })
        .where(and(eq(integrationConfigs.id, existing.id), eq(integrationConfigs.organizationId, organizationId)))
        .returning();
      return toPublicConfig(updated);
    }

    const [created] = await db.insert(integrationConfigs).values(values).returning();
    return toPublicConfig(created);
  });
}

export async function setIntegrationActivationForOrg(
  organizationId: string,
  integrationId: string,
  enabled: boolean,
) {
  return withRLSContext({ organizationId }, async () => {
    const config = await loadIntegrationById(organizationId, integrationId);
    assertKnownProvider(config.provider as IntegrationProvider);

    const [updated] = await db
      .update(integrationConfigs)
      .set({ enabled, updatedAt: new Date() })
      .where(and(eq(integrationConfigs.id, integrationId), eq(integrationConfigs.organizationId, organizationId)))
      .returning();

    return toPublicConfig(updated);
  });
}

export async function initiateTenantIntegrationSync(
  organizationId: string,
  userId: string,
  request: TenantSyncRequest,
): Promise<SyncResult> {
  return withRLSContext({ organizationId }, async () => {
    const config = await loadIntegrationById(organizationId, request.integrationId);
    if (!config.enabled) {
      throw new IntegrationError('Integration is disabled', config.provider as IntegrationProvider, 'INTEGRATION_DISABLED');
    }

    const provider = config.provider as IntegrationProvider;
    assertKnownProvider(provider);
    assertProviderType(provider, config.type as IntegrationType);
    assertApprovedEntities(provider, request.entities);

    const context = trustedTenantContext(organizationId, request.integrationId, provider, userId);
    const options: SyncOptions = {
      type: request.syncType,
      orgs: request.entities,
      dryRun: request.dryRun,
      limit: request.limit,
      trustedContext: context,
    };

    return SyncEngine.getInstance().executeSync(organizationId, provider, options);
  });
}

export async function issueBackgroundSyncBinding(
  organizationId: string,
  integrationId: string,
  syncType: SyncType,
  entities?: readonly string[],
): Promise<ServerIssuedSyncBinding> {
  return withRLSContext({ organizationId }, async () => {
    const config = await loadIntegrationById(organizationId, integrationId);
    if (!config.enabled) {
      throw new IntegrationError('Integration is disabled', config.provider as IntegrationProvider, 'INTEGRATION_DISABLED');
    }

    const provider = config.provider as IntegrationProvider;
    assertKnownProvider(provider);
    assertProviderType(provider, config.type as IntegrationType);

    return Object.freeze({
      organizationId,
      integrationId,
      provider,
      syncType,
      entities,
      issuedAt: new Date().toISOString(),
    });
  });
}

export async function executeBackgroundSyncBinding(binding: ServerIssuedSyncBinding): Promise<SyncResult> {
  return withSystemContext(async (tx) => {
    const config = await loadIntegrationById(binding.organizationId, binding.integrationId, tx);
    if (!config.enabled || config.provider !== binding.provider) {
      throw new IntegrationError('Background sync binding no longer matches an enabled integration', binding.provider, 'BINDING_INVALID');
    }
    assertKnownProvider(binding.provider);
    assertProviderType(binding.provider, config.type as IntegrationType);

    return SyncEngine.getInstance().executeSync(binding.organizationId, binding.provider, {
      type: binding.syncType,
      orgs: binding.entities ? [...binding.entities] : undefined,
      trustedContext: trustedSystemContext(binding),
    });
  });
}
