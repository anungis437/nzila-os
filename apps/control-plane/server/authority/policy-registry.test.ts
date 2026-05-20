import { beforeEach, describe, expect, it } from 'vitest'

import {
  __resetRegistryForTests,
  evaluateWorkflowPolicy,
  getPolicyForWorkflow,
  listRegisteredPolicies,
  registerWorkflowPolicy,
  type PolicyEvaluationContext,
  type WorkflowPolicy,
} from './policy-registry'

const ORG = '00000000-0000-0000-0000-000000000001'

const basePolicy: WorkflowPolicy = {
  id: 'commerce.invoice.send',
  version: '1.0.0',
  domain: 'commerce',
  workflowIds: ['commerce.invoice.send'],
  allowedActions: ['workflow.trigger'],
  allowedActorTypes: ['user', 'service'],
  allowedRoles: ['admin', 'billing'],
  approvalRequiredRoles: ['analyst'],
  approverRoles: ['admin'],
  rationale: 'Outbound invoice send must be governed by finance authority.',
}

function ctx(overrides: Partial<PolicyEvaluationContext> = {}): PolicyEvaluationContext {
  return {
    workflowId: 'commerce.invoice.send',
    orgId: ORG,
    action: 'workflow.trigger',
    resourceType: 'workflow',
    resourceId: 'commerce.invoice.send',
    actor: { actorId: 'user_1', actorType: 'user', orgId: ORG },
    actorRole: 'admin',
    payload: {},
    executionContext: { dryRun: false, priority: 'normal' },
    ...overrides,
  }
}

describe('policy-registry', () => {
  beforeEach(() => {
    __resetRegistryForTests()
  })

  it('denies workflows with no registered policy', () => {
    const result = evaluateWorkflowPolicy(ctx())
    expect(result.policy).toBeNull()
    expect(result.decision.decision).toBe('denied')
    expect(result.decision.reasonCode).toBe('NO_POLICY_REGISTERED')
  })

  it('registers and looks up policies by workflowId', () => {
    registerWorkflowPolicy(basePolicy)
    expect(getPolicyForWorkflow('commerce.invoice.send')?.id).toBe(basePolicy.id)
    expect(listRegisteredPolicies()).toHaveLength(1)
  })

  it('rejects unsupported domains', () => {
    expect(() =>
      registerWorkflowPolicy({ ...basePolicy, domain: 'martian' as 'commerce' }),
    ).toThrow(/unsupported domain/)
  })

  it('rejects conflicting registrations for the same workflowId', () => {
    registerWorkflowPolicy(basePolicy)
    expect(() =>
      registerWorkflowPolicy({ ...basePolicy, id: 'other.policy', version: '1.0.0' }),
    ).toThrow(/Conflicting policies/)
  })

  it('denies disallowed actor types', () => {
    registerWorkflowPolicy(basePolicy)
    const result = evaluateWorkflowPolicy(
      ctx({ actor: { actorId: 'system', actorType: 'break_glass', orgId: ORG } }),
    )
    expect(result.decision.decision).toBe('denied')
    expect(result.decision.reasonCode).toBe('ACTOR_TYPE_NOT_PERMITTED')
  })

  it('denies actions not declared by the policy', () => {
    registerWorkflowPolicy(basePolicy)
    const result = evaluateWorkflowPolicy(ctx({ action: 'workflow.cancel' }))
    expect(result.decision.decision).toBe('denied')
    expect(result.decision.reasonCode).toBe('ACTION_NOT_PERMITTED')
  })

  it('denies roles not present in allowedRoles or approvalRequiredRoles', () => {
    registerWorkflowPolicy(basePolicy)
    const result = evaluateWorkflowPolicy(ctx({ actorRole: 'reader' }))
    expect(result.decision.decision).toBe('denied')
    expect(result.decision.reasonCode).toBe('ROLE_NOT_PERMITTED')
  })

  it('returns approval_required for approval roles', () => {
    registerWorkflowPolicy(basePolicy)
    const result = evaluateWorkflowPolicy(ctx({ actorRole: 'analyst' }))
    expect(result.decision.decision).toBe('approval_required')
    expect(result.decision.reasonCode).toBe('APPROVAL_REQUIRED_BY_ROLE')
    expect(result.decision.approverRoles).toEqual(['admin'])
  })

  it('allows when actor type, action, and role all permitted', () => {
    registerWorkflowPolicy(basePolicy)
    const result = evaluateWorkflowPolicy(ctx())
    expect(result.decision.decision).toBe('allowed')
    expect(result.decision.reasonCode).toBe('POLICY_PERMITTED')
    expect(result.policy?.id).toBe(basePolicy.id)
  })

  it('honors a custom evaluator override', () => {
    registerWorkflowPolicy({
      ...basePolicy,
      evaluate: (c) =>
        c.payload['highRisk'] === true
          ? { decision: 'denied', reasonCode: 'HIGH_RISK_PAYLOAD', explanation: 'risky' }
          : undefined,
    })
    const allowed = evaluateWorkflowPolicy(ctx())
    expect(allowed.decision.decision).toBe('allowed')

    const denied = evaluateWorkflowPolicy(ctx({ payload: { highRisk: true } }))
    expect(denied.decision.decision).toBe('denied')
    expect(denied.decision.reasonCode).toBe('HIGH_RISK_PAYLOAD')
  })
})
