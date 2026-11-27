import { exportHealthcareSurveySummary } from '@/lib/services/healthcare-survey-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { surveyId } = await params
  const result = await exportHealthcareSurveySummary(surveyId, userId)
  if (result.status === 404) return NextResponse.json(result.body, { status: 404 })
  return new NextResponse(result.summary, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="healthcare-survey-summary-${result.surveyId}.json"`,
    },
  })
}
