import { db } from '@nzila/db/client'
import {
  auditLog,
  healthcareSurveys,
  healthcareSurveyTemplates,
} from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  UNIT_92_CAMPAIGN_KEY,
  UNIT_92_CAMPAIGN_SEED,
  UNIT_SCHEDULING_TEMPLATE,
  type HealthcareSurveyResponse,
  generateInsights,
  recommendPilotWedge,
  buildExecutiveSummary,
} from '@nzila/healthcare-surveys'

export async function recordHealthcareAuditEvent(input: {
  action: string
  actorId: string
  surveyId?: string
  orgId?: string | null
  localName?: string
  unitName?: string
  championLabel?: string
  summary: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.insert(auditLog).values({
    action: input.action,
    actorId: input.actorId,
    entityType: 'healthcare_survey',
    orgId: input.orgId ?? undefined,
    metadata: {
      survey_id: input.surveyId ?? null,
      local: input.localName ?? null,
      unit: input.unitName ?? null,
      champion_label: input.championLabel ?? null,
      summary: input.summary,
      ...(input.metadata ?? {}),
    },
  })
}

export async function seedUnit92CampaignIfMissing(createdBy: string): Promise<string> {
  const existing = await db
    .select({ id: healthcareSurveys.id })
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.campaignKey, UNIT_92_CAMPAIGN_KEY))
    .limit(1)

  if (existing[0]) {
    return existing[0].id
  }

  await db
    .insert(healthcareSurveyTemplates)
    .values({
      templateKey: UNIT_SCHEDULING_TEMPLATE.key,
      title: UNIT_SCHEDULING_TEMPLATE.title,
      description: UNIT_SCHEDULING_TEMPLATE.description,
      intendedUse: UNIT_SCHEDULING_TEMPLATE.intendedUse,
      estimatedMinutes: UNIT_SCHEDULING_TEMPLATE.estimatedMinutes,
      category: UNIT_SCHEDULING_TEMPLATE.category,
      introText: UNIT_92_CAMPAIGN_SEED.introText,
      questions: UNIT_SCHEDULING_TEMPLATE.questions,
    })
    .onConflictDoNothing({ target: healthcareSurveyTemplates.templateKey })

  const inserted = await db
    .insert(healthcareSurveys)
    .values({
      campaignKey: UNIT_92_CAMPAIGN_KEY,
      campaignName: UNIT_92_CAMPAIGN_SEED.internalCampaignName,
      unitName: UNIT_92_CAMPAIGN_SEED.unitName,
      siteName: 'Foothills Medical Centre / FMC',
      localName: UNIT_92_CAMPAIGN_SEED.localName,
      championLabel: UNIT_92_CAMPAIGN_SEED.championLabel,
      title: UNIT_92_CAMPAIGN_SEED.title,
      description: UNIT_92_CAMPAIGN_SEED.purposeStatement,
      audience: UNIT_92_CAMPAIGN_SEED.audience,
      status: 'draft',
      anonymous: true,
      allowFreeText: true,
      purposeStatement: UNIT_92_CAMPAIGN_SEED.purposeStatement,
      privacyNotice: UNIT_92_CAMPAIGN_SEED.privacyNotice,
      internalNotes: UNIT_92_CAMPAIGN_SEED.internalNotes,
      distributionMessage: UNIT_92_CAMPAIGN_SEED.distributionMessage,
      questions: UNIT_92_CAMPAIGN_SEED.template.questions,
      templateKey: UNIT_92_CAMPAIGN_SEED.template.key,
      createdBy,
    })
    .returning({ id: healthcareSurveys.id })

  return inserted[0].id
}

export async function getSurveyByShareToken(token: string) {
  const rows = await db
    .select()
    .from(healthcareSurveys)
    .where(and(eq(healthcareSurveys.shareToken, token), eq(healthcareSurveys.status, 'active')))
    .limit(1)

  return rows[0] ?? null
}

export function buildSurveyResultArtifacts(input: {
  surveyId: string
  title: string
  localName: string
  unitName: string
  championLabel: string
  responses: HealthcareSurveyResponse[]
}) {
  const recommendation = recommendPilotWedge(
    input.surveyId,
    input.responses.map((r) => ({ surveyId: input.surveyId, answers: r.answers, workflowScores: r.workflowScores })),
    {
      localName: input.localName,
      unitName: input.unitName,
      championLabel: input.championLabel,
    },
  )

  const insights = generateInsights({
    surveyId: input.surveyId,
    responses: input.responses,
    recommendationTitle: recommendation.title,
  })

  const summary = buildExecutiveSummary({
    surveyTitle: input.title,
    responseCount: input.responses.length,
    recommendationTitle: recommendation.title,
    freeTextResponses: input.responses.map((r) => ({
      id: r.id,
      reviewStatus: r.reviewStatus,
      answers: r.answers,
    })),
  })

  return { recommendation, insights, summary }
}
