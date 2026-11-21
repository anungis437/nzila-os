import { describe, expect, it } from 'vitest'
import {
  canonicalActionScope,
  rewardHttpPorts,
  rewardRequest,
  UserRole,
} from './support/rewards-route-context'
import { GET } from '../rewards/export/route'
describe('reward export preserves authorization and credit deferral', () => {
  it('refuses a member before a tenant transaction, audit or file', async () => {
    expect(
      (await canonicalActionScope(() => GET(rewardRequest('/api/rewards/export')))).status,
    ).toBe(403)
    expect(rewardHttpPorts.transactions).not.toHaveBeenCalled()
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
  it('retains export type validation after administrative authorization', async () => {
    expect(
      (
        await canonicalActionScope(() => GET(rewardRequest('/api/rewards/export?type=forged')), {
          role: UserRole.ADMIN,
        })
      ).status,
    ).toBe(400)
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
  it.each(['awards', 'ledger', 'budgets'])(
    'cannot export %s from a role title alone',
    async (type) => {
      const response = await canonicalActionScope(
        () => GET(rewardRequest(`/api/rewards/export?type=${type}`)),
        { role: UserRole.ADMIN },
      )
      expect(response.status).toBe(501)
      expect(rewardHttpPorts.query).not.toHaveBeenCalled()
    },
  )
})
