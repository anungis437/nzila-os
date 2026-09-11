import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { icraAssessments, icraAssessmentAnswers } from '@/db/schema/icra-schema'
import { logger } from '@/lib/logger'
import { questionById, QUESTION_BANK_VERSION } from '@/lib/icra/questions'
import { buildAnswer } from '@/lib/icra/scoring'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { rateLimit } from '@/lib/rate-limit'
import {
  extractCapabilityToken,
  checkCapability,
  capabilityDenialStatus,
} from '@/lib/icra/assessment-capability'

const answerSchema = z.object({
  questionId: z.string().min(1).max(64),
  rawValue: z.union([z.string(), z.number()]),
  note: z.string().max(2000).optional(),
})

interface RouteContext {
  params: Promise<{ assessmentId: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const { assessmentId } = await params

  // Up to ~64 answers per assessment plus retries/edits — bounded per
  // assessment+IP so one capability holder can't be used to hammer the DB.
  const rl = rateLimit(request, {
    maxRequests: 240,
    windowSeconds: 60 * 60,
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      return `icra-answer:${assessmentId}:${ip}`
    },
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many answer submissions. Please slow down.' }, { status: 429 })
  }

  let payload: z.infer<typeof answerSchema>
  try {
    payload = answerSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid answer payload', details: (err as Error).message },
      { status: 400 },
    )
  }

  const question = questionById(payload.questionId)
  if (!question) {
    return NextResponse.json({ error: 'Unknown question' }, { status: 400 })
  }

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
          { error: 'Not authorized to modify this assessment' },
          { status: capabilityDenialStatus(capCheck.reason) },
        )
      }

      if (assessment.status !== 'in_progress') {
        return NextResponse.json({ error: 'Assessment is not accepting answers' }, { status: 409 })
      }

      const answer = buildAnswer(question, payload.rawValue, payload.note)

      await tx
        .delete(icraAssessmentAnswers)
        .where(
          and(
            eq(icraAssessmentAnswers.assessmentId, assessmentId),
            eq(icraAssessmentAnswers.questionId, question.id),
          ),
        )

      await tx.insert(icraAssessmentAnswers).values({
        assessmentId,
        questionId: answer.questionId,
        questionVersion: QUESTION_BANK_VERSION,
        rawValue: String(answer.rawValue),
        normalizedScore: answer.normalizedScore.toFixed(4),
        weightsSnapshot: answer.weightsSnapshot,
        riskInverted: answer.riskInverted,
        note: answer.note,
      })

      logger.debug('icra.answer.recorded', {
        assessmentId,
        questionId: question.id,
        normalizedScore: answer.normalizedScore,
      })

      return NextResponse.json({ ok: true, answer })
    })
  } catch (err) {
    logger.error('icra.answer.failed', {
      assessmentId,
      questionId: payload.questionId,
      error: (err as Error).message,
    })
    return NextResponse.json({ error: 'Failed to record answer' }, { status: 500 })
  }
}
