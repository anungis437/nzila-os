import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { getOperatingEvidenceDashboard, ingestOperatingEvidenceEvent } from '@/server/operating-evidence-data'

const IngestSchema = z.object({
  app: z.string().min(1),
  domain: z.enum(['labour', 'legal', 'commerce', 'media-rights', 'platform']),
  type: z.enum(['request', 'error', 'override', 'policy_violation', 'decision_correction', 'admin_action']),
  policyVersion: z.string().optional(),
  latencyMs: z.number().optional(),
  statusCode: z.number().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  correctedByHuman: z.boolean().optional(),
  overrideReason: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const days = Number(request.nextUrl.searchParams.get('days') ?? 30)
    const data = await getOperatingEvidenceDashboard(Number.isFinite(days) ? Math.max(1, Math.min(days, 365)) : 30)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const payload = IngestSchema.parse(await request.json())
    const event = await ingestOperatingEvidenceEvent(payload)
    return NextResponse.json({ ok: true, data: event }, { status: 201 })
  } catch (error) {
    return handleAuthError(error)
  }
}
