/**
 * API — Audit Event Query
 * GET /api/audit/events?orgId=...&actorId=...&action=...&targetType=...&startTime=...&endTime=...&limit=...&offset=...
 *
 * Paginated, filtered query endpoint for the append-only audit_events table.
 * Org-scoped: requires org membership or platform_admin role.
 * Returns events newest-first with total count for pagination.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgAccess } from '@/lib/api-guards'
import { queryAuditEvents } from '@/lib/audit-db'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('api.audit.events')

const QuerySchema = z.object({
  orgId: z.string().uuid(),
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).max(100).optional(),
  targetType: z.string().min(1).max(100).optional(),
  targetId: z.string().uuid().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = QuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { orgId, actorId, action, targetType, targetId, startTime, endTime, limit, offset } =
    parsed.data

  const guard = await requireOrgAccess(orgId, {
    minRole: 'org_admin',
    platformBypass: ['platform_admin'],
  })
  if (!guard.ok) return guard.response

  try {
    const result = await queryAuditEvents({
      orgId,
      actorId,
      action,
      targetType,
      targetId,
      startTime,
      endTime,
      limit,
      offset,
    })

    logger.info('Audit events queried', {
      orgId,
      filters: { actorId, action, targetType, targetId, startTime, endTime },
      returned: result.events.length,
      total: result.total,
    })

    return NextResponse.json({
      events: result.events.map((e) => ({
        id: e.id,
        actorClerkUserId: e.actorClerkUserId,
        actorRole: e.actorRole,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        beforeJson: e.beforeJson,
        afterJson: e.afterJson,
        createdAt: e.createdAt,
      })),
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.events.length < result.total,
      },
    })
  } catch (error) {
    logger.error('Audit events query failed', { orgId, error })
    return NextResponse.json({ error: 'Failed to query audit events' }, { status: 500 })
  }
}
