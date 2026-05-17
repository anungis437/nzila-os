import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'
import { db } from '@nzila/db/client'
import { healthcareSurveyResponses, healthcareSurveys } from '@nzila/db/schema'
import { HEALTHCARE_AUDIT_ACTIONS } from '@nzila/healthcare-surveys'
import { recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ responseId: string }> },
) {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { responseId } = await params
  const body = (await request.json()) as {
    reviewStatus: 'unreviewed' | 'reviewed' | 'flagged_for_redaction'
    redactionNote?: string
  }

  const updated = await db
    .update(healthcareSurveyResponses)
    .set({
      reviewStatus: body.reviewStatus,
      redactionNote: body.redactionNote ?? null,
    })
    .where(eq(healthcareSurveyResponses.id, responseId))
    .returning({ id: healthcareSurveyResponses.id, surveyId: healthcareSurveyResponses.surveyId })

  if (!updated[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const survey = await db
    .select({
      id: healthcareSurveys.id,
      orgId: healthcareSurveys.orgId,
      localName: healthcareSurveys.localName,
      unitName: healthcareSurveys.unitName,
      championLabel: healthcareSurveys.championLabel,
    })
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, updated[0].surveyId))
    .limit(1)

  if (survey[0] && body.reviewStatus === 'flagged_for_redaction') {
    await recordHealthcareAuditEvent({
      action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_FREE_TEXT_FLAGGED,
      actorId: userId,
      orgId: survey[0].orgId ?? undefined,
      surveyId: survey[0].id,
      localName: survey[0].localName,
      unitName: survey[0].unitName,
      championLabel: survey[0].championLabel,
      summary: 'Free-text response flagged for redaction.',
      metadata: { response_id: responseId },
    })
  }

  return NextResponse.json({ ok: true })
}
