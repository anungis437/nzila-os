/**
 * Calendar connection item operations.
 * Credential columns must never be exposed or mutable through user CRUD.
 */
import { withApi, ApiError, z, zUUID } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { externalCalendarConnections as connections } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revokeProviderGrant } from '@/lib/external-calendar-sync/provider-revocation';

export const dynamic = 'force-dynamic';

const ownConnection = (organizationId: string, userId: string, id: string) => and(
  eq(connections.organizationId, organizationId),
  eq(connections.userId, userId),
  eq(connections.id, id),
);

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  rlsOrgContext: true,
  openapi: { tags: ['Scheduling'], summary: 'Read own connection without credentials' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid connection id');
  const [connection] = await db.select({
    id: connections.id,
    provider: connections.provider,
    providerAccountId: connections.providerAccountId,
    providerEmail: connections.providerEmail,
    syncEnabled: connections.syncEnabled,
    syncDirection: connections.syncDirection,
    lastSyncAt: connections.lastSyncAt,
    nextSyncAt: connections.nextSyncAt,
    syncStatus: connections.syncStatus,
    isActive: connections.isActive,
    createdAt: connections.createdAt,
  }).from(connections).where(ownConnection(organizationId, userId, parsed.data)).limit(1);
  if (!connection) throw ApiError.notFound('Calendar connection not found');
  return { data: connection };
});

const updateSchema = z.object({
  syncEnabled: z.boolean().optional(),
  syncDirection: z.enum(['import', 'export', 'both']).optional(),
  syncPastDays: z.number().int().min(0).max(365).optional(),
  syncFutureDays: z.number().int().min(0).max(730).optional(),
  syncOnlyFreeTime: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one setting is required');

export const PATCH = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  body: updateSchema,
  openapi: { tags: ['Scheduling'], summary: 'Edit own non-secret calendar sync settings' },
}, async ({ organizationId, userId, params, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid connection id');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const [existing] = await tx.select({ id: connections.id })
      .from(connections).where(ownConnection(organizationId, userId, parsed.data))
      .limit(1).for('update');
    if (!existing) throw ApiError.notFound('Calendar connection not found');
    const [updated] = await tx.update(connections)
      .set({ ...body, updatedAt: new Date() })
      .where(ownConnection(organizationId, userId, parsed.data))
      .returning({
        id: connections.id,
        provider: connections.provider,
        syncEnabled: connections.syncEnabled,
        syncDirection: connections.syncDirection,
        syncPastDays: connections.syncPastDays,
        syncFutureDays: connections.syncFutureDays,
        syncOnlyFreeTime: connections.syncOnlyFreeTime,
      });
    if (!updated) throw ApiError.conflict('Calendar connection changed');
    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'calendar.connection.settings.update',
      resourceType: 'external_calendar_connections',
      resourceId: parsed.data,
      details: { fields: Object.keys(body) },
    });
    return { data: updated };
  });
});

export const DELETE = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Disconnect own calendar: revoke the provider grant where possible, then delete the local credentials' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid connection id');

  // The provider is asked first, outside the transaction (an external call must not hold a database transaction open); the local
  // credentials are removed whatever it answers, and the audit row records what it did.
  const [connection] = await withRLSContext({ organizationId, userId }, (tx) => tx
    .select({ provider: connections.provider, accessToken: connections.accessToken, refreshToken: connections.refreshToken })
    .from(connections).where(ownConnection(organizationId, userId, parsed.data)).limit(1));
  if (!connection) throw ApiError.notFound('Calendar connection not found');
  const providerRevocation = await revokeProviderGrant(connection.provider, connection);

  return withRLSContext({ organizationId, userId }, async (tx) => {
    const [deleted] = await tx.delete(connections)
      .where(ownConnection(organizationId, userId, parsed.data))
      .returning({ id: connections.id });
    if (!deleted) throw ApiError.notFound('Calendar connection not found');
    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'calendar.connection.delete',
      resourceType: 'external_calendar_connections',
      resourceId: parsed.data,
      details: { provider: connection.provider, providerRevocation, localCredentialsDeleted: true },
    });
    return { deleted: true, id: deleted.id, providerRevocation, providerRevocationVerified: providerRevocation === 'revoked' };
  });
});
