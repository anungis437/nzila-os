// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { seedUnit92CampaignIfMissing, recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'
import { HEALTHCARE_AUDIT_ACTIONS, UNIT_92_CAMPAIGN_SEED } from '@nzila/healthcare-surveys'
import { auth } from '@nzila/platform-auth/entra/server'

export async function POST() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const surveyId = await seedUnit92CampaignIfMissing(userId)

  await recordHealthcareAuditEvent({
    action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_CAMPAIGN_SEEDED,
    actorId: userId,
    surveyId,
    localName: UNIT_92_CAMPAIGN_SEED.localName,
    unitName: UNIT_92_CAMPAIGN_SEED.unitName,
    championLabel: UNIT_92_CAMPAIGN_SEED.championLabel,
    summary: 'Seeded Unit 92 campaign if missing.',
  })

  return NextResponse.json({ ok: true, surveyId })
}
