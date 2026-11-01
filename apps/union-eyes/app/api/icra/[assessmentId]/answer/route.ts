import { NextResponse } from 'next/server'
import { isAssessmentId } from '@/lib/icra/assessment-id'
import { clientAddress } from '@/lib/public-intake/guard';
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { icraAssessments, icraAssessmentAnswers } from '@/db/schema/icra-schema'
import { logger } from '@/lib/logger'
import { questionById, QUESTION_BANK_VERSION } from '@/lib/icra/questions'
import { buildAnswer } from '@/lib/icra/scoring'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { hasRecordedConsent } from '@/lib/icra/consent'
import { checkRateLimit } from '@/lib/rate-limiter'
import {
  capabilityDenialStatus,
} from '@/lib/icra/assessment-capability'
import { authorizeAssessmentAccess } from '@/lib/icra/assessment-access'

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
  if (!isAssessmentId(assessmentId)) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

  // Up to ~64 answers per assessment plus retries/edits — bounded per
  // assessment+IP so one capability holder can't be used to hammer the DB.
  const rl = await checkRateLimit(`icra-answer:${assessmentId}:${clientAddress(request)}`, {
    limit: 240,
    window: 60 * 60,
    identifier: 'icra-answer',
    failOpen: process.env.NODE_ENV !== 'production',
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.error ? 'Answers are temporarily unavailable.' : 'Too many answer submissions. Please slow down.' },
      { status: rl.error ? 503 : 429 },
    )
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

  // A value that does not fit the question, or a note the deployment mode forbids, is the caller's error, not a server failure.
  let answer: ReturnType<typeof buildAnswer>
  try {
    answer = buildAnswer(question, payload.rawValue, payload.note)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid answer value', details: (err as Error).message }, { status: 400 })
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

      const capCheck = await authorizeAssessmentAccess(request, assessmentId, assessment)
      if (!capCheck.ok) {
        return NextResponse.json(
          { error: 'Not authorized to modify this assessment' },
          { status: capabilityDenialStatus(capCheck.reason) },
        )
      }

      if (assessment.status !== 'in_progress') {
        return NextResponse.json({ error: 'Assessment is not accepting answers' }, { status: 409 })
      }
      if (!hasRecordedConsent(assessment.consent)) {
        return NextResponse.json({ error: 'Consent has not been recorded for this assessment' }, { status: 409 })
      }

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
