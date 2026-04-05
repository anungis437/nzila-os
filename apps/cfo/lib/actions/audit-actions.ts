/**
 * CFO Server Actions — Audit Trail.
 *
 * Provides searchable, filterable access to the platform audit_log
 * for governance and compliance review.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

/* ─── Types ─── */

export interface AuditEntry {
  id: string
  action: string
  actorId: string
  entityType: string | null
  orgId: string | null
  metadata: Record<string, unknown>
  ipAddress: string | null
  createdAt: Date
}

export interface AuditFilters {
  page?: number
  pageSize?: number
  search?: string
  action?: string
  actorId?: string
  entityType?: string
  dateFrom?: string
  dateTo?: string
}

/* ─── Queries ─── */

export async function listAuditEntries(
  filters?: AuditFilters,
): Promise<{ entries: AuditEntry[]; total: number; actions: string[] }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('audit:view')

  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 50
  const offset = (page - 1) * pageSize

  try {
    const conditions: ReturnType<typeof sql>[] = []

    if (filters?.search) {
      conditions.push(sql`AND (
        action ILIKE ${'%' + filters.search + '%'}
        OR actor_id ILIKE ${'%' + filters.search + '%'}
        OR entity_type ILIKE ${'%' + filters.search + '%'}
      )`)
    }
    if (filters?.action) {
      conditions.push(sql`AND action = ${filters.action}`)
    }
    if (filters?.actorId) {
      conditions.push(sql`AND actor_id = ${filters.actorId}`)
    }
    if (filters?.entityType) {
      conditions.push(sql`AND entity_type = ${filters.entityType}`)
    }
    if (filters?.dateFrom) {
      conditions.push(sql`AND created_at >= ${filters.dateFrom}::timestamptz`)
    }
    if (filters?.dateTo) {
      conditions.push(sql`AND created_at <= ${filters.dateTo}::timestamptz`)
    }

    const whereClause = conditions.length > 0
      ? sql.join(conditions, sql` `)
      : sql``

    const rows = (await platformDb.execute(
      sql`SELECT id, action, actor_id as "actorId",
        entity_type as "entityType", org_id as "orgId",
        metadata, metadata->>'ipAddress' as "ipAddress",
        created_at as "createdAt"
      FROM audit_log WHERE 1=1 ${whereClause}
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: AuditEntry[] }

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log WHERE 1=1 ${whereClause}`,
    )) as unknown as [{ total: number }]

    // Get distinct action types for filter dropdown
    const actionRows = (await platformDb.execute(
      sql`SELECT DISTINCT action FROM audit_log ORDER BY action LIMIT 100`,
    )) as unknown as { rows: { action: string }[] }

    return {
      entries: rows.rows ?? [],
      total: Number(cnt?.total ?? 0),
      actions: (actionRows.rows ?? []).map((r) => r.action),
    }
  } catch (error) {
    logger.error('listAuditEntries failed', { error })
    return { entries: [], total: 0, actions: [] }
  }
}

export async function getAuditStats(): Promise<{
  totalEntries: number
  todayEntries: number
  uniqueActors: number
  uniqueActions: number
}> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('audit:view')

  try {
    const [stats] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) as "totalEntries",
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as "todayEntries",
        COUNT(DISTINCT actor_id) as "uniqueActors",
        COUNT(DISTINCT action) as "uniqueActions"
      FROM audit_log`,
    )) as unknown as [{
      totalEntries: number
      todayEntries: number
      uniqueActors: number
      uniqueActions: number
    }]

    return {
      totalEntries: Number(stats?.totalEntries ?? 0),
      todayEntries: Number(stats?.todayEntries ?? 0),
      uniqueActors: Number(stats?.uniqueActors ?? 0),
      uniqueActions: Number(stats?.uniqueActions ?? 0),
    }
  } catch (error) {
    logger.error('getAuditStats failed', { error })
    return { totalEntries: 0, todayEntries: 0, uniqueActors: 0, uniqueActions: 0 }
  }
}
