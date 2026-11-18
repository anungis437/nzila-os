/** Existing global administration under the actual platform permission source. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  platformFirms,
  platformMetrics,
  changeFirm,
  type Firm,
  type PlatformMetrics,
} from '@/lib/services/platform-administration'
export type { Firm, PlatformMetrics } from '@/lib/services/platform-administration'
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  return resolveOrgContext('platform', { permission: 'platform_admin:manage' }, platformMetrics)
}
export async function listFirms(): Promise<Firm[]> {
  return resolveOrgContext('platform', { permission: 'platform_admin:manage' }, platformFirms)
}
export async function suspendFirm(firmId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('platform', { permission: 'platform_admin:manage' }, async (context) => {
    const result = await changeFirm(context, firmId, { status: 'suspended' })
    return result
  })
}
export async function reactivateFirm(firmId: string): Promise<{ success: boolean }> {
  return resolveOrgContext('platform', { permission: 'platform_admin:manage' }, (context) =>
    changeFirm(context, firmId, { status: 'active' }),
  )
}
export async function updateFirmSubscription(
  firmId: string,
  tier: Firm['subscriptionTier'],
): Promise<{ success: boolean }> {
  return resolveOrgContext('platform', { permission: 'platform_admin:manage' }, (context) =>
    changeFirm(context, firmId, { subscriptionTier: tier }),
  )
}
