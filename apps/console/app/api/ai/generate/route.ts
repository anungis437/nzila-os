/**
 * API — AI Generate
 * POST /api/ai/generate
 *
 * Non-streaming text generation through the AI Control Plane.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generate, AiGenerateRequestSchema, AiControlPlaneError } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiGenerateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId } = parsed.data

    // Auth: verify entity membership
    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    const result = await generate({
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
    console.error('[AI Generate Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
