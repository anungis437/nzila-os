import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeReminderMailProvider } from './reminder-health'
const receipt = { id: '11111111-1111-4111-8111-111111111111', sent_at: new Date().toISOString() }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('configured provider receipt health without another email send', () => {
  const response = (last_event: string, ok = true, id = receipt.id) => vi.stubGlobal('fetch', vi.fn(async () => ({
    ok, json: async () => ({ id, last_event, to: ['private-recipient@example.invalid'], html: 'private-message-content' }),
  })))
  it('requires an actual persisted provider id and configured key', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
    vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-key-only')
    expect((await probeReminderMailProvider(undefined)).state).toBe('fail')
    expect((await probeReminderMailProvider({ ...receipt, id: '../../arbitrary' })).state).toBe('fail')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('reports provider delivery without returning the recipient, message or inbox claim', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-key-only'); response('delivered')
    const measured = await probeReminderMailProvider(receipt)
    expect(measured.state).toBe('ok')
    expect(measured.note).toContain('human inbox receipt is separate')
    expect(JSON.stringify(measured)).not.toContain('private-')
    expect(fetch).toHaveBeenCalledWith(`https://api.resend.com/emails/${receipt.id}`, expect.objectContaining({ redirect: 'error' }))
  })
  it('distinguishes a recent accepted email from delivery and fails if it never settles', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-key-only'); response('sent')
    expect((await probeReminderMailProvider(receipt)).note).toContain('delivery is pending')
    expect((await probeReminderMailProvider({ ...receipt, sent_at: '2020-01-01T00:00:00Z' })).state).toBe('fail')
  })
  it.each(['bounced', 'complained', 'failed', 'delivery_delayed', 'unknown'])(
    'fails for provider event %s instead of treating any response as healthy', async event => {
      vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-key-only'); response(event)
      expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
    })
  it('fails on a denied read, mismatched id and credential-bearing provider exception', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-provider-key-only'); response('delivered', false)
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
    response('delivered', true, '22222222-2222-4222-8222-222222222222')
    expect((await probeReminderMailProvider(receipt)).state).toBe('fail')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('private-secret-from-provider') }))
    expect(JSON.stringify(await probeReminderMailProvider(receipt))).not.toContain('private-secret')
  })
})
