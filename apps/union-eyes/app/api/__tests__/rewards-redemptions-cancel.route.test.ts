import { describe, expect, it } from 'vitest'
import {
  canonicalActionScope,
  rewardHttpPorts,
  rewardRequest,
} from './support/rewards-route-context'
import { POST } from '../rewards/redemptions/route'
describe('deferred cancellation never refunds credits', () => {
  it('preserves typed cancellation input validation', async () => {
    expect(
      (
        await canonicalActionScope(() =>
          POST(rewardRequest('/api/rewards/redemptions', 'POST', { programId: 'forged' })),
        )
      ).status,
    ).toBe(400)
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
  it('preserves the bounded body limit', async () => {
    expect(
      (
        await canonicalActionScope(() =>
          POST(rewardRequest('/api/rewards/redemptions', 'POST', { reason: 'x'.repeat(9000) })),
        )
      ).status,
    ).toBe(413)
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
  it('answers unavailable for any well-formed resource id without an existence oracle or refund', async () => {
    const response = await canonicalActionScope(() =>
      POST(
        rewardRequest('/api/rewards/redemptions', 'POST', {
          redemptionId: '33333333-3333-4333-8333-333333333333',
          reason: 'Changed my mind',
        }),
      ),
    )
    expect(response.status).toBe(501)
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
})
