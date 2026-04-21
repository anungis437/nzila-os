import { describe, expect, it } from 'vitest'
import { grantsAgent, type GrantsSignal } from './grants'

function run(input: GrantsSignal) {
  return grantsAgent.run({ orgId: 'org-1', input })
}

describe('grantsAgent', () => {
  it('no-signal when input missing', async () => {
    const r = await grantsAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No grants/i)
  })

  it('flags missed application deadlines as critical', async () => {
    const r = await run({
      grants: [
        { grantId: 'g1', program: 'SR&ED', stage: 'drafting', amount: 100_000, applicationDueDate: '2026-01-01', daysUntilAppDue: -10 },
      ],
    })
    const miss = r.insights.find((i) => /MISSED/i.test(i.title))
    expect(miss?.severity).toBe('critical')
  })

  it('flags upcoming applications in window and auto-assigns ownerless', async () => {
    const r = await run({
      grants: [
        { grantId: 'g1', program: 'NSERC', stage: 'drafting', amount: 50_000, applicationDueDate: '2026-05-01', daysUntilAppDue: 10, owner: null },
      ],
      submissionWindowDays: 45,
    })
    expect(r.insights.some((i) => /due in 45d/i.test(i.title))).toBe(true)
    expect(r.actions.some((a) => /Assign owner/i.test(a.title))).toBe(true)
  })

  it('flags late reports as critical with urgent action', async () => {
    const r = await run({
      grants: [
        { grantId: 'g1', program: 'Prompt', stage: 'reporting', amount: 200_000, reportDueDate: '2026-02-01', daysUntilReportDue: -14 },
      ],
    })
    expect(r.insights.some((i) => /report\(s\) LATE/i.test(i.title))).toBe(true)
    expect(r.actions.some((a) => /URGENT/i.test(a.title))).toBe(true)
  })

  it('warns on upcoming reports within 7 days', async () => {
    const r = await run({
      grants: [
        { grantId: 'g1', program: 'X', stage: 'reporting', amount: 100_000, daysUntilReportDue: 5 },
      ],
      reportingWindowDays: 30,
    })
    const up = r.insights.find((i) => /due in 30d/i.test(i.title))
    expect(up?.severity).toBe('warn')
  })

  it('flags underdrawn awarded grants', async () => {
    const r = await run({
      grants: [
        { grantId: 'g1', program: 'CDAP', stage: 'awarded', amount: 100_000, drawnDownAmount: 10_000 },
      ],
    })
    expect(r.insights.some((i) => /< 50% drawn/i.test(i.title))).toBe(true)
  })

  it('clean when calendar has no issues', async () => {
    const r = await run({ grants: [] })
    expect(r.summary).toMatch(/clean/i)
  })
})
