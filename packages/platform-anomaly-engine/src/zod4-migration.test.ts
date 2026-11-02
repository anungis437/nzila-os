import { describe, it, expect } from 'vitest'
import { anomalyRuleSchema, anomalySchema } from './types'
const rule={name:'Revenue',anomalyType:'financial_irregularity',metric:'revenue',thresholdFactor:1.5,severityMap:{warning:'medium',breach:'critical'}}
describe('Zod4 anomaly severity dictionary',()=>{
 it('accepts string-keyed severity map',()=>expect(anomalyRuleSchema.safeParse(rule).success).toBe(true))
 it('rejects invalid severities and thresholds',()=>{
  for(const change of [{severityMap:{warning:'urgent'}},{thresholdFactor:0},{anomalyType:'forged'}])
   expect(anomalyRuleSchema.safeParse({...rule,...change}).success).toBe(false)
 })
 it('preserves UUID and severity validation',()=>{
  const valid={id:'550e8400-e29b-41d4-a716-446655440000',timestamp:'2026-10-30T12:00:00Z',anomalyType:'financial_irregularity',severity:'high',app:'finance',metric:'revenue',expectedValue:10,actualValue:20,deviationFactor:2,description:'Increase',suggestedAction:'Review'}
  expect(anomalySchema.safeParse(valid).success).toBe(true)
  expect(anomalySchema.safeParse({...valid,severity:'forged'}).success).toBe(false)
 })
})
