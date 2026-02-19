/**
 * @nzila/ai-sdk — Streaming helpers
 *
 * Helpers for consuming SSE streams from the AI Control Plane.
 */
import type { StreamChunk } from './types'

/**
 * Consume a SSE response and yield parsed StreamChunk objects.
 * Works with the /api/ai/chat/stream endpoint.
 */
export async function* consumeStream(
  response: Response,
): AsyncIterable<StreamChunk> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') {
        return
      }

      try {
        const chunk = JSON.parse(data) as StreamChunk
        yield chunk
        if (chunk.done) return
      } catch {
        // skip malformed
      }
    }
  }
}

/**
 * Collect a full SSE stream into a single string.
 */
export async function collectStream(response: Response): Promise<string> {
  let result = ''
  for await (const chunk of consumeStream(response)) {
    result += chunk.delta
  }
  return result
}

/**
 * Create a ReadableStream from the SSE response suitable for
 * piping to a UI component (e.g., React streaming).
 */
export function toReadableStream(response: Response): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of consumeStream(response)) {
          if (chunk.delta) {
            controller.enqueue(chunk.delta)
          }
          if (chunk.done) {
            controller.close()
            return
          }
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}
