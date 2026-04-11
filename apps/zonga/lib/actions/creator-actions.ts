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
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
} from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
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

  // Resolve auth org ID → DB org UUID via organizations table
  const [orgRow] = (await platformDb.execute(
    sql`SELECT id FROM organizations WHERE id = ${ctx.orgId} LIMIT 1`,
  )) as unknown as [{ id: string } | undefined]
  const dbOrgId = orgRow?.id ?? ctx.orgId

  if (!dbOrgId) {
    logger.warn('listCreators: no DB org found for auth org', { orgId: ctx.orgId })
    return { creators: [], total: 0 }
  }

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 25
  const offset = (page - 1) * pageSize

  try {
    const searchFilter = opts?.search
      ? sql`AND LOWER(c.display_name) LIKE ${'%' + opts.search.toLowerCase() + '%'}`
      : sql``

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
      WHERE c.org_id = ${dbOrgId}
        ${searchFilter}
      ORDER BY c.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as Creator[]

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_creators c WHERE c.org_id = ${dbOrgId} ${searchFilter}`,
    )) as unknown as [{ total: number }]

    return {
      creators: rows,
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

  const creatorId = result.data?.entity_id

  const auditEvent = buildZongaAuditEvent({
    action: ZongaAuditAction.CREATOR_ACTIVATE,
    entityType: ZongaEntityType.CREATOR,
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    targetId: creatorId ?? 'unknown',
    metadata: { name: data.name },
  })
  logger.info('Creator registered', { ...auditEvent })

  const pack = buildEvidencePackFromAction({
    actionType: 'CREATOR_REGISTERED',
    orgId: ctx.orgId,
    executedBy: ctx.actorId,
    actionId: crypto.randomUUID(),
  })
  await processEvidencePack(pack)

  revalidatePath('/dashboard/creators')
  return { success: true, creatorId }
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

/**
 * Self-service creator application for listeners.
 *
 * Unlike `registerCreator()` (which requires an active org), this action
 * lets an unauthenticated-to-org listener apply as a creator. The creator
 * profile is created with org_id = NULL and status = 'applied'. Once
 * approved, the user can create/join an organization to unlock uploads,
 * royalties, and the full Creator Studio.
 */
export async function applyAsCreator(data: {
  name: string
  email: string
  genre?: string
  country?: string
  bio?: string
  language?: string
  payoutRail?: string
}): Promise<{ success: boolean; creatorId?: string; error?: string }> {
  const { resolveListenerContext } = await import('@/lib/resolve-org')
  const ctx = await resolveListenerContext()

  const creatorId = crypto.randomUUID()

  try {
    // Check for existing application
    const existing = (await platformDb.execute(
      sql`SELECT id FROM zonga_creators WHERE user_id = ${ctx.actorId} LIMIT 1`,
    )) as unknown as { id: string }[]
    if (existing.length > 0) {
      return { success: false, error: 'You have already applied as a creator.' }
    }

    // Persist creator profile (org_id = NULL)
    await platformDb.execute(
      sql`INSERT INTO zonga_creators (id, org_id, user_id, display_name, status, genre, country)
      VALUES (${creatorId}, NULL, ${ctx.actorId}, ${data.name},
        'applied', ${data.genre ?? null}, ${data.country ?? null})`,
    )

    // Persist creator account
    await platformDb.execute(
      sql`INSERT INTO zonga_creator_accounts (org_id, creator_id, email, onboarding_status)
      VALUES (NULL, ${creatorId}, ${data.email}, 'registered')`,
    )

    // Audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata, org_id)
      VALUES ('creator.applied', ${ctx.actorId}, 'creator', ${creatorId},
        ${JSON.stringify({ name: data.name, email: data.email, self_service: true })}::jsonb, NULL)`,
    )

    logger.info('Listener applied as creator (self-service)', {
      creatorId,
      actorId: ctx.actorId,
      name: data.name,
    })

    revalidatePath('/dashboard/creators')
    revalidatePath('/dashboard/listener')
    return { success: true, creatorId }
  } catch (error) {
    logger.error('applyAsCreator failed', { error })
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
}
