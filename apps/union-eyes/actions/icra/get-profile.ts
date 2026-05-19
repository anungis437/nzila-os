import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { icraMaturityProfiles } from '@/db/schema/icra-schema'
import type { InstitutionalContinuityProfile } from '@/lib/icra/types'

export async function getIcraProfile(
  assessmentId: string,
): Promise<InstitutionalContinuityProfile | null> {
  try {
    const rows = await db
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .limit(1)

    const row = rows[0]
    if (!row) return null
    return row.profilePayload as InstitutionalContinuityProfile
  } catch {
    return null
  }
}
