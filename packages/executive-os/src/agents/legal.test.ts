import { describe, expect, it } from 'vitest'
import { legalAgent, type LegalSignal } from './legal.js'

function run(input: LegalSignal) {
  return legalAgent.run({ orgId: 'o1', input })
}

describe('legalAgent', () => {
  it('no-signal', async () => {
    const r = await legalAgent.run({ orgId: 'o1' })
    expect(r.summary).toMatch(/No legal/i)
  })

  it('flags overdue filings as critical with actions', async () => {
    const r = await run({
      filings: [
        { filingId: 'f1', kind: 'annual_return', status: 'pending', dueDate: '2026-01-01', daysUntilDue: -30 },
      ],
      tasks: [],
      governanceActions: [],
    })
    expect(r.insights.find((i) => /overdue statutory/i.test(i.title))?.severity).toBe('critical')
    expect(r.actions.some((a) => /File overdue/i.test(a.title))).toBe(true)
  })

  it('warns on filings due soon', async () => {
    const r = await run({
      filings: [
        { filingId: 'f2', kind: 'director_change', status: 'pending', dueDate: '2026-05-01', daysUntilDue: 10 },
      ],
      tasks: [],
      governanceActions: [],
      warnDays: 14,
    })
    expect(r.insights.some((i) => /due within 14d/i.test(i.title))).toBe(true)
  })

  it('flags overdue and blocked compliance tasks', async () => {
    const r = await run({
      filings: [],
      tasks: [
        { taskId: 't1', title: 'YE close', kind: 'year_end', status: 'open', dueDate: '2026-03-31', daysUntilDue: -5, hasEvidence: false },
        { taskId: 't2', title: 'Gov review', kind: 'governance', status: 'blocked', dueDate: '2026-05-01', daysUntilDue: 10, hasEvidence: false },
      ],
      governanceActions: [],
    })
    expect(r.insights.some((i) => /overdue compliance/i.test(i.title))).toBe(true)
    expect(r.insights.some((i) => /blocked/i.test(i.title))).toBe(true)
  })

  it('flags completed tasks missing evidence', async () => {
    const r = await run({
      filings: [],
      tasks: [
        { taskId: 't3', title: 'Month close', kind: 'month_close', status: 'done', dueDate: '2026-04-01', daysUntilDue: -1, hasEvidence: false },
      ],
      governanceActions: [],
    })
    expect(r.insights.some((i) => /missing evidence/i.test(i.title))).toBe(true)
  })

  it('flags stuck governance approvals', async () => {
    const r = await run({
      filings: [],
      tasks: [],
      governanceActions: [
        { actionId: 'g1', actionType: 'elect_directors', status: 'pending_approval', ageDays: 30 },
      ],
      stuckApprovalDays: 14,
    })
    expect(r.insights.some((i) => /stuck in approval/i.test(i.title))).toBe(true)
  })

  it('clear when nothing flagged', async () => {
    const r = await run({ filings: [], tasks: [], governanceActions: [] })
    expect(r.summary).toMatch(/clear/i)
  })
})
