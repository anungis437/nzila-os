import { describe, it, expect } from 'vitest'
import { buildReviewQueue, DecisionLedger } from '../index'

describe('governance review', () => {
  it('records and refuses mutation of the same id', () => {
    const ledger = new DecisionLedger()
    ledger.record({
      id: 'd1',
      workflow: 'deployment-review',
      decision: 'acknowledge',
      decidedAt: '2026-05-09T12:00:00.000Z',
      reviewerRole: 'governance-officer',
      citedDoctrine: ['docs/nzila-governance-operations/executive-governance-review-workflows.md'],
      rationale: 'Routine acknowledgement.',
    })
    expect(() =>
      ledger.record({
        id: 'd1',
        workflow: 'deployment-review',
        decision: 'reject',
        decidedAt: '2026-05-09T13:00:00.000Z',
        reviewerRole: 'governance-officer',
        citedDoctrine: ['docs/x.md'],
        rationale: 'Trying to mutate.',
      }),
    ).toThrow(/append_only/)
  })

  it('requires conditions for approve_with_conditions', () => {
    const ledger = new DecisionLedger()
    expect(() =>
      ledger.record({
        id: 'd2',
        workflow: 'pilot-readiness-review',
        decision: 'approve_with_conditions',
        decidedAt: '2026-05-09T12:00:00.000Z',
        reviewerRole: 'governance-officer',
        citedDoctrine: ['docs/x.md'],
        rationale: 'Conditional approval.',
      }),
    ).toThrow()
  })

  it('supersession resolves to the new effective decision', () => {
    const ledger = new DecisionLedger()
    ledger.record({
      id: 'd3',
      workflow: 'continuity-review',
      decision: 'acknowledge',
      decidedAt: '2026-05-09T12:00:00.000Z',
      reviewerRole: 'governance-officer',
      citedDoctrine: ['docs/x.md'],
      rationale: 'Initial.',
    })
    ledger.record({
      id: 'd4',
      workflow: 'continuity-review',
      decision: 'reject',
      decidedAt: '2026-05-09T13:00:00.000Z',
      reviewerRole: 'governance-officer',
      citedDoctrine: ['docs/x.md'],
      rationale: 'Superseding.',
      supersedes: 'd3',
    })
    const eff = ledger.effective('continuity-review')
    expect(eff).toHaveLength(1)
    expect(eff[0].id).toBe('d4')
  })

  it('caps queue length to refuse escalation flooding', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `q${i}`,
      workflow: 'deployment-review' as const,
      enqueuedAt: `2026-05-09T12:00:${String(i % 60).padStart(2, '0')}.000Z`,
      summary: 's',
      citedDoctrine: ['docs/x.md'],
    }))
    expect(buildReviewQueue(items).length).toBe(25)
  })
})
