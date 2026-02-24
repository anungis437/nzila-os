// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Embed
 * POST /api/ai/embed
 *
 * Generate embeddings through the AI Control Plane.
 */
import { NextRequest, NextResponse } from 'next/server'
import { embed, AiEmbedRequestSchema } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ai:embed')

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
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    logger.error('[AI Embed Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
