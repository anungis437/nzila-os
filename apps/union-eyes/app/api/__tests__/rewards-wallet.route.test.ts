import { describe, expect, it } from 'vitest'
import {
  canonicalActionScope,
  rewardHttpPorts,
  rewardRequest,
} from './support/rewards-route-context'
import { GET } from '../rewards/wallet/route'
describe('wallet unavailable before financial disclosure', () => {
  it.each(['', '?limit=abc&offset=-5', '?limit=99999&offset=3'])(
    'keeps the authenticated wallet unavailable for %s',
    async (query) => {
      const response = await canonicalActionScope(() =>
        GET(rewardRequest(`/api/rewards/wallet${query}`)),
      )
      expect(response.status).toBe(501)
      expect(JSON.stringify(await response.json())).toContain('NOT_IMPLEMENTED')
      expect(rewardHttpPorts.query).not.toHaveBeenCalled()
    },
  )
})
