/**
 * Zonga Server Actions — Creators.
 *
 * Manage creator profiles, onboarding, and payee information.
 * Reads/writes domain tables (zonga_creators, zonga_content_assets,
 * zonga_revenue_events, zonga_payouts) + audit_log for traceability.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  type Creator,
} from '@/lib/zonga-services'
import { executeCommand } from '@/lib/control'

export interface CreatorListResult {
  creators: Creator[]
  total: number
}

export async function listCreators(opts?: {
  page?: number
  pageSize?: number
  status?: string
  search?: string
}): Promise<CreatorListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 25
  const offset = (page - 1) * pageSize

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        c.id, c.display_name as name,
        ca.email,
        c.status,
        c.genre,
        c.country,
        (SELECT COUNT(*) FROM zonga_content_assets a WHERE a.creator_id = c.id) as "assetCount",
        (SELECT COALESCE(SUM(r.amount::numeric), 0) FROM zonga_revenue_events r WHERE r.creator_id = c.id) as "totalRevenue",
        c.created_at as "createdAt"
      FROM zonga_creators c
      LEFT JOIN zonga_creator_accounts ca ON ca.creator_id = c.id
      WHERE c.org_id = ${ctx.orgId}
      ORDER BY c.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: Creator[] }

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_creators WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    return {
      creators: rows.rows ?? [],
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('listCreators failed', { error })
    return { creators: [], total: 0 }
  }
}

export async function registerCreator(data: {
  name: string
  email: string
  genre?: string
  country?: string
  bio?: string
  language?: string
  payoutRail?: string
}): Promise<{ success: boolean; creatorId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const result = await executeCommand({
    type: 'register_creator' as const,
    name: data.name,
    email: data.email,
    genre: data.genre,
    country: data.country,
    bio: data.bio,
    language: data.language,
    payout_rail: data.payoutRail,
    actor_id: ctx.actorId,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/dashboard/creators')
  return { success: true, creatorId: result.data?.entity_id }
}

export async function getCreatorDetail(creatorId: string): Promise<{
  creator: Creator | null
  assets: number
  revenue: number
  payouts: number
}> {
  const ctx = await resolveOrgContext()

  try {
    const [creator] = (await platformDb.execute(
      sql`SELECT
        c.id, c.display_name as name,
        ca.email,
        c.status,
        c.genre,
        c.country,
        c.created_at as "createdAt"
      FROM zonga_creators c
      LEFT JOIN zonga_creator_accounts ca ON ca.creator_id = c.id
      WHERE c.id = ${creatorId} AND c.org_id = ${ctx.orgId}
      LIMIT 1`,
    )) as unknown as [Creator | undefined]

    const [assetCount] = (await platformDb.execute(
      sql`SELECT COUNT(*) as count FROM zonga_content_assets
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ count: number }]

    const [revenueSum] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM zonga_revenue_events
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    const [payoutCount] = (await platformDb.execute(
      sql`SELECT COUNT(*) as count FROM zonga_payouts
      WHERE creator_id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ count: number }]

    return {
      creator: creator ?? null,
      assets: Number(assetCount?.count ?? 0),
      revenue: Number(revenueSum?.total ?? 0),
      payouts: Number(payoutCount?.count ?? 0),
    }
  } catch (error) {
    logger.error('getCreatorDetail failed', { error })
    return { creator: null, assets: 0, revenue: 0, payouts: 0 }
  }
}
