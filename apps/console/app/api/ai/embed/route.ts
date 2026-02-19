/**
 * API — AI Embed
 * POST /api/ai/embed
 *
 * Generate embeddings through the AI Control Plane.
 */
import { NextRequest, NextResponse } from 'next/server'
import { embed, AiEmbedRequestSchema, AiControlPlaneError } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiEmbedRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    const result = await embed(parsed.data)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AiControlPlaneError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      )
    }
    console.error('[AI Embed Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
