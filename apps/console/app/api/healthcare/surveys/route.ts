import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'
import { db } from '@nzila/db/client'
import { healthcareSurveys } from '@nzila/db/schema'
import {
  HEALTHCARE_AUDIT_ACTIONS,
  UNIT_SCHEDULING_TEMPLATE,
  generateShareToken,
  assertDistributionMessageSafe,
} from '@nzila/healthcare-surveys'
import { recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'

export async function POST(request: Request) {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
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
    orgId?: string | null
  }

  if (!body.title || !body.localName || !body.unitName || !body.championLabel) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const distributionMessage = body.distributionMessage?.trim()
  if (distributionMessage) {
    assertDistributionMessageSafe(distributionMessage)
  }

  const shareToken = generateShareToken()

  const inserted = await db
    .insert(healthcareSurveys)
    .values({
      orgId: body.orgId ?? undefined,
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
    orgId: body.orgId,
    surveyId,
    localName: body.localName,
    unitName: body.unitName,
    championLabel: body.championLabel,
    summary: 'Created healthcare discovery survey.',
    metadata: { anonymous: true },
  })

  return NextResponse.json({ ok: true, surveyId })
}
