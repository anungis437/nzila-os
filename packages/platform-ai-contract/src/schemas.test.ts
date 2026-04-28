import { describe, expect, it } from 'vitest'
import {
  createFallbackOutput,
  hasRequiredBaseFields,
  isValidAIOutput,
  isValidConfidenceScore,
} from './schemas.js'

describe('platform-ai-contract schemas', () => {
  it('validates confidence score bounds', () => {
    expect(isValidConfidenceScore(0)).toBe(true)
    expect(isValidConfidenceScore(0.5)).toBe(true)
    expect(isValidConfidenceScore(1)).toBe(true)

    expect(isValidConfidenceScore(-0.01)).toBe(false)
    expect(isValidConfidenceScore(1.01)).toBe(false)
    expect(isValidConfidenceScore('0.5')).toBe(false)
  })

  it('checks required base fields', () => {
    const validBase = {
      confidence_score: 0.8,
      evidence_refs: ['ev-1'],
      engine_version: 'v1',
      review_required: false,
      org_id: 'org-1',
      generated_at: new Date().toISOString(),
    }

    expect(hasRequiredBaseFields(validBase)).toBe(true)
    expect(
      hasRequiredBaseFields({
        ...validBase,
        evidence_refs: 'not-an-array',
      }),
    ).toBe(false)
  })

  it('validates complete AI output objects', () => {
    const validInsight = {
      type: 'insight',
      confidence_score: 0.9,
      evidence_refs: ['ev-1'],
      engine_version: 'v2',
      review_required: false,
      org_id: 'org-1',
      generated_at: new Date().toISOString(),
      category: 'trend',
      title: 'Trend detected',
      description: 'Costs are rising',
      affected_entities: ['dept-1'],
    }

    expect(isValidAIOutput(validInsight)).toBe(true)
    expect(isValidAIOutput({ ...validInsight, type: 'invalid-type' })).toBe(false)
    expect(isValidAIOutput(null)).toBe(false)
  })

  it('creates safe fallback outputs for each AI type', () => {
    const types = ['insight', 'anomaly', 'decision', 'recommendation'] as const

    for (const type of types) {
      const out = createFallbackOutput(type, 'org-123', 'engine-v3')
      expect(out.type).toBe(type)
      expect(out.org_id).toBe('org-123')
      expect(out.engine_version).toBe('engine-v3')
      expect(out.confidence_score).toBe(0)
      expect(out.review_required).toBe(true)
      expect(Array.isArray(out.evidence_refs)).toBe(true)
      expect(isValidAIOutput(out)).toBe(true)
    }
  })
})