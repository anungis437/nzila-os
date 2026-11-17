import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeBaseApplicationReadiness } from './base-application-probe'
afterEach(() => vi.unstubAllGlobals())
describe('actual base readiness response', () => {
  const sha = 'a'.repeat(40)
  const body = () => ({ ready: true, gitSha: sha, releaseProfile: 'union-eyes-v2-base', checks: {
    process: 'ok', noTestBypass: 'ok', runtimeProfile: 'ok', database: 'ok', catalogAuthority: 'ok', decisionProof: 'ok', storage: 'ok', scanner: 'ok', thirdParty: 'unknown',
  } })
  const fetchBody = (value: unknown, ok = true) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => value })))
  it('accepts the real normalized health states and requires source provenance', async () => {
    fetchBody(body())
    expect((await probeBaseApplicationReadiness(sha, 'https://staging.example.invalid')).state).toBe('ok')
    fetchBody({ ...body(), gitSha: 'b'.repeat(40) })
    expect((await probeBaseApplicationReadiness(sha, 'https://staging.example.invalid')).state).toBe('fail')
  })
  it.each(['database', 'catalogAuthority', 'decisionProof', 'storage', 'scanner', 'noTestBypass'])(
    'fails if %s was not actually measured as ok', async name => {
      const value = body(); value.checks[name as keyof typeof value.checks] = 'unknown'; fetchBody(value)
      expect((await probeBaseApplicationReadiness(sha, 'https://staging.example.invalid')).state).toBe('fail')
    })
  it('refuses a false HTTP status and invalid/missing origins without forwarding credentials', async () => {
    fetchBody(body(), false)
    expect((await probeBaseApplicationReadiness(sha, 'https://staging.example.invalid')).state).toBe('fail')
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    for (const origin of [undefined, 'http://example.invalid', 'https://u:p@example.invalid', 'https://example.invalid?token=secret']) {
      expect((await probeBaseApplicationReadiness(sha, origin)).state).toBe('fail')
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
})
