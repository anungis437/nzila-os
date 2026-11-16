import { createHash, webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { privacyFetch, verifiedPrivacyDownload } from './privacy-api'

afterEach(() => { vi.unstubAllGlobals() })

describe('privacy browser boundary', () => {
  it('passes only an expected-organization precondition with same-origin credentials and no-store', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    await privacyFetch('org-A', '/api/privacy/dsar', { method: 'POST', body: '{}' })
    const options = fetcher.mock.calls[0][1]
    expect(options.credentials).toBe('same-origin')
    expect(options.cache).toBe('no-store')
    expect(options.headers.get('x-ue-expected-organization')).toBe('org-A')
    expect(options.headers.get('Content-Type')).toBe('application/json')
  })

  it('reads structured refusal codes, and never displays private error text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'PRIVATE BODY', details: { reason: 'stale' } } }), { status: 409 })))
    await expect(privacyFetch('org-A','/api/privacy/dsar')).rejects.toMatchObject({ reason: 'stale', message: 'Privacy operation could not be completed' })
  })

  it('rejects an authentication page instead of treating its bytes as an export', async () => {
    await expect(verifiedPrivacyDownload(new Response('<html>Sign in</html>', { headers: { 'Content-Type': 'text/html' } }))).rejects.toMatchObject({ reason: 'unavailable' })
  })

  it('accepts only actual JSON bytes matching the server checksum', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const bytes = '{"data":{"accountProfile":{"firstName":"Synthetic"}}}\n'
    const headers = { 'Content-Type': 'application/json', 'X-Privacy-Export-Sha256': createHash('sha256').update(bytes).digest('hex') }
    expect(await (await verifiedPrivacyDownload(new Response(bytes, { headers }))).text()).toBe(bytes)
    await expect(verifiedPrivacyDownload(new Response(bytes + 'changed', { headers }))).rejects.toMatchObject({ reason: 'unavailable' })
  })
})
