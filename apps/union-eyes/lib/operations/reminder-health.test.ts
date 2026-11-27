import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeReminderMailProvider } from './reminder-health'
const receipt = { id: '11111111-1111-4111-8111-111111111111', sent_at: new Date().toISOString() }
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-sending-key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'controlled@example.invalid')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const provider = (status = 422, name = 'missing_required_field', message = 'Missing `to` field.', extra = {}) => {
  const fetcher = vi.fn(async () => ({ status, json: async () => ({ name, message, ...extra }) }))
  vi.stubGlobal('fetch', fetcher); return fetcher
}
describe('sender API authentication without accepting email or claiming delivery', () => {
  it('requires the existing sending key, sender and persisted mail provenance before a request', async () => {
    const fetcher = provider(); vi.stubEnv('RESEND_API_KEY', '')
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
    vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-sending-key')
    expect((await probeReminderMailProvider(undefined)).state).toBe('fail')
    expect((await probeReminderMailProvider({ ...receipt, id: '../../arbitrary' })).state).toBe('fail')
    expect((await probeReminderMailProvider({ ...receipt, sent_at: 'invalid' })).state).toBe('fail')
    expect((await probeReminderMailProvider({ ...receipt, sent_at: new Date(Date.now() + 600000).toISOString() })).state).toBe('fail')
    vi.stubEnv('RESEND_FROM_EMAIL', ''); vi.stubEnv('EMAIL_FROM', '')
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('authenticates only through the sending API with no recipients, cc or bcc', async () => {
    const fetcher = provider(); const measured = await probeReminderMailProvider(receipt)
    expect(measured).toMatchObject({ state: 'ok', verification: 'sender_api_authentication_only',
      providerHttpStatus: 422, recipients: 0, emailAccepted: false, deliveryVerified: false, humanInboxVerified: false })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails'); expect(request.method).toBe('POST')
    const body = JSON.parse(String(request.body)); expect(body.to).toEqual([])
    expect(body).not.toHaveProperty('cc'); expect(body).not.toHaveProperty('bcc')
    expect(body.from).toBe('controlled@example.invalid')
    expect(JSON.stringify(measured)).not.toContain('synthetic-provider-sending-key')
    expect(measured.note).toContain('separate required release proofs')
  })
  it.each([
    [401, 'validation_error', 'API key is invalid'],
    [403, 'suspended_api_key', 'Key suspended'],
    [429, 'rate_limit_exceeded', 'Rate limited'],
    [500, 'application_error', 'Provider unavailable'],
    [422, 'missing_required_field', 'Missing from field'],
    [422, 'validation_error', 'Missing to field'],
  ])('fails for an unauthenticated or ambiguous provider result %s/%s', async (status, name, message) => {
    provider(Number(status), String(name), String(message))
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
  })
  it('refuses any unexpected acceptance or message identifier instead of reporting it as healthy', async () => {
    const fetcher = provider(200, 'missing_required_field', 'Missing to field', { id: receipt.id })
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail'); expect(fetcher).toHaveBeenCalledTimes(1)
    provider(422, 'missing_required_field', 'Missing to field', { id: receipt.id })
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
  })
  it('sanitizes provider exceptions and makes no read-access or inbox claim', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('private-provider-detail') }))
    expect(JSON.stringify(await probeReminderMailProvider(receipt))).not.toContain('private-provider-detail')
    provider(); const measured = await probeReminderMailProvider(receipt)
    expect(measured).not.toHaveProperty('providerEvent'); expect(measured).not.toHaveProperty('receiptReadVerified', true)
  })
})
