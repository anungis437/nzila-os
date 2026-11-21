import { describe, expect, it } from 'vitest'
import {
  canonicalActionScope,
  rewardHttpPorts,
  rewardRequest,
} from './support/rewards-route-context'
import { GET } from '../rewards/redemptions/route'
describe('deferred redemption read', () => {
  it('validates a status without disclosing any redemption', async () => {
    expect(
      (
        await canonicalActionScope(() =>
          GET(rewardRequest('/api/rewards/redemptions?status=forged')),
        )
      ).status,
    ).toBe(400)
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
  it.each(['', '?status=initiated', '?status=refunded'])(
    'returns truthful unavailable for %s',
    async (query) => {
      expect(
        (await canonicalActionScope(() => GET(rewardRequest(`/api/rewards/redemptions${query}`))))
          .status,
      ).toBe(501)
      expect(rewardHttpPorts.query).not.toHaveBeenCalled()
    },
  )
})
