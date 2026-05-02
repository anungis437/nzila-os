import { describe, expect, it } from 'vitest'
import { detectDecisionDrift, replayDecision } from '..'

describe('decision replay and drift detection', () => {
  it('replays a decision against a locked policy version', async () => {
    const replay = await replayDecision({
      decisionType: 'flow.vendor.selected',
      organizationId: 'org-1',
      resourceId: 'selection-1',
      actor: {
        id: 'user-1',
        type: 'user',
        authorityScope: ['vendor:select'],
      },
      authorityScope: ['vendor:select'],
      input: {
        vendorId: 'vendor-1',
        quoteId: 'quote-1',
      },
      policyVersion: '1.0.0',
    })

    expect(replay.matchedPolicyId).toBe('commerce.vendor.selection')
    expect(replay.replayed.allowed).toBe(true)
  })

  it('detects outcome drift between baseline and candidate replays', async () => {
    const baseline = await replayDecision({
      decisionType: 'flow.quote.created',
      organizationId: 'org-1',
      resourceId: 'quote-1',
      actor: {
        id: 'user-1',
        type: 'user',
        authorityScope: ['quote:create'],
      },
      authorityScope: ['quote:create'],
      input: {
        title: 'Test',
        customerId: 'cust-1',
      },
      policyVersion: '1.0.0',
    })

    const candidate = await replayDecision({
      decisionType: 'flow.quote.created',
      organizationId: 'org-1',
      resourceId: 'quote-1',
      actor: {
        id: 'user-1',
        type: 'user',
        authorityScope: [],
      },
      authorityScope: [],
      input: {
        title: 'Test',
        customerId: 'cust-1',
      },
      policyVersion: '2.0.0',
    })

    const drift = detectDecisionDrift({ baseline, candidate })
    expect(drift.drifted).toBe(true)
  })
})
