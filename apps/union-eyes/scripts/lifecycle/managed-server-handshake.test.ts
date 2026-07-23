/**
 * Phase 0C.2 §5 — Tests for the managed-server handshake.
 *
 * These tests exercise every failure mode of `verifyManagedServer` and
 * `isManagedServerMode` without booting a real Next.js server: the
 * `fetch` implementation is injected in every call site.
 *
 * Together with §4, this closes the second half of the "test-auth
 * bypass could ever run against a production/staging server" attack
 * surface: even if the auth bypass ITSELF is hardened (see §4),
 * Playwright still needs to refuse to attach to any server that is
 * not the one the current lifecycle run just booted.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_APP_NAME,
  MANAGED_SERVER_ENDPOINT_PATH,
  MANAGED_SERVER_ENV_VAR,
  MANAGED_SERVER_RUN_ID_ENV_VAR,
  isLoopbackUrl,
  isManagedServerHandshakePayload,
  isManagedServerMode,
  verifyManagedServer,
} from './managed-server-handshake'

/** Build a fake JSON `Response`-like object accepted by the fetch signature. */
function jsonResponse(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(text, {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function nonJsonResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain' },
  })
}

const RUN_ID = 'e2e-run-20260426-183050-abcdef01'
const BASE = 'http://localhost:3002'

describe('§5 — env-var contract (frozen constants)', () => {
  it('MANAGED_SERVER_ENV_VAR is the canonical name', () => {
    expect(MANAGED_SERVER_ENV_VAR).toBe('NZILA_E2E_MANAGED_SERVER')
  })

  it('MANAGED_SERVER_RUN_ID_ENV_VAR is the canonical name', () => {
    expect(MANAGED_SERVER_RUN_ID_ENV_VAR).toBe('NZILA_E2E_RUN_ID')
  })

  it('MANAGED_SERVER_ENDPOINT_PATH is the canonical path', () => {
    expect(MANAGED_SERVER_ENDPOINT_PATH).toBe('/api/health/managed-server')
  })

  it('EXPECTED_APP_NAME is the canonical app name', () => {
    expect(EXPECTED_APP_NAME).toBe('union-eyes')
  })
})

describe('§5 — isManagedServerMode', () => {
  it('returns false when env var is absent', () => {
    expect(isManagedServerMode({})).toBe(false)
  })

  it('returns true only for exact string "true"', () => {
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: 'true' })).toBe(true)
  })

  it('rejects truthy-looking non-"true" strings (fail-closed)', () => {
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: '1' })).toBe(false)
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: 'TRUE' })).toBe(false)
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: 'yes' })).toBe(false)
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: 'on' })).toBe(false)
  })

  it('rejects "false" and empty string', () => {
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: 'false' })).toBe(false)
    expect(isManagedServerMode({ NZILA_E2E_MANAGED_SERVER: '' })).toBe(false)
  })
})

describe('§5 — isLoopbackUrl', () => {
  it('accepts localhost with any port', () => {
    expect(isLoopbackUrl('http://localhost:3002')).toBe(true)
    expect(isLoopbackUrl('http://localhost:1234')).toBe(true)
  })

  it('accepts IPv4 loopback', () => {
    expect(isLoopbackUrl('http://127.0.0.1:3002')).toBe(true)
  })

  it('accepts IPv6 loopback', () => {
    expect(isLoopbackUrl('http://[::1]:3002')).toBe(true)
  })

  it('rejects any real hostname', () => {
    expect(isLoopbackUrl('https://staging.unioneyes.app')).toBe(false)
    expect(isLoopbackUrl('http://8.8.8.8')).toBe(false)
    expect(isLoopbackUrl('http://union-eyes.example.com')).toBe(false)
  })

  it('rejects unparseable URLs (fail-closed)', () => {
    expect(isLoopbackUrl('not a url')).toBe(false)
    expect(isLoopbackUrl('')).toBe(false)
  })
})

describe('§5 — isManagedServerHandshakePayload', () => {
  const valid = {
    app: 'union-eyes',
    managedServer: true,
    runId: RUN_ID,
    pid: 12345,
    uptimeSec: 3.14,
  }

  it('accepts a complete valid payload', () => {
    expect(isManagedServerHandshakePayload(valid)).toBe(true)
  })

  it('rejects null / non-object', () => {
    expect(isManagedServerHandshakePayload(null)).toBe(false)
    expect(isManagedServerHandshakePayload('string')).toBe(false)
    expect(isManagedServerHandshakePayload(42)).toBe(false)
  })

  it('rejects payloads with missing fields', () => {
    expect(isManagedServerHandshakePayload({ ...valid, app: undefined })).toBe(false)
    expect(isManagedServerHandshakePayload({ ...valid, runId: undefined })).toBe(false)
    expect(isManagedServerHandshakePayload({ ...valid, pid: undefined })).toBe(false)
    expect(isManagedServerHandshakePayload({ ...valid, uptimeSec: undefined })).toBe(false)
  })

  it('rejects payloads with managedServer !== true', () => {
    expect(isManagedServerHandshakePayload({ ...valid, managedServer: false })).toBe(false)
    expect(isManagedServerHandshakePayload({ ...valid, managedServer: 'true' })).toBe(false)
  })

  it('rejects empty runId', () => {
    expect(isManagedServerHandshakePayload({ ...valid, runId: '' })).toBe(false)
  })
})

describe('§5 — verifyManagedServer: baseUrl / expectedRunId guards', () => {
  it('refuses non-loopback baseUrl WITHOUT ever calling fetch', async () => {
    const fetchSpy = vi.fn()
    const res = await verifyManagedServer({
      baseUrl: 'https://staging.unioneyes.app',
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('non-loopback-base-url')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refuses empty expectedRunId WITHOUT ever calling fetch', async () => {
    const fetchSpy = vi.fn()
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: '',
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('empty-expected-run-id')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('§5 — verifyManagedServer: happy path', () => {
  it('returns ok when server echoes matching runId and app name', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        app: 'union-eyes',
        managedServer: true,
        runId: RUN_ID,
        pid: 12345,
        uptimeSec: 3.14,
      }),
    )
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.actualRunId).toBe(RUN_ID)
    expect(res.actualApp).toBe('union-eyes')
    // Assert the endpoint path is correct.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const call = fetchSpy.mock.calls[0]?.[0] as string
    expect(call).toContain(MANAGED_SERVER_ENDPOINT_PATH)
    expect(call.startsWith(BASE)).toBe(true)
  })
})

describe('§5 — verifyManagedServer: server failure modes', () => {
  it('rejects mismatched runId (stale/unrelated server on same port)', async () => {
    const staleRunId = 'e2e-run-20260101-000000-oldstale'
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        app: 'union-eyes',
        managedServer: true,
        runId: staleRunId,
        pid: 999,
        uptimeSec: 999999,
      }),
    )
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('run-id-mismatch')
    expect(res.actualRunId).toBe(staleRunId)
  })

  it('rejects mismatched app name (unrelated Next.js app squatting on the port)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        app: 'some-other-app',
        managedServer: true,
        runId: RUN_ID,
        pid: 42,
        uptimeSec: 1.0,
      }),
    )
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('app-mismatch')
    expect(res.actualApp).toBe('some-other-app')
  })

  it('rejects 404 (endpoint not present — server was not booted with managed flag)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'not found' }))
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('non-200-status')
    expect(res.status).toBe(404)
  })

  it('rejects 500 (server misconfiguration)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'oops' }))
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('non-200-status')
    expect(res.status).toBe(500)
  })

  it('rejects non-JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(nonJsonResponse(200, 'plain text not json {'))
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('non-json-body')
  })

  it('rejects malformed JSON payload missing runId', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        app: 'union-eyes',
        managedServer: true,
        pid: 1,
        uptimeSec: 1.0,
      }),
    )
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('bad-payload-shape')
  })

  it('rejects malformed JSON payload missing managedServer flag', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        app: 'union-eyes',
        runId: RUN_ID,
        pid: 1,
        uptimeSec: 1.0,
      }),
    )
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('bad-payload-shape')
  })

  it('rejects fetch network errors (ECONNREFUSED, etc.)', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'))
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('fetch-failed')
    expect(res.error).toContain('ECONNREFUSED')
  })

  it('reports timeout when AbortController fires', async () => {
    const fetchSpy = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    })
    const res = await verifyManagedServer({
      baseUrl: BASE,
      expectedRunId: RUN_ID,
      fetch: fetchSpy as unknown as typeof fetch,
      timeoutMs: 10,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('timeout')
  })
})
