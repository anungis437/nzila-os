export const MAX_JSON_BODY_BYTES = 512 * 1024
export const MAX_JSON_NODES = 20_000
export const MAX_JSON_COLLECTION_ITEMS = 5_000
export const MAX_JSON_DEPTH = 32

/** Defense in depth while the Zod 4 security migration is outstanding. */
export class JsonBodyBudgetError extends Error {
  readonly code = 'JSON_BODY_BUDGET_EXCEEDED'
  constructor() { super('JSON body exceeds allowed resource limits') }
}

export function assertBoundedJsonComplexity(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
  let visited = 0
  while (stack.length) {
    const next = stack.pop()!
    if (++visited > MAX_JSON_NODES || next.depth > MAX_JSON_DEPTH) throw new JsonBodyBudgetError()
    if (next.value === null || typeof next.value !== 'object') continue
    const items = Array.isArray(next.value)
      ? next.value : Object.values(next.value as Record<string, unknown>)
    if (items.length > MAX_JSON_COLLECTION_ITEMS) throw new JsonBodyBudgetError()
    for (const item of items) stack.push({ value: item, depth: next.depth + 1 })
  }
}

/** Count actual streamed bytes; Content-Length is never trusted by itself. */
export async function readBoundedJson(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<unknown> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_JSON_BODY_BYTES) {
    throw new RangeError('Invalid JSON byte budget')
  }
  const declared = request.headers.get('content-length')
  if (declared !== null) {
    const n = Number(declared)
    if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(n) || n > maxBytes) {
      throw new JsonBodyBudgetError()
    }
  }
  if (!request.body) return request.json()
  let read = 0
  let oversized = false
  const counted = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      read += chunk.byteLength
      if (read > maxBytes) {
        oversized = true
        controller.error(new JsonBodyBudgetError())
        return
      }
      controller.enqueue(chunk)
    },
  }))
  let value: unknown
  try {
    value = await new Response(counted, { headers: { 'content-type': 'application/json' } }).json()
  } catch (error) {
    if (oversized) throw new JsonBodyBudgetError()
    throw error
  }
  assertBoundedJsonComplexity(value)
  return value
}
