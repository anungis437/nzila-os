import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))
vi.mock('@nzila/db/schema', () => ({
  policyReplaySessions: { id: 'id', sourcePolicyId: 'sourcePolicyId', status: 'status' },
  policyReplayResults: { sessionId: 'sessionId', driftDimensions: 'driftDimensions' },
  decisionEvents: { sourcePolicyId: 'sourcePolicyId', decidedAt: 'decidedAt' },
  governedPolicies: { id: 'id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((c: unknown, v: unknown) => ({ c, v })),
  and: vi.fn((...a: unknown[]) => a),
  or: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((c: unknown, v: unknown) => ({ c, v })),
  lte: vi.fn((c: unknown, v: unknown) => ({ c, v })),
  sql: vi.fn(),
}))
vi.mock('../policy-governance-events-service', () => ({
  recordGovernanceEvent: vi.fn().mockResolvedValue({}),
}))
vi.mock('../policy-registry', () => ({
  evaluateWorkflowPolicy: vi.fn().mockReturnValue({
    decision: { decision: 'allowed', reasonCode: 'POLICY_ALLOWS', approverRoles: [] },
    policy: { id: 'pol-1' },
  }),
}))

import { computeDriftDimensions } from '../policy-replay-engine'

describe('policy-replay-engine', () => {
  describe('computeDriftDimensions', () => {
    it('returns empty array when nothing changed', () => {
      const original = { decision: 'allowed', reasonCode: 'POLICY_ALLOWS', approverRoles: ['admin'] }
      const replayed = { decision: 'allowed', reasonCode: 'POLICY_ALLOWS', approverRoles: ['admin'] }
      expect(computeDriftDimensions(original, replayed)).toEqual([])
    })

    it('reports "decision" when decision changed', () => {
      const original = { decision: 'allowed', reasonCode: 'POLICY_ALLOWS', approverRoles: [] }
      const replayed = { decision: 'denied', reasonCode: 'NO_POLICY_REGISTERED', approverRoles: [] }
      const dims = computeDriftDimensions(original, replayed)
      expect(dims).toContain('decision')
      expect(dims).toContain('reason_code')
    })

    it('reports "reason_code" when only reason changed', () => {
      const original = { decision: 'allowed', reasonCode: 'POLICY_ALLOWS', approverRoles: [] }
      const replayed = { decision: 'allowed', reasonCode: 'POLICY_ALLOWS_V2', approverRoles: [] }
      const dims = computeDriftDimensions(original, replayed)
      expect(dims).toContain('reason_code')
      expect(dims).not.toContain('decision')
    })

    it('reports "approver_roles" when roles changed', () => {
      const original = { decision: 'approval_required', reasonCode: 'APPROVAL_REQUIRED', approverRoles: ['admin'] }
      const replayed = { decision: 'approval_required', reasonCode: 'APPROVAL_REQUIRED', approverRoles: ['president'] }
      const dims = computeDriftDimensions(original, replayed)
      expect(dims).toContain('approver_roles')
    })

    it('is order-insensitive for approver_roles comparison', () => {
      const original = { decision: 'approval_required', reasonCode: 'AR', approverRoles: ['admin', 'president'] }
      const replayed = { decision: 'approval_required', reasonCode: 'AR', approverRoles: ['president', 'admin'] }
      const dims = computeDriftDimensions(original, replayed)
      expect(dims).not.toContain('approver_roles')
    })

    it('reports all three dimensions when all change', () => {
      const original = { decision: 'allowed', reasonCode: 'R1', approverRoles: ['a'] }
      const replayed = { decision: 'denied', reasonCode: 'R2', approverRoles: ['b'] }
      const dims = computeDriftDimensions(original, replayed)
      expect(dims).toContain('decision')
      expect(dims).toContain('reason_code')
      expect(dims).toContain('approver_roles')
    })
  })
})
