import { submitHealthcareSurveyResponse } from '@/lib/services/healthcare-survey-service'
import { isValidShareToken } from '@nzila/healthcare-surveys'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

import { z } from 'zod'
import { checkRateLimit } from '@nzila/os-core/rateLimit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = checkRateLimit(ip, { max: 20, windowMs: 60_000 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await (async () => {
    const BodySchema = z.object({
      token: z.string(),
      answers: z.record(z.string(), z.unknown()),
    })
    return BodySchema.parse(await request.json())
  })()

  if (!body.token || !isValidShareToken(body.token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const result = await submitHealthcareSurveyResponse(body)
  return NextResponse.json(result.body, { status: result.status })
}
