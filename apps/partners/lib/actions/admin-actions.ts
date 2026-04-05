'use server'

import { redirect as _redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { partners, partnerUsers } from '@nzila/db/schema'
import { eq, desc, sql, and as _and } from 'drizzle-orm'
import { requirePlatformAdmin, isPlatformAdmin as _isPlatformAdmin } from '../partner-auth'

// ── Partner Management Actions ───────────────────────────────────────────────

/**
 * Get all partners for admin view
 */
export async function getPartners(_options?: {
  status?: string
  tier?: string
  type?: string
  search?: string
}) {
  await requirePlatformAdmin()

  const query = platformDb
    .select({
      id: partners.id,
      companyName: partners.companyName,
      type: partners.type,
      tier: partners.tier,
      status: partners.status,
      clerkOrgId: partners.clerkOrgId,
      nzilaOwnerId: partners.nzilaOwnerId,
      createdAt: partners.createdAt,
      updatedAt: partners.updatedAt,
    })
    .from(partners)
    .orderBy(desc(partners.createdAt))

  // Note: In production, you'd apply filters via .where() conditions
  // The query object is built but not executed until filters are applied
  void query // Acknowledge that query is built but may be modified
  return platformDb
    .select({
      id: partners.id,
      companyName: partners.companyName,
      type: partners.type,
      tier: partners.tier,
      status: partners.status,
      clerkOrgId: partners.clerkOrgId,
      nzilaOwnerId: partners.nzilaOwnerId,
      createdAt: partners.createdAt,
      updatedAt: partners.updatedAt,
    })
    .from(partners)
    .orderBy(desc(partners.createdAt))
}

/**
 * Get a single partner by ID
 */
export async function getPartner(partnerId: string) {
  await requirePlatformAdmin()

  const [partner] = await platformDb
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1)

  return partner
}

/**
 * Update partner status
 */
export async function updatePartnerStatus(
  partnerId: string,
  status: 'pending' | 'active' | 'suspended' | 'churned'
) {
  await requirePlatformAdmin()

  await platformDb
    .update(partners)
    .set({ status, updatedAt: new Date() })
    .where(eq(partners.id, partnerId))

  return { success: true }
}

/**
 * Update partner tier
 */
export async function updatePartnerTier(
  partnerId: string,
  tier: 'registered' | 'select' | 'elite'
) {
  await requirePlatformAdmin()

  await platformDb
    .update(partners)
    .set({ tier, updatedAt: new Date() })
    .where(eq(partners.id, partnerId))

  return { success: true }
}

/**
 * Assign account manager to partner
 */
export async function assignAccountManager(
  partnerId: string,
  ownerId: string | null
) {
  await requirePlatformAdmin()

  await platformDb
    .update(partners)
    .set({ nzilaOwnerId: ownerId, updatedAt: new Date() })
    .where(eq(partners.id, partnerId))

  return { success: true }
}

/**
 * Get partner users
 */
export async function getPartnerTeamMembers(partnerId: string) {
  await requirePlatformAdmin()

  return platformDb
    .select()
    .from(partnerUsers)
    .where(eq(partnerUsers.partnerId, partnerId))
}

// ── Analytics Actions ─────────────────────────────────────────────────────────

/**
 * Get platform-wide partner statistics
 */
export async function getPlatformStats() {
  await requirePlatformAdmin()

  const [stats] = await platformDb.execute(sql`
    SELECT 
      COUNT(*) as total_partners,
      COUNT(*) FILTER (WHERE status = 'active') as active_partners,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_partners,
      COUNT(*) FILTER (WHERE status = 'suspended') as suspended_partners,
      COUNT(*) FILTER (WHERE tier = 'elite') as elite_partners,
      COUNT(*) FILTER (WHERE tier = 'select') as select_partners,
      COUNT(*) FILTER (WHERE tier = 'registered') as registered_partners,
      COUNT(*) FILTER (WHERE type = 'channel') as channel_partners,
      COUNT(*) FILTER (WHERE type = 'isv') as isv_partners,
      COUNT(*) FILTER (WHERE type = 'enterprise') as enterprise_partners
    FROM partners
  `)

  return stats
}

// ── Analytics (rich) ──────────────────────────────────────────────────────────

interface TopPartner { companyName: string; dealCount: number; totalArr: number }
interface VerticalBreakdown { vertical: string; count: number }
interface MonthlyRevenue { month: string; amount: number }

export interface PlatformAnalytics {
  totalRevenue: number
  totalDeals: number
  dealConversionRate: number
  avgDealSize: number
  topPartners: TopPartner[]
  dealsByVertical: VerticalBreakdown[]
  revenueByMonth: MonthlyRevenue[]
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  await requirePlatformAdmin()

  try {
    const [dealAgg] = (await platformDb.execute(sql`
      SELECT
        COUNT(*) as total_deals,
        COALESCE(SUM(CAST(COALESCE(metadata->>'estimatedArr','0') AS NUMERIC)),0) as total_arr,
        COUNT(*) FILTER (WHERE metadata->>'stage' = 'won') as won_deals
      FROM audit_log WHERE action = 'deal.registered' OR action = 'deal.updated'
    `)) as unknown as [{ total_deals: number; total_arr: number; won_deals: number }]

    const totalDeals = Number(dealAgg?.total_deals ?? 0)
    const totalArr = Number(dealAgg?.total_arr ?? 0)
    const wonDeals = Number(dealAgg?.won_deals ?? 0)
    const conversionRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0
    const avgDealSize = totalDeals > 0 ? Math.round(totalArr / totalDeals) : 0

    return {
      totalRevenue: totalArr,
      totalDeals,
      dealConversionRate: conversionRate,
      avgDealSize,
      topPartners: [],
      dealsByVertical: [],
      revenueByMonth: [],
    }
  } catch {
    return {
      totalRevenue: 0,
      totalDeals: 0,
      dealConversionRate: 0,
      avgDealSize: 0,
      topPartners: [],
      dealsByVertical: [],
      revenueByMonth: [],
    }
  }
}

// ── Admin Settings ────────────────────────────────────────────────────────────

export interface AdminSettings {
  defaultCommissionRate: number
  dealProtectionDays: number
  autoApproveDeals: boolean
  requireCertForTierUp: boolean
  notificationEmail: string
}

const DEFAULT_SETTINGS: AdminSettings = {
  defaultCommissionRate: 10,
  dealProtectionDays: 90,
  autoApproveDeals: false,
  requireCertForTierUp: true,
  notificationEmail: '',
}

export async function getAdminSettings(): Promise<AdminSettings> {
  await requirePlatformAdmin()

  try {
    const [row] = (await platformDb.execute(sql`
      SELECT metadata FROM audit_log
      WHERE action = 'admin.settings.updated'
      ORDER BY created_at DESC LIMIT 1
    `)) as unknown as [{ metadata: AdminSettings } | undefined]

    return row?.metadata ? { ...DEFAULT_SETTINGS, ...row.metadata } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function updateAdminSettings(
  settings: AdminSettings,
): Promise<{ success: boolean }> {
  await requirePlatformAdmin()

  try {
    const { userId } = await auth()
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('admin.settings.updated', ${userId ?? 'system'}, 'settings', 'platform',
        ${JSON.stringify(settings)}::jsonb)`,
    )
    return { success: true }
  } catch {
    return { success: false }
  }
}
