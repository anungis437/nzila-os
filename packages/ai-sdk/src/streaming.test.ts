import { describe, it, expect, vi } from 'vitest'
import { consumeStream, collectStream, toReadableStream } from './streaming'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c))
      }
      controller.close()
    },
  })
  return { body: stream } as unknown as Response
}

function noBodyResponse(): Response {
  return { body: null } as unknown as Response
}

// Helper to collect async iterable
async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iter) {
    items.push(item)
  }
  return items
}

// ── consumeStream ───────────────────────────────────────────────────────────

describe('consumeStream', () => {
  it('throws when response has no body', async () => {
    const iter = consumeStream(noBodyResponse())
    await expect(collect(iter)).rejects.toThrow('No response body')
  })

  it('yields parsed chunks from SSE data lines', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"Hello","done":false}\n\n',
      'data: {"delta":" world","done":false}\n\n',
    ])
    const chunks = await collect(consumeStream(res))
    expect(chunks).toEqual([
      { delta: 'Hello', done: false },
      { delta: ' world', done: false },
    ])
  })

  it('stops at [DONE] sentinel', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"a","done":false}\n\n',
      'data: [DONE]\n\n',
      'data: {"delta":"b","done":false}\n\n', // should not appear
    ])
    const chunks = await collect(consumeStream(res))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.delta).toBe('a')
  })

  it('stops when chunk.done is true', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"first","done":false}\n\n',
      'data: {"delta":"last","done":true}\n\n',
      'data: {"delta":"ghost","done":false}\n\n', // should not appear
    ])
    const chunks = await collect(consumeStream(res))
    expect(chunks).toHaveLength(2)
    expect(chunks[1]!.delta).toBe('last')
    expect(chunks[1]!.done).toBe(true)
  })

  it('skips empty lines and non-data lines', async () => {
    const res = makeSSEResponse([
      '\n',
      ': this is a comment\n',
      'event: ping\n',
      'data: {"delta":"ok","done":false}\n',
      '\n',
    ])
    const chunks = await collect(consumeStream(res))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.delta).toBe('ok')
  })

  it('skips malformed JSON data lines', async () => {
    const res = makeSSEResponse([
      'data: not-json\n\n',
      'data: {"delta":"valid","done":false}\n\n',
    ])
    const chunks = await collect(consumeStream(res))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.delta).toBe('valid')
  })

  it('handles buffer accumulation across partial reads', async () => {
    // Simulate a chunk split across two reads
    const encoder = new TextEncoder()
    let pushCount = 0
    const parts = [
      'data: {"delt',          // partial line
      'a":"split","done":false}\n\n', // completes the line
    ]
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pushCount < parts.length) {
          controller.enqueue(encoder.encode(parts[pushCount]!))
          pushCount++
        } else {
          controller.close()
        }
      },
    })
    const res = { body: stream } as unknown as Response
    const chunks = await collect(consumeStream(res))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.delta).toBe('split')
  })

  it('handles reader completing with done=true (empty stream)', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
    const res = { body: stream } as unknown as Response
    const chunks = await collect(consumeStream(res))
    expect(chunks).toHaveLength(0)
  })

  it('handles lines.pop() returning undefined (buffer reset)', async () => {
    // Single line with no trailing newline — stays in buffer
    const res = makeSSEResponse(['data: {"delta":"buf","done":true}'])
    // The data stays in buffer since there's no trailing newline to split on.
    // Once reader is done, loop exits with buffer still holding unparsed data.
    const chunks = await collect(consumeStream(res))
    // No newline means the line never gets processed
    expect(chunks).toHaveLength(0)
  })
})

// ── collectStream ───────────────────────────────────────────────────────────

describe('collectStream', () => {
  it('collects all deltas into a single string', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"Hello","done":false}\n\n',
      'data: {"delta":" world","done":false}\n\n',
      'data: {"delta":"!","done":true}\n\n',
    ])
    const result = await collectStream(res)
    expect(result).toBe('Hello world!')
  })

  it('returns empty string for empty stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
    const res = { body: stream } as unknown as Response
    const result = await collectStream(res)
    expect(result).toBe('')
  })

  it('stops collecting at [DONE]', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"partial","done":false}\n\n',
      'data: [DONE]\n\n',
    ])
    const result = await collectStream(res)
    expect(result).toBe('partial')
  })
})

// ── toReadableStream ────────────────────────────────────────────────────────

describe('toReadableStream', () => {
  it('enqueues delta strings into a ReadableStream', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"A","done":false}\n\n',
      'data: {"delta":"B","done":false}\n\n',
    ])
    const readable = toReadableStream(res)
    const reader = readable.getReader()
    const r1 = await reader.read()
    expect(r1.value).toBe('A')
    const r2 = await reader.read()
    expect(r2.value).toBe('B')
    const r3 = await reader.read()
    expect(r3.done).toBe(true)
  })

  it('closes stream when chunk.done is true', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"X","done":false}\n\n',
      'data: {"delta":"Y","done":true}\n\n',
      'data: {"delta":"Z","done":false}\n\n', // should not appear
    ])
    const readable = toReadableStream(res)
    const reader = readable.getReader()
    const r1 = await reader.read()
    expect(r1.value).toBe('X')
    const r2 = await reader.read()
    expect(r2.value).toBe('Y')
    const r3 = await reader.read()
    expect(r3.done).toBe(true)
  })

  it('skips chunks with empty/falsy delta', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"","done":false}\n\n',
      'data: {"delta":"real","done":false}\n\n',
    ])
    const readable = toReadableStream(res)
    const reader = readable.getReader()
    const r1 = await reader.read()
    expect(r1.value).toBe('real')
    const r2 = await reader.read()
    expect(r2.done).toBe(true)
  })

  it('errors the stream when consumeStream throws', async () => {
    const res = noBodyResponse()
    const readable = toReadableStream(res)
    const reader = readable.getReader()
    await expect(reader.read()).rejects.toThrow('No response body')
  })

  it('closes the stream normally after [DONE]', async () => {
    const res = makeSSEResponse([
      'data: {"delta":"only","done":false}\n\n',
      'data: [DONE]\n\n',
    ])
    const readable = toReadableStream(res)
    const reader = readable.getReader()
    const r1 = await reader.read()
    expect(r1.value).toBe('only')
    const r2 = await reader.read()
    expect(r2.done).toBe(true)
  })
})
