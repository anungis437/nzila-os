import { db } from '@/lib/db'
import { healthcareSurveys, healthcareSurveyResponses } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import {
  HEALTHCARE_AUDIT_ACTIONS,
  UNIT_SCHEDULING_TEMPLATE,
  generateShareToken,
  assertDistributionMessageSafe,
  computeWorkflowScores,
  FREE_TEXT_WARNING,
} from '@nzila/healthcare-surveys'
import { recordHealthcareAuditEvent, buildSurveyResultArtifacts } from '@/lib/healthcare-discovery'
export interface CreateHealthcareSurveyInput {
  title: string
  localName: string
  unitName: string
  siteName?: string
  championLabel: string
  purposeStatement: string
  audience?: string
  closeDate?: string
  campaignName?: string
  internalNotes?: string
  distributionMessage?: string
  targetOrgId?: string | null
}
export interface ReviewHealthcareResponseInput {
  reviewStatus: 'unreviewed' | 'reviewed' | 'flagged_for_redaction'
  redactionNote?: string
}

export async function createHealthcareSurvey(body: CreateHealthcareSurveyInput, userId: string) {
  const distributionMessage = body.distributionMessage?.trim()
  if (distributionMessage) {
    assertDistributionMessageSafe(distributionMessage)
  }
  const shareToken = generateShareToken()
  const inserted = await db
    .insert(healthcareSurveys)
    .values({
      orgId: body.targetOrgId ?? undefined,
      campaignName: body.campaignName ?? null,
      unitName: body.unitName,
      siteName: body.siteName ?? null,
      localName: body.localName,
      championLabel: body.championLabel,
      title: body.title,
      description: body.purposeStatement,
      audience: body.audience ?? null,
      status: 'draft',
      anonymous: true,
      allowFreeText: true,
      purposeStatement: body.purposeStatement,
      privacyNotice:
        'This discovery survey is for workflow discovery only. Do not include patient information, employee names, manager names, grievance details, or identifying details.',
      internalNotes: body.internalNotes ?? null,
      distributionMessage: distributionMessage ?? null,
      questions: UNIT_SCHEDULING_TEMPLATE.questions,
      templateKey: UNIT_SCHEDULING_TEMPLATE.key,
      shareToken,
      closeDate: body.closeDate ? new Date(body.closeDate) : null,
      createdBy: userId,
    })
    .returning({ id: healthcareSurveys.id })
  const surveyId = inserted[0].id
  await recordHealthcareAuditEvent({
    action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_CREATED,
    actorId: userId,
    orgId: body.targetOrgId,
    surveyId,
    localName: body.localName,
    unitName: body.unitName,
    championLabel: body.championLabel,
    summary: 'Created healthcare discovery survey.',
    metadata: { anonymous: true },
  })
  return {
    status: 200,
    body: { ok: true, surveyId },
  }
}

export async function submitHealthcareSurveyResponse(body: {
  token: string
  answers: Record<string, unknown>
}) {
  const surveyRows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.shareToken, body.token))
    .limit(1)
  const survey = surveyRows[0]
  if (!survey) {
    return {
      status: 404,
      body: { error: 'Survey not found' },
    }
  }
  if (survey.status !== 'active') {
    return {
      status: 400,
      body: { error: 'Survey is not accepting responses' },
    }
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
  return {
    status: 200,
    body: { ok: true, responseId: inserted[0].id },
  }
}

export async function reviewHealthcareSurveyResponse(
  responseId: string,
  body: ReviewHealthcareResponseInput,
  userId: string,
) {
  const updated = await db
    .update(healthcareSurveyResponses)
    .set({
      reviewStatus: body.reviewStatus,
      redactionNote: body.redactionNote ?? null,
    })
    .where(eq(healthcareSurveyResponses.id, responseId))
    .returning({ id: healthcareSurveyResponses.id, surveyId: healthcareSurveyResponses.surveyId })
  if (!updated[0])
    return {
      status: 404,
      body: { error: 'Not found' },
    }
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
  return {
    status: 200,
    body: { ok: true },
  }
}

export async function changeHealthcareSurveyStatus(
  surveyId: string,
  body: { status: 'draft' | 'active' | 'closed' | 'archived' },
  userId: string,
) {
  const rows = await db
    .update(healthcareSurveys)
    .set({
      status: body.status,
      launchDate: body.status === 'active' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(healthcareSurveys.id, surveyId))
    .returning({
      id: healthcareSurveys.id,
      orgId: healthcareSurveys.orgId,
      localName: healthcareSurveys.localName,
      unitName: healthcareSurveys.unitName,
      championLabel: healthcareSurveys.championLabel,
    })
  const updated = rows[0]
  if (!updated) {
    return {
      status: 404,
      body: { error: 'Survey not found.' },
    }
  }
  const action =
    body.status === 'active'
      ? HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_LAUNCHED
      : body.status === 'closed'
        ? HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_CLOSED
        : HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_CREATED
  await recordHealthcareAuditEvent({
    action,
    actorId: userId,
    surveyId: updated.id,
    orgId: updated.orgId ?? undefined,
    localName: updated.localName,
    unitName: updated.unitName,
    championLabel: updated.championLabel,
    summary: `Survey status changed to ${body.status}.`,
    metadata: { status: body.status },
  })
  return {
    status: 200,
    body: { ok: true },
  }
}

export async function readHealthcareSurvey(surveyId: string) {
  const rows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, surveyId))
    .limit(1)
  const survey = rows[0]
  if (!survey)
    return {
      status: 404,
      body: { error: 'Not found' },
    }
  return {
    status: 200,
    body: { survey },
  }
}

export async function exportHealthcareSurveySummary(surveyId: string, userId: string) {
  const surveyRows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, surveyId))
    .limit(1)

  const survey = surveyRows[0]
  if (!survey) return { status: 404 as const, body: { error: 'Not found' } }

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

  return { status: 200 as const, surveyId: survey.id, summary: artifacts.summary }
}
