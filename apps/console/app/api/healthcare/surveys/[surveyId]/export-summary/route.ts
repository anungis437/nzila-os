import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'
import { db } from '@nzila/db/client'
import { healthcareSurveys, healthcareSurveyResponses } from '@nzila/db/schema'
import { HEALTHCARE_AUDIT_ACTIONS } from '@nzila/healthcare-surveys'
import { buildSurveyResultArtifacts, recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { surveyId } = await params
  const surveyRows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, surveyId))
    .limit(1)

  const survey = surveyRows[0]
  if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const responseRows = await db
    .select()
    .from(healthcareSurveyResponses)
    .where(eq(healthcareSurveyResponses.surveyId, surveyId))

  const artifacts = buildSurveyResultArtifacts({
    surveyId: survey.id,
    title: survey.title,
    localName: survey.localName,
    unitName: survey.unitName,
    championLabel: survey.championLabel,
    responses: responseRows.map((r) => ({
      id: r.id,
      surveyId: r.surveyId,
      anonymousResponseId: r.anonymousResponseId,
      submittedAt: r.submittedAt.toISOString(),
      answers: (r.answers as Record<string, unknown>) ?? {},
      workflowScores: (r.workflowScores as Record<string, number>) ?? {},
      topPriority: r.topPriority,
      concernTags: (r.concernTags as string[]) ?? [],
      containsFreeText: r.containsFreeText,
      reviewStatus: r.reviewStatus,
      redactionNote: r.redactionNote,
      createdAt: r.createdAt.toISOString(),
    })),
  })

  await recordHealthcareAuditEvent({
    action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_SUMMARY_EXPORTED,
    actorId: userId,
    surveyId: survey.id,
    orgId: survey.orgId ?? undefined,
    localName: survey.localName,
    unitName: survey.unitName,
    championLabel: survey.championLabel,
    summary: 'Exported healthcare survey executive summary.',
  })

  return new NextResponse(artifacts.summary, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="healthcare-survey-summary-${survey.id}.json"`,
    },
  })
}
