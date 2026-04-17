import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  platformIntegrationConnections,
  platformIntegrationDeliveries,
  platformIntegrationDlqEntries,
} from '@nzila/db/schema'
import { type ProviderKey, providerCatalog } from '@/lib/integrations-provider-catalog'

export interface IntegrationDeliveryRecord {
  id: string
  orgId: string
  provider: ProviderKey
  channel: string
  recipient: string
  status: 'queued' | 'sent' | 'failed' | 'dlq'
  attempts: number
  maxAttempts: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface IntegrationDlqRecord {
  entryId: string
  orgId: string
  deliveryId: string | null
  providerId: ProviderKey
  eventType: string
  failedAt: string
  retryCount: number
  lastError: string
  payloadJson: Record<string, unknown>
  replayedAt: string | null
  replayedBy: string | null
}

export async function listIntegrationDeliveries(args: {
  orgId: string
  provider?: string | null
  status?: string | null
}): Promise<IntegrationDeliveryRecord[]> {
  const conditions = [eq(platformIntegrationDeliveries.orgId, args.orgId)]

  if (args.provider) {
    conditions.push(eq(platformIntegrationDeliveries.provider, args.provider as ProviderKey))
  }
  if (args.status) {
    conditions.push(eq(platformIntegrationDeliveries.status, args.status as IntegrationDeliveryRecord['status']))
  }

  const rows = await platformDb
    .select()
    .from(platformIntegrationDeliveries)
    .where(and(...conditions))
    .orderBy(desc(platformIntegrationDeliveries.createdAt))

  return rows.map((row) => ({
    id: row.id,
    orgId: row.orgId,
    provider: row.provider as ProviderKey,
    channel: row.channel,
    recipient: row.recipient,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function listIntegrationDlqEntries(orgId: string): Promise<IntegrationDlqRecord[]> {
  const rows = await platformDb
    .select()
    .from(platformIntegrationDlqEntries)
    .where(and(eq(platformIntegrationDlqEntries.orgId, orgId), isNull(platformIntegrationDlqEntries.replayedAt)))
    .orderBy(desc(platformIntegrationDlqEntries.failedAt))

  return rows.map((row) => ({
    entryId: row.id,
    orgId: row.orgId,
    deliveryId: row.deliveryId,
    providerId: row.provider as ProviderKey,
    eventType: row.eventType,
    failedAt: row.failedAt.toISOString(),
    retryCount: row.retryCount,
    lastError: row.lastError,
    payloadJson: (row.payloadJson ?? {}) as Record<string, unknown>,
    replayedAt: row.replayedAt ? row.replayedAt.toISOString() : null,
    replayedBy: row.replayedBy,
  }))
}

export async function recordIntegrationDelivery(args: {
  orgId: string
  provider: ProviderKey
  recipient: string
  status: 'queued' | 'sent' | 'failed' | 'dlq'
  attempts?: number
  maxAttempts?: number
  payloadJson?: Record<string, unknown>
  errorMessage?: string | null
}): Promise<IntegrationDeliveryRecord> {
  const channel = providerCatalog[args.provider].channel
  const [row] = await platformDb
    .insert(platformIntegrationDeliveries)
    .values({
      orgId: args.orgId,
      provider: args.provider,
      channel,
      recipient: args.recipient,
      status: args.status,
      attempts: args.attempts ?? 0,
      maxAttempts: args.maxAttempts ?? 3,
      payloadJson: args.payloadJson ?? {},
      errorMessage: args.errorMessage ?? null,
    })
    .returning()

  return {
    id: row.id,
    orgId: row.orgId,
    provider: row.provider as ProviderKey,
    channel: row.channel,
    recipient: row.recipient,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function recordIntegrationDlqEntry(args: {
  orgId: string
  provider: ProviderKey
  eventType: string
  retryCount: number
  lastError: string
  deliveryId?: string | null
  payloadJson?: Record<string, unknown>
}): Promise<void> {
  await platformDb.insert(platformIntegrationDlqEntries).values({
    orgId: args.orgId,
    deliveryId: args.deliveryId ?? null,
    provider: args.provider,
    eventType: args.eventType,
    retryCount: args.retryCount,
    lastError: args.lastError,
    payloadJson: args.payloadJson ?? {},
  })
}

export async function replayDlqEntry(args: {
  orgId: string
  entryId: string
  actorUserId: string
}): Promise<{ replayed: boolean; queuedDeliveryId?: string; reason?: string }> {
  const row = await platformDb.query.platformIntegrationDlqEntries.findFirst({
    where: and(
      eq(platformIntegrationDlqEntries.id, args.entryId),
      eq(platformIntegrationDlqEntries.orgId, args.orgId),
    ),
  })

  if (!row) {
    return { replayed: false, reason: 'DLQ entry not found' }
  }
  if (row.replayedAt) {
    return { replayed: false, reason: 'DLQ entry already replayed' }
  }

  const queued = await recordIntegrationDelivery({
    orgId: args.orgId,
    provider: row.provider as ProviderKey,
    recipient: 'replay',
    status: 'queued',
    attempts: 0,
    maxAttempts: 3,
    payloadJson: (row.payloadJson ?? {}) as Record<string, unknown>,
  })

  await platformDb
    .update(platformIntegrationDlqEntries)
    .set({ replayedAt: new Date(), replayedBy: args.actorUserId })
    .where(eq(platformIntegrationDlqEntries.id, row.id))

  return { replayed: true, queuedDeliveryId: queued.id }
}

export async function computeSlaSummary(orgId: string): Promise<Array<{
  provider: ProviderKey
  sentCount: number
  failureCount: number
  availability: number
  errorRate: number
}>> {
  const rows = await platformDb
    .select({
      provider: platformIntegrationDeliveries.provider,
      sentCount: sql<number>`count(*) filter (where ${platformIntegrationDeliveries.status} = 'sent')`,
      failureCount: sql<number>`count(*) filter (where ${platformIntegrationDeliveries.status} in ('failed', 'dlq'))`,
      totalCount: sql<number>`count(*)`,
    })
    .from(platformIntegrationDeliveries)
    .where(eq(platformIntegrationDeliveries.orgId, orgId))
    .groupBy(platformIntegrationDeliveries.provider)
    .orderBy(asc(platformIntegrationDeliveries.provider))

  return rows.map((row) => {
    const total = row.totalCount ?? 0
    const failures = row.failureCount ?? 0
    const sent = row.sentCount ?? 0
    const availability = total > 0 ? Math.max(0, (total - failures) / total) : 0
    const errorRate = total > 0 ? failures / total : 1

    return {
      provider: row.provider as ProviderKey,
      sentCount: sent,
      failureCount: failures,
      availability,
      errorRate,
    }
  })
}

export async function hasConnectedProvider(orgId: string, provider: ProviderKey): Promise<boolean> {
  const row = await platformDb.query.platformIntegrationConnections.findFirst({
    where: and(
      eq(platformIntegrationConnections.orgId, orgId),
      eq(platformIntegrationConnections.provider, provider),
      eq(platformIntegrationConnections.status, 'connected'),
    ),
  })
  return Boolean(row)
}
