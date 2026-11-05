import { describe, expect, it } from 'vitest'
import { shouldSuppressClaimMetrics, shouldSuppressMemberMetrics } from '../analytics-privacy'

describe('organization analytics small-group privacy', () => {
  it('publishes complete, non-identifying membership groups', () => {
    expect(shouldSuppressMemberMetrics({ total: 30, active: 20, new_this_month: 10, prev: 20 })).toBe(false)
  })

  it('suppresses a small organization and a small member subgroup', () => {
    expect(shouldSuppressMemberMetrics({ total: 4, active: 4, new_this_month: 0, prev: 4 })).toBe(true)
    expect(shouldSuppressMemberMetrics({ total: 30, active: 20, new_this_month: 2, prev: 28 })).toBe(true)
  })

  it('suppresses complementary cells even if the displayed cell is large', () => {
    expect(shouldSuppressMemberMetrics({ total: 30, active: 28, new_this_month: 10, prev: 20 })).toBe(true)
    expect(shouldSuppressClaimMetrics(
      { total: 20, active: 18, resolved: 2, this_month: 10 },
      { open: 18, closed: 2 },
    )).toBe(true)
  })

  it('suppresses status groups of fewer than five and inconsistent totals', () => {
    expect(shouldSuppressClaimMetrics(
      { total: 20, active: 10, resolved: 10, this_month: 10 },
      { open: 10, closed: 9, withdrawn: 1 },
    )).toBe(true)
    expect(shouldSuppressClaimMetrics(
      { total: 20, active: 10, resolved: 10, this_month: 10 },
      { open: 10, closed: 9 },
    )).toBe(true)
  })

  it('publishes only complete claim groups of sufficient size', () => {
    expect(shouldSuppressClaimMetrics(
      { total: 20, active: 10, resolved: 10, this_month: 6 },
      { open: 10, closed: 10 },
    )).toBe(false)
  })

  it('does not turn absent data into fabricated measurements', () => {
    expect(shouldSuppressMemberMetrics({ total: 0, active: 0, new_this_month: 0, prev: 0 })).toBe(false)
    expect(shouldSuppressClaimMetrics(
      { total: 0, active: 0, resolved: 0, this_month: 0 },
      {},
    )).toBe(false)
    expect(shouldSuppressMemberMetrics({ total: 10, active: Number.NaN, new_this_month: 0, prev: 10 })).toBe(true)
  })
})
