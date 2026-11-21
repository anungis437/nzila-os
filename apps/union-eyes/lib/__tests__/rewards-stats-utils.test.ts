import { describe, expect, it, vi } from 'vitest'
const query = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('unexpected credit statistics read')
  }),
)
vi.mock('@/db/db', () => ({ db: { select: query } }))
import {
  calculateRewardTotals,
  getTotalEarned,
  getTotalRedeemed,
} from '../utils/rewards-stats-utils'
describe('credit statistics follow the recorded financial deferral', () => {
  it.each([calculateRewardTotals, getTotalEarned, getTotalRedeemed])(
    'never returns a fabricated zero or real balance from unavailable statistics',
    async (operation) => {
      query.mockClear()
      await expect(
        operation('canonical-member', '11111111-1111-4111-8111-111111111111'),
      ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED', status: 501 })
      expect(query).not.toHaveBeenCalled()
    },
  )
})
