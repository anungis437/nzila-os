import { reviewHealthcareSurveyResponse } from '@/lib/services/healthcare-survey-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requireRole } from '@/lib/rbac'

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

  const result = await reviewHealthcareSurveyResponse(responseId, body, userId)
  return NextResponse.json(result.body, { status: result.status })
}
