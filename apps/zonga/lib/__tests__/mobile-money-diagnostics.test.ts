import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({ warn: vi.fn() }))
vi.mock('../logger', () => ({ logger }))
import { executeMobileMoneyPayout } from '../stripe'

beforeEach(() => vi.resetAllMocks())
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('N18 queued mobile-money diagnostic', () => {
  const options = { creatorId: 'private-creator', phoneNumber: 'private-phone', amountMinorUnits: 1000, currency: 'KES', rail: 'mpesa' as const }
  it('preserves queued reference and no provider request even when logging fails', async () => {
    vi.stubEnv('FLUTTERWAVE_SECRET_KEY', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    logger.warn.mockImplementation(() => { throw new Error('sink unavailable') })
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const result = await executeMobileMoneyPayout(options)
    expect(result).toEqual({ reference: expect.stringMatching(/^momo_mpesa_\d+_[a-f\d]{8}$/), status: 'queued' })
    expect(fetch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'Mobile money provider not configured — payout queued locally',
      { orgId: '[REDACTED]', userId: '[REDACTED]' },
    )
  })
  it('preserves configured provider payload, pending response, and rejection', async () => {
    vi.stubEnv('FLUTTERWAVE_SECRET_KEY', 'test-key')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: { id: 1 } })))
    vi.stubGlobal('fetch', fetch)
    expect((await executeMobileMoneyPayout(options)).status).toBe('pending')
    const payload = JSON.parse(fetch.mock.calls[0][1].body)
    expect(payload).toMatchObject({ account_bank: 'MPS', account_number: options.phoneNumber, amount: 10, currency: 'KES', beneficiary_name: options.creatorId })
    expect(logger.warn).not.toHaveBeenCalled()
    fetch.mockResolvedValueOnce(new Response('rejected', { status: 400 }))
    await expect(executeMobileMoneyPayout(options)).rejects.toThrow('Flutterwave transfer failed (400)')
  })
})
