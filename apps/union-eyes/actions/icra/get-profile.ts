/**
 * ARTIFACT TYPE: Server action
 * DOCTRINE_VERSION: 1.0.0
 *
 * Reads the ICRA maturity profile for an assessment. ICRA tables are
 * SYSTEM_ONLY (tenant runtime privilege NONE) — this action MUST execute
 * through withSystemContext() and MUST require the caller's assessment
 * capability (see lib/icra/assessment-capability.ts). assessmentId alone is
 * never sufficient authorization (ASSESSMENT_ID_AS_SOLE_BEARER_AUTHORITY =
 * REJECTED). A prior version of this function queried via the ordinary
 * imported `db` keyed only by assessmentId — do not reintroduce that.
 */
import { eq } from 'drizzle-orm'
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { checkCapability, type CapabilityDenialReason } from '@/lib/icra/assessment-capability'
import type { OrganizationalContinuityProfile } from '@/lib/icra/types'

export type GetAuthorizedIcraProfileResult =
  | { ok: true; profile: OrganizationalContinuityProfile }
  | { ok: false; reason: CapabilityDenialReason | 'no_profile' }

/**
 * Requires the caller to present a currently valid capability for
 * `assessmentId` before returning the profile. `capabilityToken` should be
 * resolved server-side (cookie via next/headers' cookies(), or a bearer
 * value) by the caller — this function never trusts assessmentId alone.
 */
export async function getAuthorizedIcraProfile(
  assessmentId: string,
  capabilityToken: string | null,
): Promise<GetAuthorizedIcraProfileResult> {
  return withSystemContext(async (tx) => {
    const [assessment] = await tx
      .select({
        capabilityTokenHash: icraAssessments.capabilityTokenHash,
        capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1)

    const check = checkCapability(capabilityToken, assessment)
    if (!check.ok) return { ok: false, reason: check.reason }

    const rows = await tx
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .limit(1)

    const row = rows[0]
    if (!row) return { ok: false, reason: 'no_profile' }
    return { ok: true, profile: row.profilePayload as OrganizationalContinuityProfile }
  })
}

