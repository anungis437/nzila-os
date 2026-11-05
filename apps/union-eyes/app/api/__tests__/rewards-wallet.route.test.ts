import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { declaredOptions } from './with-api-double'

const m = vi.hoisted(() => ({ getWalletSnapshot: vi.fn() }))

vi.mock('@/lib/services/rewards/wallet-service', () => ({ getWalletSnapshot: m.getWalletSnapshot }))
vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble)
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

// DEF-0B11-PRP-WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY-WITH-UNVALIDATED-PAGING
describe('rewards/wallet GET paging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.getWalletSnapshot.mockResolvedValue({ balance: 10, entries: [], total: 0 })
  })

  const get = async (query: string) => {
    const { GET } = await import('../rewards/wallet/route')
    return (GET as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
      new NextRequest(`http://localhost/api/rewards/wallet${query}`),
      { userId: 'u1', organizationId: 'org_1' },
    )
  }

  it('asks the wrapper for a member and for the tenant transaction its ledger statements read in', async () => {
    const { GET } = await import('../rewards/wallet/route')
    const options = declaredOptions(GET)
    expect(options.auth).toEqual({ minRole: 'member' })
    expect(options.rlsOrgContext).toBe(true)
  })
  it('turns a non-numeric or negative request into bounded defaults', async () => {
    await get('?limit=abc&offset=-5')
    expect(m.getWalletSnapshot).toHaveBeenCalledWith('org_1', 'u1', 20, 0)
  })

  it('caps the limit at 100 and never passes NaN', async () => {
    await get('?limit=9999&offset=3')
    expect(m.getWalletSnapshot).toHaveBeenLastCalledWith('org_1', 'u1', 100, 3)
    await get('?limit=0')
    expect(m.getWalletSnapshot).toHaveBeenLastCalledWith('org_1', 'u1', 1, 0)
  })

  it('reads only the caller\'s own balance and ledger', async () => {
    await get('')
    expect(m.getWalletSnapshot).toHaveBeenCalledWith('org_1', 'u1', 20, 0)
  })
})
