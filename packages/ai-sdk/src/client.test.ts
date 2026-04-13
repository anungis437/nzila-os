import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAiClient, AiSdkError } from './index'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockResponse(
  ok: boolean,
  body: unknown,
  status = ok ? 200 : 500,
): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as Response
}

function mockResponseJsonFail(status: number): Response {
  return {
    ok: false,
    status,
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    headers: new Headers(),
  } as unknown as Response
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c))
      }
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    json: vi.fn(),
    headers: new Headers(),
  } as unknown as Response
}

// ── Setup ───────────────────────────────────────────────────────────────────

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

const BASE = 'http://test:3000'

function makeClient(getToken: () => string | Promise<string> = () => 'tok') {
  return createAiClient({ baseUrl: BASE, getToken })
}

const OPTS = {
  orgId: 'o1',
  appKey: 'a1',
  profileKey: 'p1',
  input: 'hello',
  dataClass: 'public' as const,
}

// ── post() happy path ───────────────────────────────────────────────────────

describe('client – post() happy path', () => {
  it('generate() calls /api/ai/generate and returns JSON', async () => {
    const payload = { requestId: '1', content: 'hi', tokensIn: 1, tokensOut: 1, costUsd: 0, latencyMs: 10, model: 'm', provider: 'p' }
    fetchMock.mockResolvedValue(mockResponse(true, payload))

    const result = await makeClient().generate(OPTS)

    expect(result).toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/ai/generate`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(OPTS),
      }),
    )
  })

  it('chat() calls /api/ai/chat', async () => {
    fetchMock.mockResolvedValue(mockResponse(true, { content: 'ok' }))
    await makeClient().chat(OPTS)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/ai/chat`, expect.anything())
  })

  it('embed() calls /api/ai/embed', async () => {
    const embedOpts = { orgId: 'o', appKey: 'a', profileKey: 'p', input: 'text', dataClass: 'public' as const }
    fetchMock.mockResolvedValue(mockResponse(true, { embeddings: [[0.1]] }))
    await makeClient().embed(embedOpts)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/ai/embed`, expect.anything())
  })

  it('extract() calls /api/ai/extract', async () => {
    const extractOpts = { orgId: 'o', appKey: 'a', profileKey: 'p', promptKey: 'pk', input: 'x', dataClass: 'public' as const }
    fetchMock.mockResolvedValue(mockResponse(true, { data: {} }))
    await makeClient().extract(extractOpts)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/ai/extract`, expect.anything())
  })

  it('ragQuery() calls /api/ai/rag/query', async () => {
    const ragOpts = { orgId: 'o', appKey: 'a', profileKey: 'p', query: 'q', dataClass: 'public' as const }
    fetchMock.mockResolvedValue(mockResponse(true, { chunks: [] }))
    await makeClient().ragQuery(ragOpts)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/ai/rag/query`, expect.anything())
  })

  it('actionPropose() calls /api/ai/actions/propose', async () => {
    const propOpts = { orgId: 'o', appKey: 'a', profileKey: 'p', actionType: 't', input: 'i' }
    fetchMock.mockResolvedValue(mockResponse(true, { actionId: 'a1' }))
    await makeClient().actionPropose(propOpts)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/ai/actions/propose`, expect.anything())
  })

  it('actionApprove() calls /api/ai/actions/approve', async () => {
    const appOpts = { actionId: 'a1', approved: true }
    fetchMock.mockResolvedValue(mockResponse(true, { status: 'approved' }))
    await makeClient().actionApprove(appOpts)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/ai/actions/approve`, expect.anything())
  })
})

// ── post() error branches ───────────────────────────────────────────────────

describe('client – post() error handling', () => {
  it('throws AiSdkError with code and error from JSON body', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(false, { code: 'budget_exceeded', error: 'over limit' }, 429),
    )

    await expect(makeClient().generate(OPTS)).rejects.toThrow(AiSdkError)
    try {
      await makeClient().generate(OPTS)
    } catch (err) {
      const e = err as AiSdkError
      expect(e.code).toBe('budget_exceeded')
      expect(e.message).toBe('over limit')
      expect(e.statusCode).toBe(429)
    }
  })

  it('falls back to "unknown" code when body has no code', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(false, { error: 'something wrong' }, 400),
    )

    await expect(makeClient().generate(OPTS)).rejects.toMatchObject({
      code: 'unknown',
      message: 'something wrong',
      statusCode: 400,
    })
  })

  it('falls back to status message when body has no error', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(false, { code: 'policy_denied' }, 403),
    )

    await expect(makeClient().generate(OPTS)).rejects.toMatchObject({
      code: 'policy_denied',
      message: 'Request failed with status 403',
    })
  })

  it('falls back to status message when json parse fails', async () => {
    fetchMock.mockResolvedValue(mockResponseJsonFail(502))

    await expect(makeClient().generate(OPTS)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Request failed with status 502',
      statusCode: 502,
    })
  })

  it('falls back when body is completely empty object', async () => {
    fetchMock.mockResolvedValue(mockResponse(false, {}, 500))

    await expect(makeClient().generate(OPTS)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Request failed with status 500',
      statusCode: 500,
    })
  })
})

// ── headers / getToken ──────────────────────────────────────────────────────

describe('client – headers()', () => {
  it('resolves sync getToken()', async () => {
    const client = makeClient(() => 'sync-token')
    fetchMock.mockResolvedValue(mockResponse(true, {}))
    await client.generate(OPTS)

    const init = fetchMock.mock.calls[0]![1]!
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sync-token')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('resolves async getToken()', async () => {
    const client = makeClient(async () => 'async-token')
    fetchMock.mockResolvedValue(mockResponse(true, {}))
    await client.generate(OPTS)

    const init = fetchMock.mock.calls[0]![1]!
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer async-token')
  })
})

// ── chatStream() ────────────────────────────────────────────────────────────

describe('client – chatStream()', () => {
  it('returns stream/collect/toReadable on success', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"delta":"hi","done":false}\n\n',
        'data: {"delta":"!","done":true}\n\n',
      ]),
    )

    const result = await makeClient().chatStream(OPTS)
    expect(result).toHaveProperty('stream')
    expect(result).toHaveProperty('collect')
    expect(result).toHaveProperty('toReadable')
  })

  it('throws AiSdkError with code/error from JSON body on failure', async () => {
    const errRes = {
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ code: 'budget_exceeded', error: 'over' }),
      headers: new Headers(),
    } as unknown as Response
    fetchMock.mockResolvedValue(errRes)

    await expect(makeClient().chatStream(OPTS)).rejects.toMatchObject({
      code: 'budget_exceeded',
      message: 'over',
      statusCode: 429,
    })
  })

  it('falls back to "unknown" code when stream error body lacks code', async () => {
    const errRes = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: 'bad request' }),
      headers: new Headers(),
    } as unknown as Response
    fetchMock.mockResolvedValue(errRes)

    await expect(makeClient().chatStream(OPTS)).rejects.toMatchObject({
      code: 'unknown',
      message: 'bad request',
    })
  })

  it('falls back to status message when stream error body lacks error field', async () => {
    const errRes = {
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ code: 'policy_denied' }),
      headers: new Headers(),
    } as unknown as Response
    fetchMock.mockResolvedValue(errRes)

    await expect(makeClient().chatStream(OPTS)).rejects.toMatchObject({
      code: 'policy_denied',
      message: 'Stream request failed with status 403',
    })
  })

  it('falls back when json parse fails on stream error', async () => {
    const errRes = {
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new SyntaxError('bad')),
      headers: new Headers(),
    } as unknown as Response
    fetchMock.mockResolvedValue(errRes)

    await expect(makeClient().chatStream(OPTS)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Stream request failed with status 503',
      statusCode: 503,
    })
  })

  it('falls back when stream error body is empty object', async () => {
    const errRes = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
      headers: new Headers(),
    } as unknown as Response
    fetchMock.mockResolvedValue(errRes)

    await expect(makeClient().chatStream(OPTS)).rejects.toMatchObject({
      code: 'unknown',
      message: 'Stream request failed with status 500',
    })
  })

  it('collect() accumulates the full streamed text', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"delta":"Hello","done":false}\n\n',
        'data: {"delta":" world","done":true}\n\n',
      ]),
    )

    const { collect: collectFn } = await makeClient().chatStream(OPTS)
    const text = await collectFn()
    expect(text).toBe('Hello world')
  })

  it('toReadable() returns a ReadableStream of deltas', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"delta":"A","done":false}\n\n',
        'data: {"delta":"B","done":true}\n\n',
      ]),
    )

    const { toReadable } = await makeClient().chatStream(OPTS)
    const readable = toReadable()
    const reader = readable.getReader()
    const r1 = await reader.read()
    expect(r1.value).toBe('A')
    const r2 = await reader.read()
    expect(r2.value).toBe('B')
    const r3 = await reader.read()
    expect(r3.done).toBe(true)
  })

  it('chatStream sends to /api/ai/chat/stream with correct headers', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"delta":"x","done":true}\n\n']),
    )

    await makeClient(async () => 'stream-tok').chatStream(OPTS)

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/ai/chat/stream`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(OPTS),
      }),
    )
    const init = fetchMock.mock.calls[0]![1]!
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer stream-tok')
  })
})
