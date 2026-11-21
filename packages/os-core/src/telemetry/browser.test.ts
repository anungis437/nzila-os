import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserErrorDiagnostic } from './browser'

let reporter: typeof import('./browser')
const valid = (): BrowserErrorDiagnostic => ({ app: 'console', surface: 'error-panel', code: 'CLIENT_BOUNDARY_ERROR', reference: 'opaque-123', referenceOrigin: 'error-digest' })
beforeEach(async () => { vi.resetModules(); vi.stubGlobal('window', {}); reporter = await import('./browser') })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('local browser diagnostic contract', () => {
  it('records a fixed envelope locally without claiming remote delivery', () => {
    expect(reporter.recordBrowserError(valid())).toEqual({ status: 'RECORDED_LOCALLY', remoteDelivery: 'NOT_ATTEMPTED' })
    expect(reporter.readBrowserDiagnostics()).toEqual([{ ...valid(), recordedAt: expect.any(String) }])
  })
  it('does not enumerate, stringify, or store raw error and metadata properties', () => {
    const input = Object.assign(valid(), { message: 'private-message-canary', password: 'private-password-canary', nested: { secret: 'private-secret-canary' } })
    Object.defineProperty(input, 'error', { get() { throw new Error('Raw error accessed') } })
    Object.defineProperty(input, 'toJSON', { get() { throw new Error('Serialization accessed') } })
    expect(reporter.recordBrowserError(input).status).toBe('RECORDED_LOCALLY')
    expect(JSON.stringify(reporter.readBrowserDiagnostics())).not.toContain('private-')
  })
  it.each([
    { app: '__proto__' }, { app: 'foreign-app' }, { surface: 'customer-private-path' },
    { code: 'arbitrary-message' }, { reference: 'https://example.invalid/private?token=secret' },
    { reference: 'person@example.invalid' }, { reference: 'bad\nreference' }, { reference: 'a'.repeat(65) },
    { referenceOrigin: 'delivered' }, { referenceOrigin: 'local', reference: 'not-local' },
  ])('refuses an unapproved envelope %j', extra => {
    expect(reporter.recordBrowserError({ ...valid(), ...extra } as BrowserErrorDiagnostic).status).toBe('REJECTED')
    expect(reporter.readBrowserDiagnostics()).toEqual([])
  })
  it('reads approved getters once and refuses a throwing getter without breaking the boundary', () => {
    let reads = 0
    const input = valid()
    Object.defineProperty(input, 'reference', { get() { reads++; return reads === 1 ? 'opaque-123' : 'private-canary' } })
    expect(reporter.recordBrowserError(input).status).toBe('RECORDED_LOCALLY')
    expect(reads).toBe(1)
    expect(reporter.readBrowserDiagnostics()[0]?.reference).toBe('opaque-123')
    Object.defineProperty(input, 'app', { get() { throw new Error('bad getter') } })
    expect(reporter.recordBrowserError(input).status).toBe('REJECTED')
  })
  it('bounds retention and makes snapshots immutable', () => {
    for (let index = 0; index < reporter.BROWSER_DIAGNOSTIC_LIMIT + 7; index++)
      reporter.recordBrowserError({ ...valid(), reference: `ref-${index}` })
    const result = reporter.readBrowserDiagnostics()
    expect(result).toHaveLength(reporter.BROWSER_DIAGNOSTIC_LIMIT)
    expect(result[0]?.reference).toBe('ref-7')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result[0])).toBe(true)
  })
  it('never claims a local recording when running on the server', () => {
    vi.stubGlobal('window', undefined)
    expect(reporter.recordBrowserError(valid())).toEqual({ status: 'UNAVAILABLE', remoteDelivery: 'NOT_ATTEMPTED' })
    expect(reporter.readBrowserDiagnostics()).toEqual([])
  })
  it('runs without a Node process, console or network sink', () => {
    const fetch = vi.fn(() => { throw new Error('Network attempted') })
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('process', undefined)
    vi.stubGlobal('console', undefined)
    let status: string | undefined
    try { status = reporter.recordBrowserError(valid()).status }
    finally { vi.unstubAllGlobals() }
    expect(status).toBe('RECORDED_LOCALLY')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('retains valid opaque digests and provides stable, clearly local fallbacks', () => {
    expect(reporter.browserErrorReference('123456789', ':R2:')).toEqual({ value: '123456789', origin: 'error-digest' })
    for (const digest of [new Error('private-canary'), 'person@example.invalid', undefined, 'x'.repeat(65)])
      expect(reporter.browserErrorReference(digest, ':R2:')).toEqual({ value: 'local-R2', origin: 'local' })
  })
})
