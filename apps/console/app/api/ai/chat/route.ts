// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Chat (non-streaming)
 * POST /api/ai/chat
 *
 * Chat completion through the AI Control Plane.
 */
import { NextRequest, NextResponse } from 'next/server'
import { chat, AiGenerateRequestSchema, AiControlPlaneError } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiGenerateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    const result = await chat({
      ...parsed.data,
      input: parsed.data.input,
    })

    return NextResponse.json(result)
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    console.error('[AI Chat Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
