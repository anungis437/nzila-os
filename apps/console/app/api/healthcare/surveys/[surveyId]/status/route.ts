// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'
import { db } from '@/lib/db'
import { healthcareSurveys } from '@nzila/db/schema'
import { HEALTHCARE_AUDIT_ACTIONS } from '@nzila/healthcare-surveys'
import { recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { surveyId } = await params
  const body = (await request.json()) as { status: 'draft' | 'active' | 'closed' | 'archived' }

  if (!body.status) {
    return NextResponse.json({ error: 'Missing status.' }, { status: 400 })
  }

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
    return NextResponse.json({ error: 'Survey not found.' }, { status: 404 })
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

  return NextResponse.json({ ok: true })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  const { surveyId } = await params
  const rows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, surveyId))
    .limit(1)

  const survey = rows[0]
  if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ survey })
}
