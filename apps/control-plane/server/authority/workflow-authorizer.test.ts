import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const recordDecisionEvent = vi.fn()
  const resolveEntitlements = vi.fn()
  const recordAuditEvent = vi.fn(async () => undefined)
  return { recordDecisionEvent, resolveEntitlements, recordAuditEvent }
})

vi.mock('./decision', () => ({ recordDecisionEvent: mocks.recordDecisionEvent }))
vi.mock('./entitlements', () => ({ resolveEntitlements: mocks.resolveEntitlements }))
vi.mock('@/lib/audit-db', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
  AUDIT_ACTIONS: { WORKFLOW_TRIGGERED: 'workflow.triggered' },
}))

import type { WorkflowTriggerRequest } from '@nzila/platform-contracts/control-system'

import {
  __resetRegistryForTests,
  registerWorkflowPolicy,
  type WorkflowPolicy,
} from './policy-registry'
import { authorizeWorkflowTrigger } from './workflow-authorizer'

const ORG = '00000000-0000-0000-0000-000000000001'
const REQ = '11111111-1111-1111-1111-111111111111'

const policy: WorkflowPolicy = {
  id: 'commerce.invoice.send',
  version: '1.0.0',
  domain: 'commerce',
  workflowIds: ['commerce.invoice.send'],
  allowedActions: ['workflow.trigger'],
  allowedActorTypes: ['user', 'service'],
  allowedRoles: ['admin'],
  approvalRequiredRoles: ['analyst'],
  approverRoles: ['admin'],
  rationale: 'governed',
}

function makeRequest(overrides: Partial<WorkflowTriggerRequest> = {}): WorkflowTriggerRequest {
  return {
    workflowId: 'commerce.invoice.send',
    orgId: ORG,
    requestId: REQ,
    initiatedBy: { actorId: 'user_1', actorType: 'user', orgId: ORG },
    payload: { actorRole: 'admin' },
    executionContext: { dryRun: false, priority: 'normal' },
    ...overrides,
  }
}

function fakeDecisionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dec-1',
    type: 'workflow.authorized',
    orgId: ORG,
    domain: 'commerce',
    actorId: 'user_1',
    actorRole: 'admin',
    action: 'workflow.trigger',
    resource: 'workflow',
    resourceId: 'commerce.invoice.send',
    outcome: 'allowed',
    reasonCode: 'POLICY_PERMITTED',
    reason: 'ok',
    policyId: policy.id,
    policyVersion: policy.version,
    policyIds: [policy.id],
    workflowId: 'commerce.invoice.send',
    caseId: null,
    correlationId: null,
    requestId: REQ,
    traceId: null,
    metadata: {},
    requestHash: 'h',
    recordedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('authorizeWorkflowTrigger', () => {
  beforeEach(() => {
    __resetRegistryForTests()
    mocks.recordDecisionEvent.mockReset()
    mocks.resolveEntitlements.mockReset()
    mocks.recordAuditEvent.mockClear()
  })

  it('denies and persists when no policy is registered', async () => {
    mocks.recordDecisionEvent.mockResolvedValueOnce(
      fakeDecisionRecord({ outcome: 'denied', reasonCode: 'NO_POLICY_REGISTERED' }),
    )

    const result = await authorizeWorkflowTrigger(makeRequest())

    expect(result.authorized).toBe(false)
    expect(result.reasonCode).toBe('NO_POLICY_REGISTERED')
    expect(mocks.resolveEntitlements).not.toHaveBeenCalled()
    const call = mocks.recordDecisionEvent.mock.calls[0]![0]
    expect(call.outcome).toBe('denied')
    expect(call.reasonCode).toBe('NO_POLICY_REGISTERED')
    expect(call.policyId).toBe('unregistered')
  })

  it('denies when entitlement is not granted', async () => {
    registerWorkflowPolicy(policy)
    mocks.resolveEntitlements.mockResolvedValueOnce({ granted: false })
    mocks.recordDecisionEvent.mockResolvedValueOnce(
      fakeDecisionRecord({ outcome: 'denied', reasonCode: 'ORG_NOT_ENTITLED' }),
    )

    const result = await authorizeWorkflowTrigger(makeRequest())
    expect(result.authorized).toBe(false)
    expect(result.reasonCode).toBe('ORG_NOT_ENTITLED')
    const call = mocks.recordDecisionEvent.mock.calls[0]![0]
    expect(call.policyId).toBe(policy.id)
    expect(call.policyVersion).toBe(policy.version)
  })

  it('denies when the entitlement service errors', async () => {
    registerWorkflowPolicy(policy)
    mocks.resolveEntitlements.mockRejectedValueOnce(new Error('db down'))
    mocks.recordDecisionEvent.mockResolvedValueOnce(
      fakeDecisionRecord({ outcome: 'denied', reasonCode: 'ENTITLEMENT_RESOLUTION_ERROR' }),
    )

    const result = await authorizeWorkflowTrigger(makeRequest())
    expect(result.authorized).toBe(false)
    expect(result.reasonCode).toBe('ENTITLEMENT_RESOLUTION_ERROR')
  })

  it('denies disallowed roles and returns the policy reason code', async () => {
    registerWorkflowPolicy(policy)
    mocks.resolveEntitlements.mockResolvedValueOnce({ granted: true })
    mocks.recordDecisionEvent.mockResolvedValueOnce(
      fakeDecisionRecord({ outcome: 'denied', reasonCode: 'ROLE_NOT_PERMITTED' }),
    )

    const result = await authorizeWorkflowTrigger(
      makeRequest({ payload: { actorRole: 'reader' } }),
    )
    expect(result.authorized).toBe(false)
    expect(result.reasonCode).toBe('ROLE_NOT_PERMITTED')
  })

  it('returns approval_required path for approval roles', async () => {
    registerWorkflowPolicy(policy)
    mocks.resolveEntitlements.mockResolvedValueOnce({ granted: true })
    mocks.recordDecisionEvent.mockResolvedValueOnce(
      fakeDecisionRecord({ outcome: 'approval_required', reasonCode: 'APPROVAL_REQUIRED_BY_ROLE' }),
    )

    const result = await authorizeWorkflowTrigger(
      makeRequest({ payload: { actorRole: 'analyst' } }),
    )
    expect(result.authorized).toBe(false)
    expect(result.requiresApproval).toBe(true)
    expect(result.reasonCode).toBe('APPROVAL_REQUIRED_BY_ROLE')
    expect(result.policyId).toBe(policy.id)
  })

  it('authorizes when policy permits and entitlement granted', async () => {
    registerWorkflowPolicy(policy)
    mocks.resolveEntitlements.mockResolvedValueOnce({ granted: true })
    mocks.recordDecisionEvent.mockResolvedValueOnce(fakeDecisionRecord())

    const result = await authorizeWorkflowTrigger(makeRequest())
    expect(result.authorized).toBe(true)
    expect(result.authorization?.decisionId).toBe('dec-1')
    expect(result.authorization?.requiresApproval).toBe(false)
    expect(result.policyId).toBe(policy.id)
    expect(result.policyVersion).toBe(policy.version)
    expect(result.reasonCode).toBe('POLICY_PERMITTED')
    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1)
  })

  it('fails closed when decision persistence throws on the allow path', async () => {
    registerWorkflowPolicy(policy)
    mocks.resolveEntitlements.mockResolvedValueOnce({ granted: true })
    mocks.recordDecisionEvent.mockRejectedValueOnce(new Error('db down'))

    const result = await authorizeWorkflowTrigger(makeRequest())
    expect(result.authorized).toBe(false)
    expect(result.reasonCode).toBe('DECISION_PERSISTENCE_FAILED')
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled()
  })

  it('still surfaces a denial when persistence fails for the denial path', async () => {
    mocks.recordDecisionEvent.mockRejectedValueOnce(new Error('db down'))
    const result = await authorizeWorkflowTrigger(makeRequest())
    expect(result.authorized).toBe(false)
    expect(result.reasonCode).toBe('NO_POLICY_REGISTERED')
  })
})
