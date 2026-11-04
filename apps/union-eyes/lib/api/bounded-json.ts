/**
 * Stream-bounded JSON reader for authenticated bulk endpoints.
 * Content-Length is only an early rejection hint: actual bytes are counted
 * independently because clients can omit or forge their declared length.
 */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the allowed size')
    this.name = 'RequestBodyTooLargeError'
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('Invalid request body byte limit')

  // A request double without headers or a stream (unit tests of handlers) has nothing to bound: it can only be read whole.
  const declared = request.headers?.get?.('content-length') ?? null
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    abandon(request.body)
    throw new RequestBodyTooLargeError()
  }

  const reader = request.body?.getReader()
  if (!reader) return request.json()

  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) {
        abandon(reader)
        throw new RequestBodyTooLargeError()
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text) as unknown
  } finally {
    reader.releaseLock()
  }
}

/**
 * Stops reading what the caller is still sending. Never awaited: a cancel on one branch of a tee'd stream (a cloned request, which is how
 * `withApi` reads a body) settles only once the other branch is cancelled too, so waiting for it would hang the request it is refusing.
 */
function abandon(stream: { cancel(): Promise<void> } | null | undefined): void {
  void stream?.cancel().catch(() => undefined)
}
