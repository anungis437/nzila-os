import { describe, it, expect } from 'vitest'

import {
  AICapabilityRegistry,
  DoctrinePolicyRegistry,
  evaluatePolicy,
  isCategoricallyRefused,
  type AICapabilityRegistration,
  type GovernancePolicy,
  type PolicyContext,
  type PolicySubject,
} from '../index'

const samplePolicy: GovernancePolicy = {
  id: 'pilot.isolation.production-read-paths',
  version: '1.0.0',
  domain: 'pilot',
  scope: { kind: 'global' },
  description: 'Pilot data must not appear on production read paths.',
  doctrineCitations: [
    { document: 'docs/nzila-ip/pilot-discipline.md' },
  ],
  conditions: [
    { field: 'context.environment', operator: 'eq', value: 'production' },
    { field: 'subject.attributes.dataOriginEnvironmentClass', operator: 'eq', value: 'pilot' },
  ],
  effect: 'deny',
  severity: 'critical',
  registeredBy: 'platform-governance-forum',
  registeredAt: '2026-05-09T12:00:00.000Z',
}

const matchingSubject: PolicySubject = {
  kind: 'route',
  id: '/cases/list',
  attributes: { dataOriginEnvironmentClass: 'pilot' },
}

const matchingContext: PolicyContext = {
  product: 'union-eyes',
  environment: 'production',
  releaseId: 'UE-2026-05-09-001',
  attributes: {},
}

describe('DoctrinePolicyRegistry', () => {
  it('registers a well-formed policy', () => {
    const reg = new DoctrinePolicyRegistry()
    expect(() => reg.register(samplePolicy)).not.toThrow()
    expect(reg.size()).toBe(1)
    expect(reg.latest(samplePolicy.id)?.version).toBe('1.0.0')
  })

  it('rejects policies without doctrine citations', () => {
    const reg = new DoctrinePolicyRegistry()
    expect(() =>
      reg.register({ ...samplePolicy, doctrineCitations: [] }),
    ).toThrow()
  })

  it('rejects double registration of the same (id, version)', () => {
    const reg = new DoctrinePolicyRegistry()
    reg.register(samplePolicy)
    expect(() => reg.register(samplePolicy)).toThrow()
  })

  it('keeps superseded versions accessible', () => {
    const reg = new DoctrinePolicyRegistry()
    reg.register(samplePolicy)
    reg.register({ ...samplePolicy, version: '1.1.0' })
    expect(reg.get(samplePolicy.id, '1.0.0')).toBeDefined()
    expect(reg.latest(samplePolicy.id)?.version).toBe('1.1.0')
  })
})

describe('evaluatePolicy', () => {
  it('returns the policy effect when all conditions match', () => {
    const out = evaluatePolicy(samplePolicy, matchingSubject, matchingContext, {
      evaluatedAt: '2026-05-09T12:00:00.000Z',
    })
    expect(out.decision).toBe('deny')
    expect(out.severity).toBe('critical')
    expect(out.doctrineCitations.length).toBeGreaterThan(0)
  })

  it('returns allow when conditions do not match (default-pass posture)', () => {
    const out = evaluatePolicy(
      samplePolicy,
      { ...matchingSubject, attributes: { dataOriginEnvironmentClass: 'production' } },
      matchingContext,
    )
    expect(out.decision).toBe('allow')
    expect(out.severity).toBe('info')
  })

  it('is deterministic given fixed timestamp', () => {
    const a = evaluatePolicy(samplePolicy, matchingSubject, matchingContext, {
      evaluatedAt: '2026-05-09T12:00:00.000Z',
    })
    const b = evaluatePolicy(samplePolicy, matchingSubject, matchingContext, {
      evaluatedAt: '2026-05-09T12:00:00.000Z',
    })
    expect(a).toEqual(b)
  })
})

describe('AICapabilityRegistry', () => {
  const validRegistration: AICapabilityRegistration = {
    capabilityId: 'ue.case.summary',
    version: '1.0.0',
    description: 'Summarize a case for governance review.',
    surfaces: ['ue/case/detail'],
    explainabilitySurface: 'ue/case/detail/ai-explanation',
    reviewabilitySurface: 'ue/governance/ai-review',
    humanAuthorityGates: ['ue.case.review.human-approval'],
    doctrineCitations: [
      { document: 'docs/nzila-governance/continuity-safe-ai-governance.md' },
    ],
    governanceReviewRecordId: 'gov-review-2026-05-09-001',
    declaredBehaviors: ['summarization'],
    registeredBy: 'ai-governance-forum',
    registeredAt: '2026-05-09T12:00:00.000Z',
  }

  it('registers a well-formed AI capability', () => {
    const reg = new AICapabilityRegistry()
    expect(() => reg.register(validRegistration)).not.toThrow()
    expect(reg.isRegistered('ue.case.summary', '1.0.0')).toBe(true)
  })

  it('rejects capabilities declaring categorically refused behaviors', () => {
    const reg = new AICapabilityRegistry()
    expect(() =>
      reg.register({
        ...validRegistration,
        declaredBehaviors: ['summarization', 'surveillance_scoring'],
      }),
    ).toThrow()
  })

  it('rejects capabilities without explainability surface', () => {
    const reg = new AICapabilityRegistry()
    expect(() =>
      reg.register({ ...validRegistration, explainabilitySurface: '' }),
    ).toThrow()
  })

  it('rejects capabilities without doctrine citations', () => {
    const reg = new AICapabilityRegistry()
    expect(() =>
      reg.register({ ...validRegistration, doctrineCitations: [] }),
    ).toThrow()
  })

  it('exposes categorical refusal predicate', () => {
    expect(isCategoricallyRefused('surveillance_scoring')).toBe(true)
    expect(isCategoricallyRefused('summarization')).toBe(false)
  })
})
