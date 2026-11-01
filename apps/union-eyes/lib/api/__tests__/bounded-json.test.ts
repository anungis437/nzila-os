import { describe, expect, it } from 'vitest'
import { readBoundedJson, RequestBodyTooLargeError } from '../bounded-json'

describe('bounded authenticated JSON request reader', () => {
  it('parses a valid request at its exact byte limit', async () => {
    const body = JSON.stringify({ payload: [{ title: 'a' }] })
    const request = new Request('http://localhost/import', { method: 'POST', body })
    await expect(readBoundedJson(request, Buffer.byteLength(body))).resolves.toEqual({
      payload: [{ title: 'a' }],
    })
  })

  it('rejects declared oversize even when the body is small', async () => {
    const request = new Request('http://localhost/import', {
      method: 'POST',
      body: '{}',
      headers: { 'content-length': '99999999' },
    })
    await expect(readBoundedJson(request, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
  })

  it('rejects a dishonest small content-length against streamed actual bytes', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"rows":'))
        controller.enqueue(new TextEncoder().encode('"' + 'x'.repeat(2000) + '"}'))
        controller.close()
      },
    })
    const request = new Request('http://localhost/import', {
      method: 'POST',
      body,
      duplex: 'half',
      headers: { 'content-length': '1' },
    } as RequestInit)
    await expect(readBoundedJson(request, 128)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
  })

  it('counts multibyte UTF-8 bytes rather than character length', async () => {
    const body = JSON.stringify({ text: '🥌'.repeat(20) })
    const request = new Request('http://localhost/import', { method: 'POST', body })
    await expect(readBoundedJson(request, body.length)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
  })

  it('preserves malformed JSON rejection', async () => {
    const request = new Request('http://localhost/import', { method: 'POST', body: '{oops' })
    await expect(readBoundedJson(request, 100)).rejects.toBeInstanceOf(SyntaxError)
  })

  it('rejects invalid limits rather than silently removing protection', async () => {
    const request = new Request('http://localhost/import', { method: 'POST', body: '{}' })
    await expect(readBoundedJson(request, 0)).rejects.toBeInstanceOf(RangeError)
  })
})
