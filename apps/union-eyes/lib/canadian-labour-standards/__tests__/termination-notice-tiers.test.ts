import { describe, expect, it } from 'vitest'
import { TERMINATION_NOTICE, calculateTerminationNotice } from '../termination-notice'
import type { CanadianJurisdiction } from '../types'

// DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS
describe('termination notice schedules', () => {
  const jurisdictions = Object.keys(TERMINATION_NOTICE) as CanadianJurisdiction[]

  it.each(jurisdictions)('%s has an open-ended top tier, so a long tenure never owes nothing', (jurisdiction) => {
    const tiers = TERMINATION_NOTICE[jurisdiction].tiers
    expect(tiers[tiers.length - 1]!.maxYears).toBeNull()
  })

  it.each(jurisdictions)('%s tiers are contiguous and never decrease', (jurisdiction) => {
    const tiers = TERMINATION_NOTICE[jurisdiction].tiers
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i]!.minYears).toBe(tiers[i - 1]!.maxYears)
      expect(tiers[i]!.weeksNotice).toBeGreaterThanOrEqual(tiers[i - 1]!.weeksNotice)
    }
  })

  it.each([8, 10, 25])('British Columbia requires the maximum notice at %s years of service', (years) => {
    expect(calculateTerminationNotice('BC', years).weeks).toBe(8)
  })
})
