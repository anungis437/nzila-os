import { describe, expect, it } from 'vitest'
import { policyConditionSchema, policyDefinitionSchema, policyFileSchema } from './types'
const valid = { id: 'policy-1', name: 'Access', version: '1', type: 'access', description: 'Protect resources', enabled: true, scope: { orgId: '550e8400-e29b-41d4-a716-446655440000' }, rules: [{ id: 'rule-1', description: 'Role required', conditions: [{ field: 'actor.role', operator: 'eq', value: 'admin' }], effect: 'deny', severity: 'critical' }] }
describe('Zod 4 policy DSL compatibility', () => {
  it('retains optional condition values and default metadata', () => {
    expect(policyConditionSchema.parse({ field: 'actor.role', operator: 'eq' })).toEqual({ field: 'actor.role', operator: 'eq' })
    expect(policyDefinitionSchema.parse(valid).metadata).toEqual({})
  })
  it('parses nested policy files with explicit conditions', () => {
    expect(policyFileSchema.parse({ version: '1', lastUpdated: '2026-11-02', policies: [valid] }).policies[0]?.rules[0]?.effect).toBe('deny')
  })
  it('rejects unknown operators, invalid tenants, and invalid policy effects', () => {
    expect(policyConditionSchema.safeParse({ field: 'actor.role', operator: 'grant', value: 'admin' }).success).toBe(false)
    expect(policyDefinitionSchema.safeParse({ ...valid, scope: { orgId: 'tenant-other' } }).success).toBe(false)
    expect(policyDefinitionSchema.safeParse({ ...valid, rules: [{ ...valid.rules[0], effect: 'bypass' }] }).success).toBe(false)
    expect(policyDefinitionSchema.safeParse({ ...valid, metadata: ['not-a-record'] }).success).toBe(false)
  })
})
