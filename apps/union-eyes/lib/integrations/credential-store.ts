import { and, desc, eq, sql } from 'drizzle-orm';
import { integrationCredentialBindings, integrationProviderEnum } from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { IntegrationError, type IntegrationCredentials, type IntegrationProvider } from './types';

const MANAGED_REF = /^env:\/\/(UE_INTEGRATION_[A-Z0-9_]{3,200})$/;

export function validateManagedCredentialRef(ref: string): string {
  const match = MANAGED_REF.exec(ref);
  if (!match) throw new Error('Credential reference must be env://UE_INTEGRATION_<NAME>; plaintext and arbitrary references are refused');
  return match[1];
}

export async function rotateIntegrationCredentialBinding(
  tx: RLSTx,
  input: { organizationId: string; provider: IntegrationProvider; secretRef: string; userId: string },
) {
  validateManagedCredentialRef(input.secretRef);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`integration-credential:${input.organizationId}:${input.provider}`}, 0))`);
  const [latest] = await tx.select({ version: integrationCredentialBindings.version }).from(integrationCredentialBindings).where(and(eq(integrationCredentialBindings.organizationId, input.organizationId), eq(integrationCredentialBindings.provider, input.provider as (typeof integrationProviderEnum.enumValues)[number]))).orderBy(desc(integrationCredentialBindings.version)).limit(1);
  await tx.update(integrationCredentialBindings).set({ status: 'revoked', revokedAt: new Date(), revokedBy: input.userId }).where(and(eq(integrationCredentialBindings.organizationId, input.organizationId), eq(integrationCredentialBindings.provider, input.provider as (typeof integrationProviderEnum.enumValues)[number]), eq(integrationCredentialBindings.status, 'active')));
  const [binding] = await tx.insert(integrationCredentialBindings).values({ organizationId: input.organizationId, provider: input.provider as (typeof integrationProviderEnum.enumValues)[number], version: (latest?.version ?? 0) + 1, secretRef: input.secretRef, status: 'active', createdBy: input.userId }).returning();
  return binding;
}

export async function resolveIntegrationCredentials(
  tx: RLSTx,
  organizationId: string,
  provider: IntegrationProvider,
): Promise<IntegrationCredentials> {
  const [binding] = await tx.select().from(integrationCredentialBindings).where(and(eq(integrationCredentialBindings.organizationId, organizationId), eq(integrationCredentialBindings.provider, provider as (typeof integrationProviderEnum.enumValues)[number]), eq(integrationCredentialBindings.status, 'active'))).orderBy(desc(integrationCredentialBindings.version)).limit(1);
  if (!binding) throw new IntegrationError('No active managed credential binding', provider, 'CREDENTIAL_NOT_CONFIGURED');
  const envName = validateManagedCredentialRef(binding.secretRef);
  const encoded = process.env[envName];
  if (!encoded) throw new IntegrationError('Managed credential is not provisioned', provider, 'CREDENTIAL_UNRESOLVABLE');
  let parsed: unknown;
  try { parsed = JSON.parse(encoded); } catch { throw new IntegrationError('Managed credential payload must be a JSON object', provider, 'CREDENTIAL_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new IntegrationError('Managed credential payload must be a JSON object', provider, 'CREDENTIAL_INVALID');
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).length === 0 || Object.values(record).some((value) => typeof value !== 'string' || value.length === 0)) throw new IntegrationError('Managed credential payload contains invalid values', provider, 'CREDENTIAL_INVALID');
  return Object.freeze({ ...record }) as IntegrationCredentials;
}

export async function integrationCredentialReadiness(tx: RLSTx, organizationId: string, provider: IntegrationProvider) {
  try {
    await resolveIntegrationCredentials(tx, organizationId, provider);
    return { stored: true, resolvable: true };
  } catch (error) {
    const configured = error instanceof IntegrationError && error.code !== 'CREDENTIAL_NOT_CONFIGURED';
    return { stored: configured, resolvable: false };
  }
}
