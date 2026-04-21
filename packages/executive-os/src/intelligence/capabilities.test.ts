import { describe, it, expect, beforeEach } from 'vitest'
import { getCapability, unregisterCapability } from '@nzila/intelligence'
import { EXECUTIVE_CAPABILITIES, registerExecutiveCapabilities } from './capabilities'

describe('registerExecutiveCapabilities', () => {
  beforeEach(() => {
    for (const c of EXECUTIVE_CAPABILITIES) {
      unregisterCapability(c.id)
    }
  })

  it('registers all executive capabilities exactly once', () => {
    const result = registerExecutiveCapabilities()
    expect(result.registered).toHaveLength(EXECUTIVE_CAPABILITIES.length)
    expect(result.skipped).toHaveLength(0)
    for (const cap of EXECUTIVE_CAPABILITIES) {
      expect(getCapability(cap.id)).toBeDefined()
    }
  })

  it('is idempotent — re-registration skips existing ids', () => {
    registerExecutiveCapabilities()
    const second = registerExecutiveCapabilities()
    expect(second.registered).toHaveLength(0)
    expect(second.skipped).toHaveLength(EXECUTIVE_CAPABILITIES.length)
  })

  it('core capability ids are present', () => {
    registerExecutiveCapabilities()
    const ids = [
      'executive-priority-ranking',
      'cross-domain-risk-scan',
      'opportunity-ranking',
      'weekly-ceo-brief-v2',
      'recommendation-retrospective',
      'focus-allocation-v2',
      'founder-capacity-analysis',
    ]
    for (const id of ids) {
      expect(getCapability(id)).toBeDefined()
    }
  })
})
