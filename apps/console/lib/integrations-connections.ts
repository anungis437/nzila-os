import { and, desc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { platformIntegrationConnections } from '@nzila/db/schema'
import { decryptSecrets, encryptSecrets, secretsFingerprint } from '@/lib/integrations-secret-crypto'
import { type ProviderKey, providerCatalog } from '@/lib/integrations-provider-catalog'

export type ConnectionStatus = 'connected' | 'degraded' | 'error' | 'disconnected'

export interface StoredIntegrationConnection {
  id: string
  orgId: string
  provider: ProviderKey
  status: ConnectionStatus
  lastValidationOk: boolean
  lastValidationError: string | null
  lastValidatedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export async function upsertIntegrationConnection(args: {
  orgId: string
  provider: ProviderKey
  secrets: Record<string, string>
  status: ConnectionStatus
  lastValidationOk: boolean
  lastValidationError: string | null
  actorUserId: string
  metadata?: Record<string, unknown>
}): Promise<StoredIntegrationConnection> {
  const encrypted = encryptSecrets(args.secrets)
  const fingerprint = secretsFingerprint(args.secrets)
  const now = new Date()

  const existing = await platformDb.query.platformIntegrationConnections.findFirst({
    where: and(
      eq(platformIntegrationConnections.orgId, args.orgId),
      eq(platformIntegrationConnections.provider, args.provider),
    ),
  })

  if (existing) {
    const [updated] = await platformDb
      .update(platformIntegrationConnections)
      .set({
        secretsEncrypted: encrypted,
        secretsFingerprint: fingerprint,
        status: args.status,
        lastValidationOk: args.lastValidationOk,
        lastValidationError: args.lastValidationError,
        lastValidatedAt: now,
        metadata: args.metadata ?? {},
        updatedBy: args.actorUserId,
        updatedAt: now,
      })
      .where(eq(platformIntegrationConnections.id, existing.id))
      .returning()

    return mapStored(updated)
  }

  const [created] = await platformDb
    .insert(platformIntegrationConnections)
    .values({
      orgId: args.orgId,
      provider: args.provider,
      status: args.status,
      secretsEncrypted: encrypted,
      secretsFingerprint: fingerprint,
      lastValidationOk: args.lastValidationOk,
      lastValidationError: args.lastValidationError,
      lastValidatedAt: now,
      metadata: args.metadata ?? {},
      createdBy: args.actorUserId,
      updatedBy: args.actorUserId,
    })
    .returning()

  return mapStored(created)
}

export async function listIntegrationConnections(orgId: string): Promise<StoredIntegrationConnection[]> {
  const rows = await platformDb
    .select()
    .from(platformIntegrationConnections)
    .where(eq(platformIntegrationConnections.orgId, orgId))
    .orderBy(desc(platformIntegrationConnections.updatedAt))

  return rows.map(mapStored)
}

export async function getIntegrationConnection(orgId: string, provider: ProviderKey): Promise<StoredIntegrationConnection | null> {
  const row = await platformDb.query.platformIntegrationConnections.findFirst({
    where: and(
      eq(platformIntegrationConnections.orgId, orgId),
      eq(platformIntegrationConnections.provider, provider),
    ),
  })

  return row ? mapStored(row) : null
}

export async function getDecryptedProviderSecrets(orgId: string, provider: ProviderKey): Promise<Record<string, string> | null> {
  const row = await platformDb.query.platformIntegrationConnections.findFirst({
    where: and(
      eq(platformIntegrationConnections.orgId, orgId),
      eq(platformIntegrationConnections.provider, provider),
    ),
  })

  if (!row) return null
  return decryptSecrets(row.secretsEncrypted)
}

export async function validateStoredConnection(orgId: string, provider: ProviderKey): Promise<{ ok: boolean; error?: string }> {
  const secrets = await getDecryptedProviderSecrets(orgId, provider)
  if (!secrets) {
    return { ok: false, error: 'Provider is not connected for this org' }
  }
  return providerCatalog[provider].testConnection(secrets)
}

function mapStored(row: typeof platformIntegrationConnections.$inferSelect): StoredIntegrationConnection {
  return {
    id: row.id,
    orgId: row.orgId,
    provider: row.provider as ProviderKey,
    status: row.status,
    lastValidationOk: row.lastValidationOk,
    lastValidationError: row.lastValidationError,
    lastValidatedAt: row.lastValidatedAt ? row.lastValidatedAt.toISOString() : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
