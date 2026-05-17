// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { checkRateLimit } from '@nzila/os-core/rateLimit'
import { db } from '@/lib/db'
import { healthcareSurveys, healthcareSurveyResponses } from '@nzila/db/schema'
import {
  computeWorkflowScores,
  HEALTHCARE_AUDIT_ACTIONS,
  FREE_TEXT_WARNING,
  isValidShareToken,
} from '@nzila/healthcare-surveys'
import { recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = checkRateLimit(ip, { max: 20, windowMs: 60_000 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await (async () => {
    const BodySchema = z.object({
      token: z.string(),
      answers: z.record(z.unknown()),
    })
    return BodySchema.parse(await request.json())
  })()

  if (!body.token || !isValidShareToken(body.token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const surveyRows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.shareToken, body.token))
    .limit(1)

  const survey = surveyRows[0]
  if (!survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }

  if (survey.status !== 'active') {
    return NextResponse.json({ error: 'Survey is not accepting responses' }, { status: 400 })
  }

  const workflowScores = computeWorkflowScores(body.answers)
  const q13 = typeof body.answers.q13 === 'string' ? body.answers.q13 : null
  const concernTags = Array.isArray(body.answers.q15) ? body.answers.q15 : []
  const containsFreeText =
    typeof body.answers.q16 === 'string' || typeof body.answers.q17 === 'string'

  const inserted = await db
    .insert(healthcareSurveyResponses)
    .values({
      surveyId: survey.id,
      answers: body.answers,
      workflowScores,
      topPriority: q13,
      concernTags,
      containsFreeText,
      reviewStatus: containsFreeText ? 'unreviewed' : 'reviewed',
      redactionNote: containsFreeText ? FREE_TEXT_WARNING : null,
    })
    .returning({ id: healthcareSurveyResponses.id })

  await recordHealthcareAuditEvent({
    action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_RESPONSE_SUBMITTED,
    actorId: 'respondent:anonymous',
    orgId: survey.orgId ?? undefined,
    surveyId: survey.id,
    localName: survey.localName,
    unitName: survey.unitName,
    championLabel: survey.championLabel,
    summary: 'Anonymous survey response submitted.',
    metadata: {
      contains_free_text: containsFreeText,
      concern_count: concernTags.length,
    },
  })

  return NextResponse.json({ ok: true, responseId: inserted[0].id })
}
