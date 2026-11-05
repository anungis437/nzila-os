const fs = require('fs')
const f = 'lib/canadian-labour-standards/termination-notice.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const a = `      { minYears: 7, maxYears: 8, weeksNotice: 8 },
    ],
  },
  AB: {`
if (!s.includes(a)) throw new Error('anchor')
s = s.replace(a, `      { minYears: 7, maxYears: 8, weeksNotice: 8 },
      // The statutory maximum is eight weeks; the schedule had no tier above eight years, so a longer tenure matched none and owed nothing.
      { minYears: 8, maxYears: null, weeksNotice: 8 },
    ],
  },
  AB: {`)
fs.writeFileSync(f, s)
fs.mkdirSync('lib/canadian-labour-standards/__tests__', { recursive: true })
fs.writeFileSync('lib/canadian-labour-standards/__tests__/termination-notice-tiers.test.ts', `import { describe, expect, it } from 'vitest'
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
`)
console.log('ok')
