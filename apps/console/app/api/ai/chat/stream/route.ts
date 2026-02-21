// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Chat Stream (SSE)
 * POST /api/ai/chat/stream
 *
 * Streaming chat completion via Server-Sent Events.
 */
import { NextRequest } from 'next/server'
import { chatStream, AiChatStreamRequestSchema } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiChatStreamRequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { entityId } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // Create a ReadableStream that wraps the async generator
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatStream({
            ...parsed.data,
            input: parsed.data.input,
          })) {
            const data = JSON.stringify(chunk)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))

            if (chunk.done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }
          }
          controller.close()
        } catch (err) {
          const aiErr = asAiError(err)
          const errorData = aiErr
            ? { error: aiErr.message, code: aiErr.code }
            : { error: 'Stream error', code: 'unknown' }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`),
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return new Response(
        JSON.stringify({ error: aiErr.message, code: aiErr.code }),
        { status: aiErr.statusCode, headers: { 'Content-Type': 'application/json' } },
      )
    }
    console.error('[AI Chat Stream Error]', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'unknown' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
