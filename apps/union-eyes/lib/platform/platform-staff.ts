/**
 * Platform-staff authority for reads and operations across organizations.
 *
 * A role title is not authority over other organizations. An organization's `platform_lead` or `system_admin` title says what someone may do
 * inside their own organization; reading every tenant's people or figures, or creating and resetting another organization, needs the
 * platform-staff authority (`isPlatformAdminUser`: the canonical binding's system-administrator fact, or the legacy allow-list outside the
 * canonical mode), the same authority the pilot overview, the member status route and the cache administration already require. Without it
 * the request is refused, and the refusal is recorded under the caller's own organization so the attempt is visible. There is no fallback
 * to the role title and no partial answer.
 */
import { ApiError } from '@/lib/api/framework'
import { isPlatformAdminUser } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'

export const PLATFORM_CAPABILITIES = [
  'platform.user_directory.read',
  'platform.member_activity.read',
  'platform.stats.read',
  'platform.pilot_fixture.manage',
] as const
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number]

export interface PlatformActor {
  userId: string
  organizationId: string
}

export async function requirePlatformStaffAuthority(
  actor: { userId?: string | null; organizationId?: string | null },
  capability: PlatformCapability,
): Promise<PlatformActor> {
  const { userId, organizationId } = actor
  if (!userId || !organizationId) throw ApiError.forbidden('A platform-wide request needs an authenticated platform administrator acting in an organization')
  if (await isPlatformAdminUser(userId)) return { userId, organizationId }

  try {
    await withRLSContext({ organizationId, userId }, (tx) =>
      persistAtomicAudit(tx, { organizationId, userId, action: `${capability}.denied`, resourceType: 'platform_authority', details: { reason: 'no_platform_staff_authority' } }, 'failure'),
    )
  } catch (error) {
    // The refusal stands whether or not it could be recorded.
    logger.error('platform_authority_denial_not_recorded', { capability, error: error instanceof Error ? error.message : 'unknown' })
  }
  throw ApiError.forbidden('Acting across organizations needs platform-staff authority; a role title is not enough')
}
