import {
  changeHealthcareSurveyStatus,
  readHealthcareSurvey,
} from '@/lib/services/healthcare-survey-service'
import { requirePlatformRole } from '@/lib/api-guards'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'

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

  const result = await changeHealthcareSurveyStatus(surveyId, body, userId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  const access = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!access.ok) return access.response
  const { surveyId } = await params
  const result = await readHealthcareSurvey(surveyId)
  return NextResponse.json(result.body, { status: result.status })
}
