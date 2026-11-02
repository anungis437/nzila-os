import { describe, expect, it } from 'vitest'
import { RiskClassificationSchema } from './risk-classification.js'
import { GovernanceEventSchema } from './governance-lifecycle.js'
import { CarbonEstimateInputSchema } from './carbon-tracking.js'

describe('Zod 4 AI registry validation compatibility', () => {
  const risk={modelId:'m1',overallScore:50,riskLevel:'high',factors:[],
    requiredControls:['audit-logging'],classifiedAt:'2026-11-02T00:00:00.000Z',classifiedBy:'reviewer'}
  it('preserves risk bounds and classification identity', () => {
    expect(RiskClassificationSchema.parse(risk).modelId).toBe('m1')
    expect(RiskClassificationSchema.safeParse({...risk,overallScore:101}).success).toBe(false)
    expect(RiskClassificationSchema.safeParse({...risk,riskLevel:'unclassified'}).success).toBe(false)
  })
  it('retains explicit approval history defaults and rejects invalid lifecycle states', () => {
    const event={modelId:'m1',fromState:'draft',toState:'review',actor:'reviewer',
      actorRole:'ai_developer',reason:'Review',riskTier:'low',timestamp:'2026-11-02T00:00:00.000Z'}
    expect(GovernanceEventSchema.parse(event).approvers).toEqual([])
    expect(GovernanceEventSchema.safeParse({...event,toState:'unknown'}).success).toBe(false)
    expect(GovernanceEventSchema.safeParse({...event,approvers:'reviewer'}).success).toBe(false)
  })
  it('rejects malformed token budgets and preserves valid inputs', () => {
    const input={modelId:'m1',totalTokens:100}
    expect(CarbonEstimateInputSchema.safeParse(input).success).toBe(true)
    expect(CarbonEstimateInputSchema.safeParse({...input,totalTokens:-1}).success).toBe(false)
    expect(CarbonEstimateInputSchema.safeParse({...input,totalTokens:'100'}).success).toBe(false)
  })
})
