import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import {
  icraAssessments,
  icraAssessmentAnswers,
  icraMaturityProfiles,
  icraContinuityScores,
  icraGovernanceFlags,
  icraFollowupRecommendations,
} from '@/db/schema/icra-schema'
import { logger } from '@/lib/logger'
import { computeProfile } from '@/lib/icra/scoring'
import type { Answer } from '@/lib/icra/types'
import { withSystemContext } from '@/lib/db/with-rls-context'
import {
  extractCapabilityToken,
  checkCapability,
  capabilityDenialStatus,
} from '@/lib/icra/assessment-capability'

interface RouteContext {
  params: Promise<{ assessmentId: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const { assessmentId } = await params
  try {
    return await withSystemContext(async (tx) => {
      const assessments = await tx
        .select()
        .from(icraAssessments)
        .where(eq(icraAssessments.id, assessmentId))
        .limit(1)
      const assessment = assessments[0]
      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
      }

      const presented = extractCapabilityToken(request, assessmentId)
      const capCheck = checkCapability(presented, assessment)
      if (!capCheck.ok) {
        return NextResponse.json(
          { error: 'Not authorized to submit this assessment' },
          { status: capabilityDenialStatus(capCheck.reason) },
        )
      }

      // Idempotent state transition: an assessment that has already left
      // in_progress must never have its profile/scores/flags/recommendations
      // deleted and rebuilt by a repeat submit from an old capability holder.
      if (assessment.status !== 'in_progress') {
        const [existingProfile] = await tx
          .select({ profilePayload: icraMaturityProfiles.profilePayload })
          .from(icraMaturityProfiles)
          .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
          .orderBy(icraMaturityProfiles.generatedAt)
          .limit(1)
        if (existingProfile) {
          return NextResponse.json({ profile: existingProfile.profilePayload })
        }
        return NextResponse.json({ error: 'Assessment already submitted' }, { status: 409 })
      }

      const answerRows = await tx
        .select()
        .from(icraAssessmentAnswers)
        .where(eq(icraAssessmentAnswers.assessmentId, assessmentId))

      if (answerRows.length === 0) {
        return NextResponse.json(
          { error: 'No answers recorded; cannot generate continuity profile.' },
          { status: 400 },
        )
      }

      const answers: Answer[] = answerRows.map((row) => ({
        questionId: row.questionId,
        questionVersion: row.questionVersion,
        rawValue: row.rawValue,
        normalizedScore: Number(row.normalizedScore),
        weightsSnapshot: (row.weightsSnapshot ?? {}) as Answer['weightsSnapshot'],
        riskInverted: row.riskInverted,
        note: row.note ?? undefined,
        answeredAt: row.answeredAt.toISOString(),
      }))

      const profile = computeProfile({ assessmentId, answers })

      await tx
        .delete(icraMaturityProfiles)
        .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      await tx
        .delete(icraContinuityScores)
        .where(eq(icraContinuityScores.assessmentId, assessmentId))
      await tx.delete(icraGovernanceFlags).where(eq(icraGovernanceFlags.assessmentId, assessmentId))
      await tx
        .delete(icraFollowupRecommendations)
        .where(eq(icraFollowupRecommendations.assessmentId, assessmentId))

      await tx.insert(icraMaturityProfiles).values({
        assessmentId,
        maturityBandId: profile.maturityBand.id,
        composite: profile.composite.toFixed(2),
        profilePayload: profile,
      })

      if (profile.dimensions.length > 0) {
        await tx.insert(icraContinuityScores).values(
          profile.dimensions.map((d) => ({
            assessmentId,
            dimensionId: d.dimension,
            score: d.score.toFixed(2),
            contributingQuestions: d.contributingQuestions,
            weightTotal: d.weightTotal.toFixed(3),
          })),
        )
      }

      if (profile.observations.length > 0) {
        await tx.insert(icraGovernanceFlags).values(
          profile.observations.map((o) => ({
            assessmentId,
            flagId: o.id,
            severity: o.severity,
            category: o.category,
            statement: o.statement,
            evidence: o.evidence ?? null,
          })),
        )
      }

      if (profile.recommendations.length > 0) {
        await tx.insert(icraFollowupRecommendations).values(
          profile.recommendations.map((r) => ({
            assessmentId,
            recommendationId: r.id,
            kind: r.kind,
            title: r.title,
            description: r.description,
            ctaLabel: r.ctaLabel,
            ctaHref: r.ctaHref,
          })),
        )
      }

      await tx
        .update(icraAssessments)
        .set({ status: 'submitted', submittedAt: new Date() })
        .where(eq(icraAssessments.id, assessmentId))

      logger.info('icra.assessment.submitted', {
        assessmentId,
        maturityBand: profile.maturityBand.id,
        composite: profile.composite,
        answeredQuestionCount: profile.answeredQuestionCount,
      })

      return NextResponse.json({ profile })
    })
  } catch (err) {
    logger.error('icra.assessment.submit_failed', {
      assessmentId,
      error: (err as Error).message,
    })
    return NextResponse.json({ error: 'Failed to submit assessment' }, { status: 500 })
  }
}
