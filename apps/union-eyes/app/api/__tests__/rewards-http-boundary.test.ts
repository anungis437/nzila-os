import { describe, expect, it } from 'vitest'
import {
  canonicalActionScope,
  rewardHttpPorts,
  rewardRequest,
  UserRole,
} from './support/rewards-route-context'
import { POST, DELETE } from '../integrations/shopify/credentials/route'
describe('provider credentials need institutional authority beyond a title', () => {
  it('refuses a member before a transaction or provider effect', async () => {
    expect(
      (
        await canonicalActionScope(() =>
          POST(
            rewardRequest('/api/integrations/shopify/credentials', 'POST', {
              secretRef: 'env://UE_SHOPIFY_SYNTHETIC',
            }),
          ),
        )
      ).status,
    ).toBe(403)
    expect(rewardHttpPorts.transactions).not.toHaveBeenCalled()
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
  it('does not turn a steward title into provider credential authority', async () => {
    expect(
      (
        await canonicalActionScope(
          () =>
            POST(
              rewardRequest('/api/integrations/shopify/credentials', 'POST', {
                secretRef: 'env://UE_SHOPIFY_SYNTHETIC',
              }),
            ),
          { role: UserRole.STEWARD },
        )
      ).status,
    ).toBe(501)
    expect(
      (
        await canonicalActionScope(
          () => DELETE(rewardRequest('/api/integrations/shopify/credentials', 'DELETE')),
          { role: UserRole.STEWARD },
        )
      ).status,
    ).toBe(501)
    expect(rewardHttpPorts.query).not.toHaveBeenCalled()
  })
})
