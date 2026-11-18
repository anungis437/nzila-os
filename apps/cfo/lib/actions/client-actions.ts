'use server'

import { revalidatePath } from 'next/cache'
import { orgs, orgMembers } from '@nzila/db/schema'
import { eq, and, ilike, desc, inArray, sql, count, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { CfoScopeError, isCfoOrganizationId, resolveOrgContext } from '@/lib/resolve-org'
import { cfoRows } from '@/queries/action-context'
import { clientInput, createCfoClient } from '@/lib/services/clients'

export interface Client {
  id: string
  name: string
  contactEmail: string | null
  status: string
  createdAt: Date
  memberCount: number
}
export interface ClientListResult {
  clients: Client[]
  total: number
}

export async function listClients(opts?: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ClientListResult> {
  try {
    return await resolveOrgContext(
      'collection',
      { permission: 'clients:view' },
      async (context) => {
        const page = Math.max(1, Math.trunc(opts?.page ?? 1)),
          pageSize = Math.min(100, Math.max(1, Math.trunc(opts?.pageSize ?? 20)))
        const conditions: SQL[] = []
        if (context.purpose === 'organizations')
          conditions.push(inArray(orgs.id, [...context.organizationIds]))
        if (opts?.search) conditions.push(ilike(orgs.legalName, `%${opts.search}%`))
        if (opts?.status) conditions.push(eq(orgs.status, opts.status as typeof orgs.status._.data))
        const where = conditions.length ? and(...conditions) : undefined
        const rows = await context.db
          .select({
            id: orgs.id,
            name: orgs.legalName,
            status: orgs.status,
            createdAt: orgs.createdAt,
          })
          .from(orgs)
          .where(where)
          .orderBy(desc(orgs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize)
        const [total] = await context.db.select({ count: count() }).from(orgs).where(where)
        const memberCounts = rows.length
          ? await context.db
              .select({ organizationId: orgMembers.orgId, count: count() })
              .from(orgMembers)
              .where(
                and(
                  inArray(
                    orgMembers.orgId,
                    rows.map((row) => row.id),
                  ),
                  eq(orgMembers.status, 'active'),
                ),
              )
              .groupBy(orgMembers.orgId)
          : []
        const membersByOrg = new Map(memberCounts.map((row) => [row.organizationId, row.count]))
        const clients = rows.map((client) => ({
          ...client,
          contactEmail: null,
          memberCount: membersByOrg.get(client.id) ?? 0,
        }))

        return { clients, total: total?.count ?? 0 }
      },
    )
  } catch (error) {
    if (error instanceof CfoScopeError) throw error
    logger.error('Failed to list clients', { error })
    return { clients: [], total: 0 }
  }
}

export async function createClient(
  data: z.input<typeof clientInput>,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    // A legal entity is a platform resource. A default firm role cannot create
    // an organization outside a verified relationship by supplying its label.
    const entity = await resolveOrgContext(
      'platform',
      { permission: 'clients:create' },
      async (context) => {
        return createCfoClient(context, data)
      },
    )
    try {
      revalidatePath('/dashboard/clients')
    } catch (error) {
      logger.warn('Client cache invalidation failed after commit', { error, clientId: entity.id })
    }
    return { ok: true, id: entity.id }
  } catch (error) {
    if (error instanceof CfoScopeError) {
      if (error.message === 'Unauthorized') return { ok: false, error: 'Unauthorized' }
      throw error
    }
    logger.error('Failed to create client', { error })
    return { ok: false, error: 'Failed to create client' }
  }
}

export async function getClientDetail(clientId: string) {
  try {
    return await resolveOrgContext(
      'collection',
      { permission: 'clients:view' },
      async (context) => {
        if (!isCfoOrganizationId(clientId)) throw new CfoScopeError()
        const target = clientId.toLowerCase()
        if (context.purpose === 'organizations' && !context.organizationIds.includes(target))
          throw new CfoScopeError()
        const [client] = await context.db.select().from(orgs).where(eq(orgs.id, target)).limit(1)
        if (!client) return null
        const members = await context.db
          .select()
          .from(orgMembers)
          .where(eq(orgMembers.orgId, target))
          .orderBy(desc(orgMembers.createdAt))
        const [financials] = cfoRows<{
          total_revenue: number
          document_count: number
          audit_event_count: number
        }>(
          await context.db.execute(sql`
        SELECT COALESCE(SUM(CAST(metadata->>'amount' AS NUMERIC)) FILTER (WHERE action LIKE 'revenue.%'),0) AS total_revenue,
          COUNT(*) FILTER (WHERE action LIKE 'document.%') AS document_count,COUNT(*) AS audit_event_count
        FROM public.audit_log WHERE org_id=${target}::uuid`),
        )
        const recentActivity = cfoRows<{ id: string; action: string; createdAt: Date }>(
          await context.db.execute(sql`
        SELECT id,action,created_at AS "createdAt" FROM public.audit_log WHERE org_id=${target}::uuid ORDER BY created_at DESC LIMIT 10`),
        )
        return {
          ...client,
          members,
          financialSummary: {
            totalRevenue: Number(financials?.total_revenue ?? 0),
            documentCount: Number(financials?.document_count ?? 0),
            auditEventCount: Number(financials?.audit_event_count ?? 0),
            recentActivity,
          },
        }
      },
    )
  } catch (error) {
    if (error instanceof CfoScopeError) throw error
    logger.error('Failed to get client detail', { error, clientId })
    return null
  }
}
