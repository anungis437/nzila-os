/**
 * @nzila/platform-policy-engine — Evaluator Tests
 */
import { describe, it, expect } from 'vitest'
import { evaluatePolicy, evaluatePolicies, isBlocked, requiresApproval } from '../evaluator'
import type { PolicyDefinition, PolicyEvaluationInput } from '../types'

const basePolicy: PolicyDefinition = {
  id: 'test-policy',
  name: 'Test Policy',
  version: '1.0',
  type: 'approval',
  description: 'Test policy',
  enabled: true,
  scope: { environments: ['prod'] },
  rules: [
    {
      id: 'high-value',
      description: 'Block high-value actions',
      conditions: [
        { field: 'context.amount', operator: 'gt', value: 10000 },
      ],
      effect: 'deny',
      severity: 'critical',
    },
    {
      id: 'medium-value',
      description: 'Require approval for medium values',
      conditions: [
        { field: 'context.amount', operator: 'gt', value: 1000 },
        { field: 'context.amount', operator: 'lte', value: 10000 },
      ],
      effect: 'require_approval',
      severity: 'warning',
      requireApprovers: 1,
      approverRoles: ['finance_admin'],
    },
  ],
  metadata: {},
}

const baseInput: PolicyEvaluationInput = {
  policyId: 'test-policy',
  actor: { userId: 'user-1', roles: ['member'] },
  action: 'payout.create',
  resource: '/api/finance/payouts',
  context: { amount: 500 },
  orgId: '00000000-0000-0000-0000-000000000001',
  environment: 'prod',
}

describe('evaluatePolicy', () => {
  it('passes when no conditions are met', () => {
    const result = evaluatePolicy(basePolicy, baseInput)
    expect(result.overallResult).toBe('pass')
    expect(result.decisions).toHaveLength(0)
  })

  it('denies when high-value condition is met', () => {
    const input = { ...baseInput, context: { amount: 50000 } }
    const result = evaluatePolicy(basePolicy, input)
    expect(result.overallResult).toBe('fail')
    expect(result.decisions).toHaveLength(1)
    expect(result.decisions[0].ruleId).toBe('high-value')
  })

  it('requires approval for medium values', () => {
    const input = { ...baseInput, context: { amount: 5000 } }
    const result = evaluatePolicy(basePolicy, input)
    expect(result.overallResult).toBe('require_approval')
    expect(result.decisions[0].requireApprovers).toBe(1)
  })

  it('skips policy when environment is out of scope', () => {
    const input = { ...baseInput, environment: 'dev' }
    const result = evaluatePolicy(basePolicy, input)
    expect(result.overallResult).toBe('pass')
    expect(result.decisions).toHaveLength(0)
  })
})

describe('evaluatePolicies', () => {
  it('evaluates multiple policies', () => {
    const policies = [basePolicy, { ...basePolicy, id: 'policy-2' }]
    const input = { ...baseInput, context: { amount: 50000 } }
    const results = evaluatePolicies(policies, input)
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.overallResult === 'fail')).toBe(true)
  })

  it('skips disabled policies', () => {
    const policies = [
      basePolicy,
      { ...basePolicy, id: 'disabled-policy', enabled: false },
    ]
    const results = evaluatePolicies(policies, { ...baseInput, context: { amount: 50000 } })
    expect(results).toHaveLength(1)
    expect(results[0].policyId).toBe('test-policy')
  })
})

describe('isBlocked / requiresApproval', () => {
  it('detects blocked actions', () => {
    const input = { ...baseInput, context: { amount: 50000 } }
    const results = evaluatePolicies([basePolicy], input)
    expect(isBlocked(results)).toBe(true)
    expect(requiresApproval(results)).toBe(false)
  })

  it('detects approval-required actions', () => {
    const input = { ...baseInput, context: { amount: 5000 } }
    const results = evaluatePolicies([basePolicy], input)
    expect(isBlocked(results)).toBe(false)
    expect(requiresApproval(results)).toBe(true)
  })

  it('returns false when there are no outputs', () => {
    expect(isBlocked([])).toBe(false)
    expect(requiresApproval([])).toBe(false)
  })
})

describe('condition operators and scope rules', () => {
  it('evaluates all condition operators and allow effect', () => {
    const operatorPolicy: PolicyDefinition = {
      ...basePolicy,
      id: 'operator-policy',
      scope: {
        orgId: '00000000-0000-0000-0000-000000000001',
        environments: ['prod'],
        resources: ['/api/finance'],
      },
      rules: [
        {
          id: 'eq-rule',
          description: 'eq',
          conditions: [{ field: 'context.region', operator: 'eq', value: 'ZA' }],
          effect: 'allow',
          severity: 'info',
        },
        {
          id: 'neq-rule',
          description: 'neq',
          conditions: [{ field: 'context.currency', operator: 'neq', value: 'USD' }],
          effect: 'allow',
          severity: 'info',
        },
        {
          id: 'gte-rule',
          description: 'gte',
          conditions: [{ field: 'context.amount', operator: 'gte', value: 100 }],
          effect: 'allow',
          severity: 'info',
        },
        {
          id: 'lt-rule',
          description: 'lt',
          conditions: [{ field: 'context.amount', operator: 'lt', value: 1000 }],
          effect: 'allow',
          severity: 'info',
        },
        {
          id: 'in-rule',
          description: 'in',
          conditions: [{ field: 'actor.orgRole', operator: 'in', value: ['owner', 'finance'] }],
          effect: 'allow',
          severity: 'info',
        },
        {
          id: 'not-in-rule',
          description: 'not_in',
          conditions: [{ field: 'context.channel', operator: 'not_in', value: ['legacy'] }],
          effect: 'allow',
          severity: 'info',
        },
        {
          id: 'matches-rule',
          description: 'matches',
          conditions: [{ field: 'action', operator: 'matches', value: '^payout\\.' }],
          effect: 'allow',
          severity: 'info',
        },
      ],
    }

    const input: PolicyEvaluationInput = {
      ...baseInput,
      actor: { ...baseInput.actor, orgRole: 'finance' },
      context: {
        amount: 500,
        region: 'ZA',
        currency: 'ZAR',
        channel: 'web',
      },
      resource: '/api/finance/payouts/1',
      orgId: '00000000-0000-0000-0000-000000000001',
      environment: 'prod',
    }

    const result = evaluatePolicy(operatorPolicy, input)
    expect(result.decisions.length).toBe(7)
    expect(result.overallResult).toBe('pass')
  })

  it('skips policy when org or resource scope is not applicable', () => {
    const scopedPolicy: PolicyDefinition = {
      ...basePolicy,
      scope: {
        orgId: '00000000-0000-0000-0000-000000000099',
        environments: ['prod'],
        resources: ['/api/admin'],
      },
    }

    const result = evaluatePolicy(scopedPolicy, baseInput)
    expect(result.decisions).toHaveLength(0)
    expect(result.overallResult).toBe('pass')
  })
})
