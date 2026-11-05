/**
 * Calendar connections. Access and refresh credentials must never cross the
 * provider-auth service boundary or be accepted as arbitrary client input.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { externalCalendarConnections } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  rlsOrgContext: true,
  openapi: { tags: ['Scheduling'], summary: 'List own calendar connections without credentials' },
}, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  const connections = await db.select({
    id: externalCalendarConnections.id,
    provider: externalCalendarConnections.provider,
    providerAccountId: externalCalendarConnections.providerAccountId,
    providerEmail: externalCalendarConnections.providerEmail,
    syncEnabled: externalCalendarConnections.syncEnabled,
    syncDirection: externalCalendarConnections.syncDirection,
    lastSyncAt: externalCalendarConnections.lastSyncAt,
    nextSyncAt: externalCalendarConnections.nextSyncAt,
    syncStatus: externalCalendarConnections.syncStatus,
    isActive: externalCalendarConnections.isActive,
    createdAt: externalCalendarConnections.createdAt,
  }).from(externalCalendarConnections).where(and(
    eq(externalCalendarConnections.organizationId, organizationId),
    eq(externalCalendarConnections.userId, userId),
  )).orderBy(desc(externalCalendarConnections.createdAt)).limit(100);
  return { connections };
});

const connectSchema = z.object({
  provider: z.enum(['google', 'microsoft']),
}).strict();

export const POST = withApi({
  auth: { required: true, minRole: 'member' },
  body: connectSchema,
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Start provider-authorized calendar connection' },
}, async ({ body }) => {
  // The actual connection is created ONLY by a validated OAuth callback.
  // Direct creation with caller-supplied tokens is forbidden.
  const connectUrl = body.provider === 'google'
    ? '/api/calendar-sync/google/auth'
    : '/api/calendar-sync/microsoft/auth';
  return { connectUrl, connectionCreated: false };
});
