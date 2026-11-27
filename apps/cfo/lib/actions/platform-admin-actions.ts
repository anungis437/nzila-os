/** Existing global administration under the actual platform permission source. */
'use server'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import {
  platformFirms,
  platformMetrics,
  changeFirm,
  type Firm,
  type PlatformMetrics,
} from '@/lib/services/platform-administration'
export type { Firm, PlatformMetrics } from '@/lib/services/platform-administration'
/** Log a failed action with the structured logger and rethrow it unchanged.
 * Scope denials are not operational failures and are not logged here. */
function logged<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    if (!(error instanceof CfoScopeError))
      logger.error(`Platform admin ${operation} failed`, { error })
    throw error
  })
}
/** Invalidate the admin dashboard only after a committed, successful change. */
async function firmChange(
  operation: string,
  run: () => Promise<{ success: boolean }>,
): Promise<{ success: boolean }> {
  const result = await logged(operation, run)
  if (!result.success) return result
  try {
    revalidatePath('/dashboard/platform-admin')
  } catch {
    logger.warn('Platform admin cache invalidation unavailable after commit')
  }
  return result
}
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  return logged('metrics', () =>
    resolveOrgContext('platform', { permission: 'platform_admin:manage' }, platformMetrics),
  )
}
export async function listFirms(): Promise<Firm[]> {
  return logged('list firms', () =>
    resolveOrgContext('platform', { permission: 'platform_admin:manage' }, platformFirms),
  )
}
export async function suspendFirm(firmId: string): Promise<{ success: boolean }> {
  return firmChange('suspend firm', () =>
    resolveOrgContext('platform', { permission: 'platform_admin:manage' }, (context) =>
      changeFirm(context, firmId, { status: 'suspended' }),
    ),
  )
}
export async function reactivateFirm(firmId: string): Promise<{ success: boolean }> {
  return firmChange('reactivate firm', () =>
    resolveOrgContext('platform', { permission: 'platform_admin:manage' }, (context) =>
      changeFirm(context, firmId, { status: 'active' }),
    ),
  )
}
export async function updateFirmSubscription(
  firmId: string,
  tier: Firm['subscriptionTier'],
): Promise<{ success: boolean }> {
  return firmChange('update firm subscription', () =>
    resolveOrgContext('platform', { permission: 'platform_admin:manage' }, (context) =>
      changeFirm(context, firmId, { subscriptionTier: tier }),
    ),
  )
}
