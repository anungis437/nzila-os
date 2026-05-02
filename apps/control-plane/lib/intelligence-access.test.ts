import { describe, expect, it } from 'vitest'

import { requireIntelligenceTier, resolveIntelligenceTier } from './intelligence-access'

describe('intelligence access', () => {
  it('defaults to basic tier', () => {
    const request = new Request('https://example.test/api/intelligence/metrics')
    expect(resolveIntelligenceTier(request)).toBe('basic')
  })

  it('accepts higher tiers from headers', () => {
    const request = new Request('https://example.test/api/intelligence/policy-insights', {
      headers: { 'x-intelligence-tier': 'enterprise' },
    })
    expect(requireIntelligenceTier(request, 'pro')).toBe('enterprise')
  })

  it('rejects insufficient tier access', () => {
    const request = new Request('https://example.test/api/intelligence/benchmarks', {
      headers: { 'x-intelligence-tier': 'basic' },
    })
    expect(() => requireIntelligenceTier(request, 'enterprise')).toThrow('requires enterprise intelligence access')
  })
})