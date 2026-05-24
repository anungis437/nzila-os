import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { icraMaturityProfiles } from '@/db/schema/icra-schema'
import type { OrganizationalContinuityProfile } from '@/lib/icra/types'

export async function getIcraProfile(
  assessmentId: string,
): Promise<OrganizationalContinuityProfile | null> {
  try {
    const rows = await db
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .limit(1)

    const row = rows[0]
    if (!row) return null
    return row.profilePayload as OrganizationalContinuityProfile
  } catch {
    return null
  }
}
