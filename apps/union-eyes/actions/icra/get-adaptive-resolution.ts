/**
 * Load the assessment's organization_context jsonb and resolve the adaptive
 * context (persisted blob, reconstruct, reroute, or safe default).
 *
 * ICRA tables are SYSTEM_ONLY (tenant runtime privilege NONE) and
 * assessmentId alone is never sufficient authorization
 * (ASSESSMENT_ID_AS_SOLE_BEARER_AUTHORITY = REJECTED) — requires the
 * caller's assessment capability, resolved via withSystemContext.
 */
import { eq } from 'drizzle-orm'
import { icraAssessments } from '@/db/schema/icra-schema'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { checkCapability, type CapabilityDenialReason } from '@/lib/icra/assessment-capability'
import {
  resolveAdaptiveContext,
  type AdaptiveContextResolution,
  type RoutableQuestion,
} from '@/lib/icra/adaptation'
import { ALL_QUESTIONS, QUESTION_BANK_VERSION } from '@/lib/icra/questions'

export type GetIcraAdaptiveResolutionResult =
  | { ok: true; resolution: AdaptiveContextResolution }
  | { ok: false; reason: CapabilityDenialReason }

export async function getIcraAdaptiveResolution(
  assessmentId: string,
  capabilityToken: string | null,
): Promise<GetIcraAdaptiveResolutionResult> {
  return withSystemContext(async (tx) => {
    const [row] = await tx
      .select({
        organizationContext: icraAssessments.organizationContext,
        capabilityTokenHash: icraAssessments.capabilityTokenHash,
        capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1)

    const check = checkCapability(capabilityToken, row)
    if (!check.ok) return { ok: false, reason: check.reason }

    const resolution = resolveAdaptiveContext({
      organizationContext: row!.organizationContext,
      questionBank: ALL_QUESTIONS as any as RoutableQuestion[],
      currentQuestionBankVersion: QUESTION_BANK_VERSION,
    })
    return { ok: true, resolution }
  })
}
