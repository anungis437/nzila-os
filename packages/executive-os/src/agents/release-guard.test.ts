import { describe, expect, it } from 'vitest'
import { releaseGuardAgent, type ReleaseGuardSignal } from './release-guard'

function run(input: ReleaseGuardSignal) {
  return releaseGuardAgent.run({ orgId: 'org-1', input })
}

function change(partial: Partial<ReleaseGuardSignal['changes'][number]>) {
  return {
    changeId: 'c1',
    changeNumber: 'CHG-001',
    title: 'T',
    status: 'proposed' as const,
    riskLevel: 'low' as const,
    approversRequired: 0,
    approversReceived: 0,
    hasRollbackPlan: true,
    checklistTotal: 0,
    checklistDone: 0,
    ageDays: 1,
    ...partial,
  }
}

describe('releaseGuardAgent', () => {
  it('no-signal when missing', async () => {
    const r = await releaseGuardAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No release-guard/i)
  })

  it('flags missing approvers', async () => {
    const r = await run({
      changes: [change({ status: 'under_review', approversRequired: 2, approversReceived: 1 })],
    })
    expect(r.insights.some((i) => /missing approvers/i.test(i.title))).toBe(true)
  })

  it('flags high-risk change without rollback plan as critical', async () => {
    const r = await run({
      changes: [change({ riskLevel: 'high', hasRollbackPlan: false, status: 'approved' })],
    })
    const crit = r.insights.find((i) => /missing rollback/i.test(i.title))
    expect(crit?.severity).toBe('critical')
    expect(r.actions.some((a) => /Require rollback/i.test(a.title))).toBe(true)
  })

  it('flags incomplete checklist on active changes', async () => {
    const r = await run({
      changes: [change({ status: 'implementing', checklistTotal: 5, checklistDone: 2 })],
    })
    expect(r.insights.some((i) => /incomplete checklist/i.test(i.title))).toBe(true)
  })

  it('flags stale proposed changes', async () => {
    const r = await run({
      changes: [change({ status: 'proposed', ageDays: 14 })],
      staleProposedDays: 7,
    })
    expect(r.insights.some((i) => /stale > 7d/i.test(i.title))).toBe(true)
  })

  it('clean when nothing flagged', async () => {
    const r = await run({ changes: [] })
    expect(r.summary).toMatch(/clean/i)
  })
})
