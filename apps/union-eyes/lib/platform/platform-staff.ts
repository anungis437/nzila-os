/**
 * Platform-staff authority for reads and operations across organizations.
 *
 * A role title is not authority over other organizations. An organization's `platform_lead` or `system_admin` title says what someone may do
 * inside their own organization; reading every tenant's people or figures, or creating and resetting another organization, needs the
 * platform-staff eligibility (`isPlatformAdminUser`) AND either the platform executive appointment (an active `executive` membership in the
 * platform organization, held by the platform owner) or a live, accepted, action-specific `platform_staff` mandate issued in the platform
 * organization (lib/authority/platform-organization.ts) through its adopted issuance rule. Identity is only eligibility: it never supplies the
 * mandate, and the mandate is exercised only while acting from the platform organization itself - a session bound to a customer
 * organization cannot reach it. Every refusal, including an unverifiable mandate lookup, is recorded under the caller's own organization.
 * There is no fallback to a role title, an allow-list entry, or a partial answer.
 */
import { ApiError } from '@/lib/api/framework'
import { isPlatformAdminUser } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import {
  isPlatformOrganization,
  PLATFORM_CAPABILITIES,
  PLATFORM_ORGANIZATION_ID,
  type PlatformCapability,
} from '@/lib/authority/platform-organization'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { authOrganizationUsers } from '@nzila/db/schema'
import { authDb, withAuthContext } from '@nzila/platform-auth/auth-execution'
import { and, eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { sql } from 'drizzle-orm'

export { PLATFORM_CAPABILITIES, type PlatformCapability }

export interface PlatformActor {
  userId: string
  organizationId: string
}

async function hasLivePlatformMandate(userId: string, capability: PlatformCapability): Promise<boolean> {
  // This is a direct, named scope: the platform pseudo-organization that owns
  // platform-staff mandates. The system role intentionally has no broad read
  // grant on tenant authority instruments.
  const rows = await withRLSContext({ organizationId: PLATFORM_ORGANIZATION_ID, userId }, (tx) =>
    tx.execute<{ id: string }>(sql`
      SELECT m.id::text AS id
        FROM ue_authority_mandates m
       WHERE m.organization_id = ${PLATFORM_ORGANIZATION_ID}::uuid
         AND m.principal_user_id = ${userId}
         AND m.kind = 'platform_staff'
         AND m.status = 'active'
         AND m.revoked_at IS NULL
         AND m.effective_at <= now()
         AND m.expires_at > now()
         AND ${capability} = ANY(m.powers)
         AND (
           m.requires_acceptance = false
           OR EXISTS (
             SELECT 1
               FROM ue_authority_acceptances a
              WHERE a.organization_id = m.organization_id
                AND a.instrument_type = 'mandate'
                AND a.instrument_id = m.id
                AND a.accepted_by = m.principal_user_id
           )
         )
       LIMIT 1
    `),
  )
  return rows.length === 1
}

/**
 * The platform executive: an active `executive` membership in the platform organization, created once by the platform owner.
 * It is the owner's own standing authority over the platform, so it needs no per-action mandate and may be exercised while
 * acting from any organization. Every exercise is recorded (below); staff below the executive still need a scoped mandate.
 */
async function isPlatformExecutive(userId: string): Promise<boolean> {
  const rows = await withAuthContext({ phase: 'identity', userId }, () =>
    authDb
      .select({ role: authOrganizationUsers.role })
      .from(authOrganizationUsers)
      .where(
        and(
          eq(authOrganizationUsers.userId, userId),
          eq(authOrganizationUsers.organizationId, PLATFORM_ORGANIZATION_ID),
          eq(authOrganizationUsers.isActive, true),
          eq(authOrganizationUsers.role, 'executive'),
        ),
      )
      .limit(1),
  )
  return rows.length === 1
}

async function recordPlatformAuthority(
  actor: PlatformActor,
  capability: PlatformCapability,
  outcome: 'success' | 'failure',
  details: Record<string, string>,
) {
  await withRLSContext({ organizationId: actor.organizationId, userId: actor.userId }, (tx) =>
    persistAtomicAudit(
      tx,
      {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: `${capability}.${outcome === 'success' ? 'authorized' : 'denied'}`,
        resourceType: 'platform_authority',
        details,
      },
      outcome,
    ),
  )
}

export async function requirePlatformStaffAuthority(
  actor: { userId?: string | null; organizationId?: string | null },
  capability: PlatformCapability,
): Promise<PlatformActor> {
  const { userId, organizationId } = actor
  if (!userId || !organizationId) throw ApiError.forbidden('A platform-wide request needs an authenticated platform administrator acting in an organization')
  const eligible = await isPlatformAdminUser(userId)
  let reason = 'not_platform_staff_eligible'
  let executive = false
  if (eligible) {
    try {
      executive = await isPlatformExecutive(userId)
    } catch (error) {
      logger.error('platform_executive_unverifiable', { capability, error: error instanceof Error ? error.message : 'unknown' })
    }
  }
  if (executive) {
    // Authorized only once the exercise is on record: an unrecordable use is refused, so there is no unaudited platform action.
    try {
      await recordPlatformAuthority({ userId, organizationId }, capability, 'success', { basis: 'platform_executive' })
      return { userId, organizationId }
    } catch (error) {
      reason = 'platform_authority_not_recordable'
      logger.error('platform_authority_not_recordable', { capability, error: error instanceof Error ? error.message : 'unknown' })
    }
  } else if (eligible && !isPlatformOrganization(organizationId)) reason = 'not_acting_from_platform_organization'
  else if (eligible) {
    try {
      if (await hasLivePlatformMandate(userId, capability)) return { userId, organizationId }
      reason = 'no_live_scoped_platform_staff_mandate'
    } catch (error) {
      reason = 'platform_staff_mandate_unverifiable'
      logger.error('platform_staff_mandate_unverifiable', { capability, error: error instanceof Error ? error.message : 'unknown' })
    }
  }

  try {
    await recordPlatformAuthority({ userId, organizationId }, capability, 'failure', { reason })
  } catch (error) {
    // The refusal stands whether or not it could be recorded.
    logger.error('platform_authority_denial_not_recorded', { capability, error: error instanceof Error ? error.message : 'unknown' })
  }
  throw ApiError.forbidden('Acting across organizations needs platform-staff authority; a role title is not enough')
}
