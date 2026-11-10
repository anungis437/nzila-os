/**
 * Platform-staff authority for reads and operations across organizations.
 *
 * A role title is not authority over other organizations. An organization's `platform_lead` or `system_admin` title says what someone may do
 * inside their own organization; reading every tenant's people or figures, or creating and resetting another organization, needs the
 * platform-staff eligibility (`isPlatformAdminUser`) AND a live, accepted, action-specific `platform_staff` mandate issued under the platform
 * pseudo-organization. Identity is only eligibility: it never supplies the mandate. Until the outstanding institutional adoption decision
 * creates a genuine issuance path, every such request therefore fails closed. A refusal is recorded under the caller's own organization so
 * the attempt is visible. There is no fallback to a role title, an allow-list entry, or a partial answer.
 */
import { ApiError } from '@/lib/api/framework'
import { UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client'
import { isPlatformAdminUser } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'
import { sql } from 'drizzle-orm'

export const PLATFORM_CAPABILITIES = [
  'platform.user_directory.read',
  'platform.member_activity.read',
  'platform.stats.read',
  'platform.pilot_fixture.manage',
  'platform.pilot.manage',
  'platform.organization_directory.read',
  'platform.database_health.read',
  'platform.database.maintain',
  'platform.feature_flags.manage',
  'platform.jobs.manage',
  'platform.email_suppressions.manage',
  'platform.user_directory.manage',
  'platform.document_backfill.manage',
  'platform.ai_cache.manage',
  'platform.organization.manage',
  'platform.icra_review.manage',
  'platform.queue.read',
  'platform.auth_diagnostics.run',
  'platform.marketing_content.publish',
  'platform.cba_dataset.curate',
] as const
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number]

export interface PlatformActor {
  userId: string
  organizationId: string
}

async function hasLivePlatformMandate(userId: string, capability: PlatformCapability): Promise<boolean> {
  // This is a direct, named scope: the platform pseudo-organization that owns
  // platform-staff mandates. The system role intentionally has no broad read
  // grant on tenant authority instruments.
  const rows = await withRLSContext({ organizationId: UE_SYSTEM_ORG_ID, userId }, (tx) =>
    tx.execute<{ id: string }>(sql`
      SELECT m.id::text AS id
        FROM ue_authority_mandates m
       WHERE m.organization_id = ${UE_SYSTEM_ORG_ID}::uuid
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

export async function requirePlatformStaffAuthority(
  actor: { userId?: string | null; organizationId?: string | null },
  capability: PlatformCapability,
): Promise<PlatformActor> {
  const { userId, organizationId } = actor
  if (!userId || !organizationId) throw ApiError.forbidden('A platform-wide request needs an authenticated platform administrator acting in an organization')
  const eligible = await isPlatformAdminUser(userId)
  const mandated = eligible ? await hasLivePlatformMandate(userId, capability) : false
  if (eligible && mandated) return { userId, organizationId }

  try {
    await withRLSContext({ organizationId, userId }, (tx) =>
      persistAtomicAudit(
        tx,
        {
          organizationId,
          userId,
          action: `${capability}.denied`,
          resourceType: 'platform_authority',
          details: { reason: eligible ? 'no_live_scoped_platform_staff_mandate' : 'not_platform_staff_eligible' },
        },
        'failure',
      ),
    )
  } catch (error) {
    // The refusal stands whether or not it could be recorded.
    logger.error('platform_authority_denial_not_recorded', { capability, error: error instanceof Error ? error.message : 'unknown' })
  }
  throw ApiError.forbidden('Acting across organizations needs platform-staff authority; a role title is not enough')
}
