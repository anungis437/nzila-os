import { describe, expect, it, vi } from 'vitest'
import * as service from '../wallet-service'
import { RewardsInstitutionalAuthorityUnavailable } from '@/lib/rewards/credit-authority'

const io = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('unexpected business IO')
  }),
)
vi.mock('@/db', () => ({ db: new Proxy({}, { get: () => io }) }))

describe('deferred wallet reward authority', () => {
  it.each([
    'getBalance',
    'listLedger',
    'getWalletSnapshot',
    'applyLedgerEntry',
    'adminAdjustBalance',
    'getLedgerSummary',
    'getBulkBalances',
  ])('%s refuses before any business effect', async (name) => {
    io.mockClear()
    const entry = service[name as keyof typeof service] as (...args: unknown[]) => unknown
    let error: unknown
    try {
      await entry(
        new Proxy(
          {},
          {
            get() {
              throw new Error('input reached deferred implementation')
            },
          },
        ),
      )
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(RewardsInstitutionalAuthorityUnavailable)
    expect(error).toMatchObject({ status: 501, code: 'NOT_IMPLEMENTED' })
    expect(io).not.toHaveBeenCalled()
  })
})
