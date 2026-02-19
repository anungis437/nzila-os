/**
 * API — AI Chat (non-streaming)
 * POST /api/ai/chat
 *
 * Chat completion through the AI Control Plane.
 */
import { NextRequest, NextResponse } from 'next/server'
import { chat, AiGenerateRequestSchema, AiControlPlaneError } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'

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
    if (err instanceof AiControlPlaneError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      )
    }
    console.error('[AI Chat Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
