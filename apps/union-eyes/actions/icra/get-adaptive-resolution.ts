import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { icraAssessments } from '@/db/schema/icra-schema'
import {
  resolveAdaptiveContext,
  type AdaptiveContextResolution,
  type RoutableQuestion,
} from '@/lib/icra/adaptation'
import { ALL_QUESTIONS, QUESTION_BANK_VERSION } from '@/lib/icra/questions'

/**
 * Load the assessment's organization_context jsonb and resolve the adaptive
 * context (persisted blob, reconstruct, reroute, or safe default).
 *
 * Pure pass-through to `resolveAdaptiveContext`; returns null if the
 * assessment row cannot be loaded.
 */
export async function getIcraAdaptiveResolution(
  assessmentId: string,
): Promise<AdaptiveContextResolution | null> {
  try {
    const rows = await db
      .select({ organizationContext: icraAssessments.organizationContext })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1)
    const row = rows[0]
    if (!row) return null

    return resolveAdaptiveContext({
      organizationContext: row.organizationContext,
      questionBank: ALL_QUESTIONS as any as RoutableQuestion[],
      currentQuestionBankVersion: QUESTION_BANK_VERSION,
    })
  } catch {
    return null
  }
}
