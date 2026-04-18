import { describe, expect, it, vi } from 'vitest'
import { recordAiReviewDecision } from './business-output'

describe('recordAiReviewDecision', () => {
  it('emits reviewer decision metric for legal flow', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    recordAiReviewDecision({
      appKey: 'abr',
      orgId: 'org-legal',
      modelUsed: 'legal-risk-ranker',
      engineVersion: 'policy:abr-legal-v2',
      approved: false,
      overridden: true,
      requestId: 'decision-123',
      traceId: 'trace-123',
    })

    expect(writeSpy).toHaveBeenCalledTimes(1)

    const output = String(writeSpy.mock.calls[0]?.[0] ?? '')
    const parsed = JSON.parse(output)
    expect(parsed._type).toBe('nzila.ai.governance.metric')
    expect(parsed.appKey).toBe('abr')
    expect(parsed.orgId).toBe('org-legal')
    expect(parsed.status).toBe('rejected')
    expect(parsed.overrideRate).toBe(1)

    writeSpy.mockRestore()
  })
})
