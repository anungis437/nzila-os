import { describe, expect, it } from 'vitest'
import { partnershipsAgent, type PartnershipsSignal } from './partnerships'

function run(input: PartnershipsSignal) {
  return partnershipsAgent.run({ orgId: 'org-1', input })
}

describe('partnershipsAgent', () => {
  it('no-signal summary when missing', async () => {
    const r = await partnershipsAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No partnerships/i)
  })

  it('flags submitted deals without reviewer past SLA', async () => {
    const r = await run({
      deals: [
        { dealId: 'd1', partnerName: 'P1', accountName: 'Acme', stage: 'submitted', estimatedArr: 100_000, daysInStage: 5, hasReviewer: false },
      ],
      commissions: [],
      reviewSlaDays: 3,
    })
    expect(r.insights.some((i) => /no Nzila reviewer/i.test(i.title))).toBe(true)
    expect(r.actions.some((a) => /Assign reviewer/i.test(a.title))).toBe(true)
  })

  it('does not flag submitted deals within SLA', async () => {
    const r = await run({
      deals: [
        { dealId: 'd1', partnerName: 'P', accountName: 'A', stage: 'submitted', estimatedArr: 100_000, daysInStage: 1, hasReviewer: false },
      ],
      commissions: [],
      reviewSlaDays: 3,
    })
    expect(r.insights.some((i) => /no Nzila reviewer/i.test(i.title))).toBe(false)
  })

  it('flags stalled deals beyond staleDays', async () => {
    const r = await run({
      deals: [
        { dealId: 'd1', partnerName: 'P', accountName: 'A', stage: 'approved', estimatedArr: 50_000, daysInStage: 30, hasReviewer: true },
      ],
      commissions: [],
      staleDays: 14,
    })
    expect(r.insights.some((i) => /stalled/i.test(i.title))).toBe(true)
  })

  it('flags deal-protection locks expiring soon', async () => {
    const r = await run({
      deals: [
        { dealId: 'd1', partnerName: 'P', accountName: 'A', stage: 'approved', estimatedArr: 50_000, daysInStage: 2, hasReviewer: true, lockedUntil: '2026-05-01', daysUntilLockExpires: 3 },
      ],
      commissions: [],
    })
    expect(r.insights.some((i) => /locks expiring/i.test(i.title))).toBe(true)
  })

  it('flags overdue earned commissions and proposes payout batch', async () => {
    const r = await run({
      deals: [],
      commissions: [
        { commissionId: 'c1', partnerName: 'P', amount: 1_000, status: 'earned', ageDays: 45 },
        { commissionId: 'c2', partnerName: 'P', amount: 500, status: 'earned', ageDays: 60 },
      ],
      commissionPaySlaDays: 30,
    })
    const crit = r.insights.find((i) => /past 30d SLA/i.test(i.title))
    expect(crit?.severity).toBe('critical')
    expect(r.actions.some((a) => /payout batch/i.test(a.title))).toBe(true)
  })

  it('healthy when nothing flagged', async () => {
    const r = await run({ deals: [], commissions: [] })
    expect(r.summary).toMatch(/healthy/i)
  })
})
