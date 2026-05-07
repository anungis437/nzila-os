import { describe, expect, it } from 'vitest'
import { buildTrustOpsView, type RegisterRiskLike } from './index'

const NOW = new Date('2026-01-01T00:00:00.000Z')

describe('buildTrustOpsView', () => {
  it('filters out non-open risks and sorts by severity desc', () => {
    const risks: RegisterRiskLike[] = [
      { id: 'a', title: 'A', category: 'data', severity: 'low', status: 'open' },
      { id: 'b', title: 'B', category: 'data', severity: 'critical', status: 'closed' },
      { id: 'c', title: 'C', category: 'data', severity: 'high', status: 'mitigating' },
      { id: 'd', title: 'D', category: 'data', severity: 'medium', status: 'accepted' },
    ]
    const view = buildTrustOpsView(risks, NOW)
    expect(view.openRisks.map((r) => r.id)).toEqual(['c', 'a'])
    expect(view.tasks.map((t) => t.riskId)).toEqual(['c', 'a'])
  })

  it('produces a 100/compliant score when no open risks have deductions', () => {
    const view = buildTrustOpsView(
      [{ id: 'x', title: 'X', category: 'data', severity: 'low', status: 'open' }],
      NOW,
    )
    expect(view.score.score).toBe(100)
    expect(view.score.status).toBe('compliant')
  })

  it('aggregates deductions per category', () => {
    const view = buildTrustOpsView(
      [
        { id: 'r1', title: 'R1', category: 'incidents', severity: 'high', status: 'open', deduction: 25 },
        { id: 'r2', title: 'R2', category: 'data', severity: 'medium', status: 'open', deduction: 10 },
      ],
      NOW,
    )
    expect(view.score.perCategory.incidents).toBe(25)
    expect(view.score.perCategory.data).toBe(10)
    expect(view.score.score).toBe(65)
    expect(view.score.status).toBe('at-risk')
  })

  it('maps cross-cutting categories (security/legal/etc.) into governance bucket', () => {
    const view = buildTrustOpsView(
      [
        { id: 's', title: 'sec', category: 'security', severity: 'high', status: 'open', deduction: 10 },
        { id: 'l', title: 'leg', category: 'legal', severity: 'high', status: 'open', deduction: 5 },
      ],
      NOW,
    )
    expect(view.score.perCategory.governance).toBe(15)
  })

  it('honors hasBlockingRisks → at-risk even with perfect score', () => {
    const view = buildTrustOpsView(
      [{ id: 'b', title: 'B', category: 'data', severity: 'low', status: 'open', blocking: true }],
      NOW,
    )
    expect(view.score.score).toBe(100)
    expect(view.score.status).toBe('at-risk')
  })

  it('emits one task per open risk with correct priority/SLA', () => {
    const view = buildTrustOpsView(
      [{ id: 'r', title: 'crit', category: 'data', severity: 'critical', status: 'open' }],
      NOW,
    )
    expect(view.tasks).toEqual([
      { riskId: 'r', title: 'crit', priority: 'p0', dueAt: '2026-01-02T00:00:00.000Z' },
    ])
  })
})
