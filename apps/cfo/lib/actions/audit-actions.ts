/**
 * CFO Server Actions — Audit Trail.
 *
 * Provides searchable, filterable access to the platform audit_log
 * for governance and compliance review.
 */
'use server'

import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { resolveOrgContext } from '@/lib/resolve-org'
import { cfoRows } from '@/queries/action-context'
import { legacyCfoAuditPredicate } from '@/lib/services/cfo-records'

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
  return resolveOrgContext(
    'resource',
    { permission: 'audit:view' },
    async (context): Promise<{ entries: AuditEntry[]; total: number; actions: string[] }> => {
      const scope = legacyCfoAuditPredicate(context)
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

        const whereClause = conditions.length > 0 ? sql.join(conditions, sql` `) : sql``

        const rows = cfoRows<AuditEntry>(
          await context.db.execute(
            sql`SELECT id, action, actor_id as "actorId",
        entity_type as "entityType", org_id as "orgId",
        metadata, metadata->>'ipAddress' as "ipAddress",
        created_at as "createdAt"
      FROM public.audit_log WHERE ${scope} ${whereClause}
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
          ),
        )

        const [cnt] = cfoRows<{ total: number }>(
          await context.db.execute(
            sql`SELECT COUNT(*) as total FROM public.audit_log WHERE ${scope} ${whereClause}`,
          ),
        )

        // Get distinct action types for filter dropdown
        const actionRows = cfoRows<{ action: string }>(
          await context.db.execute(
            sql`SELECT DISTINCT action FROM public.audit_log WHERE ${scope} ORDER BY action LIMIT 100`,
          ),
        )

        return {
          entries: rows ?? [],
          total: Number(cnt?.total ?? 0),
          actions: (actionRows ?? []).map((r) => r.action),
        }
      } catch (error) {
        logger.error('listAuditEntries failed', { error })
        return { entries: [], total: 0, actions: [] }
      }
    },
  )
}

export async function getAuditStats(): Promise<{
  totalEntries: number
  todayEntries: number
  uniqueActors: number
  uniqueActions: number
}> {
  return resolveOrgContext(
    'resource',
    { permission: 'audit:view' },
    async (
      context,
    ): Promise<{
      totalEntries: number
      todayEntries: number
      uniqueActors: number
      uniqueActions: number
    }> => {
      const scope = legacyCfoAuditPredicate(context)
      try {
        const [stats] = cfoRows<{
          totalEntries: number
          todayEntries: number
          uniqueActors: number
          uniqueActions: number
        }>(
          await context.db.execute(
            sql`SELECT
        COUNT(*) as "totalEntries",
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as "todayEntries",
        COUNT(DISTINCT actor_id) as "uniqueActors",
        COUNT(DISTINCT action) as "uniqueActions"
      FROM public.audit_log WHERE ${scope}`,
          ),
        )

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
    },
  )
}
