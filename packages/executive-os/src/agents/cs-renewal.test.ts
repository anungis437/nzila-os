import { describe, expect, it } from 'vitest'
import { csRenewalAgent, type CsSignal } from './cs-renewal'

function run(input: CsSignal) {
  return csRenewalAgent.run({ orgId: 'org-1', input })
}

describe('csRenewalAgent', () => {
  it('returns no-signal summary when input missing', async () => {
    const r = await csRenewalAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No CS/i)
  })

  it('flags red accounts as critical with save actions', async () => {
    const r = await run({
      accounts: [
        { customerId: 'c1', customerName: 'Acme', arr: 200_000, healthScore: 'red', usageTrend: 'down', renewalDate: '2026-08-01' },
      ],
    })
    const red = r.insights.find((i) => /RED accounts/i.test(i.title))
    expect(red?.severity).toBe('critical')
    expect(r.actions.some((a) => /Save plan: Acme/i.test(a.title))).toBe(true)
  })

  it('lists upcoming renewals in window', async () => {
    const r = await run({
      accounts: [
        { customerId: 'c1', customerName: 'A', arr: 100_000, healthScore: 'green', daysUntilRenewal: 45 },
        { customerId: 'c2', customerName: 'B', arr: 50_000, healthScore: 'yellow', daysUntilRenewal: 120 },
      ],
      renewalWindowDays: 90,
    })
    const renew = r.insights.find((i) => /renewals in 90d/i.test(i.title))
    expect(renew).toBeDefined()
    expect(renew?.body).toContain('A')
    expect(renew?.body).not.toContain('B ·') // outside window
  })

  it('flags quiet at-risk accounts', async () => {
    const r = await run({
      accounts: [
        { customerId: 'c1', customerName: 'Q', arr: 100_000, healthScore: 'yellow', lastTouchDaysAgo: 40 },
      ],
      quietTouchDays: 21,
    })
    expect(r.insights.some((i) => /untouched/i.test(i.title))).toBe(true)
    expect(r.actions.some((a) => /check-in email/i.test(a.title))).toBe(true)
  })

  it('surfaces expansion opportunities', async () => {
    const r = await run({
      accounts: [
        { customerId: 'c1', customerName: 'Grow', arr: 100_000, healthScore: 'green', expansionSignal: true, usageTrend: 'up' },
      ],
    })
    expect(r.insights.some((i) => /expansion/i.test(i.title))).toBe(true)
  })

  it('healthy when no red, no upcoming, no quiet', async () => {
    const r = await run({
      accounts: [
        { customerId: 'c1', customerName: 'OK', arr: 100_000, healthScore: 'green' },
      ],
    })
    expect(r.summary).toMatch(/healthy/i)
  })
})
