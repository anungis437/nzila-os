import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeScanner } from './service-probes'

describe('document scanner readiness', () => {
  beforeEach(() => {
    vi.stubEnv('CLAMAV_URL', 'http://owned-scanner.internal')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('accepts only the adapter response backed by a successful clamd PING', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ok', clamd: true }) })))
    expect(await probeScanner()).toMatchObject({ state: 'ok' })
    expect(fetch).toHaveBeenCalledExactlyOnceWith('http://owned-scanner.internal/health', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
  })

  it.each([{ status: 'ok' }, { status: 'ok', clamd: false }, { status: 'unknown', clamd: true }, null])('rejects a nominal HTTP 200 with an unverified daemon', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
    expect(await probeScanner()).toMatchObject({ state: 'fail' })
  })

  it.each(['file:///private/path', 'https://user:password@scanner.invalid', 'https://scanner.invalid/?token=credential'])('refuses unsafe configured URLs without making a request', async (url) => {
    vi.stubEnv('CLAMAV_URL', url)
    vi.stubGlobal('fetch', vi.fn())
    expect(await probeScanner()).toMatchObject({ state: 'fail' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports missing configuration without claiming a healthy scanner', async () => {
    vi.stubEnv('CLAMAV_URL', '')
    expect(await probeScanner()).toMatchObject({ state: 'degraded' })
  })

  it('sanitizes transport errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('private-host credential=value') }))
    const result = await probeScanner()
    expect(result.state).toBe('fail')
    expect(JSON.stringify(result)).not.toMatch(/private-host|credential/)
  })

  it('bounds the entire response, including a body that never completes', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) })))
    const result = probeScanner()
    await vi.advanceTimersByTimeAsync(3001)
    expect(await result).toMatchObject({ state: 'fail' })
  })
})
