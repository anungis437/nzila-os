import { createHealthcareSurvey } from '@/lib/services/healthcare-survey-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'

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
    targetOrgId?: string | null
  }

  if (!body.title || !body.localName || !body.unitName || !body.championLabel) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const result = await createHealthcareSurvey(body, userId)
  return NextResponse.json(result.body, { status: result.status })
}
