/**
 * CFO Server Actions — Platform Administration.
 *
 * Multi-org firm management, MRR computation, and subscription actions.
 * Restricted to platform_admin role.
 */
'use server'

import { auth } from '@clerk/nextjs/server'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { requireRole } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'

/* ─── Types ─── */

export interface Firm {
  id: string
  name: string
  status: 'active' | 'suspended' | 'trial'
  subscriptionTier: 'starter' | 'professional' | 'enterprise'
  userCount: number
  clientCount: number
  createdAt: Date
}

export interface PlatformMetrics {
  totalFirms: number
  activeFirms: number
  totalUsers: number
  totalClients: number
  mrr: number
  trialCount: number
}

const TIER_PRICES: Record<string, number> = {
  starter: 199,
  professional: 499,
  enterprise: 999,
}

/* ─── Queries ─── */

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requireRole('platform_admin')

  try {
    const firmRows = (await platformDb.execute(
      sql`SELECT id, metadata->>'name' as name,
        metadata->>'status' as status,
        metadata->>'subscriptionTier' as "subscriptionTier"
      FROM audit_log WHERE action = 'firm.registered'
      ORDER BY created_at DESC`,
    )) as unknown as { rows: { id: string; name: string; status: string; subscriptionTier: string }[] }

    const firms = firmRows.rows ?? []
    const activeFirms = firms.filter((f) => f.status === 'active')
    const trialFirms = firms.filter((f) => f.status === 'trial')
    const mrr = activeFirms.reduce(
      (sum, f) => sum + (TIER_PRICES[f.subscriptionTier] ?? 0),
      0,
    )

    const [userCount] = (await platformDb.execute(
      sql`SELECT COUNT(DISTINCT actor_id) as total FROM audit_log`,
    )) as unknown as [{ total: number }]

    const [clientCount] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM audit_log WHERE action = 'entity.created' AND entity_type = 'client'`,
    )) as unknown as [{ total: number }]

    return {
      totalFirms: firms.length,
      activeFirms: activeFirms.length,
      totalUsers: Number(userCount?.total ?? 0),
      totalClients: Number(clientCount?.total ?? 0),
      mrr,
      trialCount: trialFirms.length,
    }
  } catch (error) {
    logger.error('getPlatformMetrics failed', { error })
    return { totalFirms: 0, activeFirms: 0, totalUsers: 0, totalClients: 0, mrr: 0, trialCount: 0 }
  }
}

export async function listFirms(): Promise<Firm[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requireRole('platform_admin')

  try {
    const rows = (await platformDb.execute(
      sql`SELECT id, metadata->>'name' as name,
        metadata->>'status' as status,
        metadata->>'subscriptionTier' as "subscriptionTier",
        COALESCE((metadata->>'userCount')::int, 0) as "userCount",
        COALESCE((metadata->>'clientCount')::int, 0) as "clientCount",
        created_at as "createdAt"
      FROM audit_log WHERE action = 'firm.registered'
      ORDER BY created_at DESC`,
    )) as unknown as { rows: Firm[] }
    return rows.rows ?? []
  } catch (error) {
    logger.error('listFirms failed', { error })
    return []
  }
}

export async function suspendFirm(firmId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requireRole('platform_admin')

  try {
    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata || '{"status": "suspended"}'::jsonb
      WHERE id = ${firmId} AND action = 'firm.registered'`,
    )
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES ('firm.suspended', ${userId}, 'firm', ${firmId},
        ${JSON.stringify({ suspendedBy: userId })}::jsonb)`,
    )
    revalidatePath('/dashboard/platform-admin')
    return { success: true }
  } catch (error) {
    logger.error('suspendFirm failed', { error })
    return { success: false }
  }
}

export async function reactivateFirm(firmId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requireRole('platform_admin')

  try {
    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata || '{"status": "active"}'::jsonb
      WHERE id = ${firmId} AND action = 'firm.registered'`,
    )
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES ('firm.reactivated', ${userId}, 'firm', ${firmId},
        ${JSON.stringify({ reactivatedBy: userId })}::jsonb)`,
    )
    revalidatePath('/dashboard/platform-admin')
    return { success: true }
  } catch (error) {
    logger.error('reactivateFirm failed', { error })
    return { success: false }
  }
}

export async function updateFirmSubscription(
  firmId: string,
  tier: Firm['subscriptionTier'],
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requireRole('platform_admin')

  try {
    await platformDb.execute(
      sql`UPDATE audit_log SET metadata = metadata || ${JSON.stringify({ subscriptionTier: tier })}::jsonb
      WHERE id = ${firmId} AND action = 'firm.registered'`,
    )
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata)
      VALUES ('firm.subscription.updated', ${userId}, 'firm', ${firmId},
        ${JSON.stringify({ tier, updatedBy: userId })}::jsonb)`,
    )
    revalidatePath('/dashboard/platform-admin')
    return { success: true }
  } catch (error) {
    logger.error('updateFirmSubscription failed', { error })
    return { success: false }
  }
}
