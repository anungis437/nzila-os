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

  const declared = request.headers.get('content-length')
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
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
        await reader.cancel().catch(() => undefined)
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
