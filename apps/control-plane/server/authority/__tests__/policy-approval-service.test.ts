import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@nzila/db/schema', () => ({
  policyApprovalChains: { id: 'id', policyId: 'policyId', approverRoles: 'approverRoles', chainType: 'chainType' },
  policyApprovalActions: { chainId: 'chainId', action: 'action' },
  governedPolicies: { id: 'id', riskClassification: 'riskClassification' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((c: unknown, v: unknown) => ({ c, v })),
  and: vi.fn((...a: unknown[]) => a),
  or: vi.fn((...a: unknown[]) => a),
  sql: vi.fn(),
  desc: vi.fn((c: unknown) => c),
}))

vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('../governed-policy-service', () => ({
  transitionState: vi.fn().mockResolvedValue({}),
}))

vi.mock('../policy-governance-events-service', () => ({
  recordGovernanceEvent: vi.fn().mockResolvedValue({}),
}))

function buildDb(options: { policy?: unknown; chain?: unknown; approvedCount?: number } = {}) {
  let callCount = 0
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      callCount++
      // First call: policy lookup; second: chain lookup; third: approved count
      if (callCount === 1) return Promise.resolve(options.policy ? [options.policy] : [])
      return Promise.resolve(options.chain ? [options.chain] : [])
    }),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'action-1', action: 'approved' }]),
  }
  // Override for approved count query
  const approvedCountMock = Promise.resolve([{ count: options.approvedCount ?? 1 }])
  const origSelect = chain.select.getMockImplementation()
  chain.select.mockImplementation((...args: unknown[]) => {
    const c = { ...chain }
    c.limit = vi.fn().mockReturnValue(approvedCountMock)
    return c
  })

  return chain
}

const VALID_CHAIN = {
  id: 'chain-1',
  governedPolicyId: 'pol-1',
  chainType: 'consensus',
  requiresNamedApprovers: false,
  approverRoles: ['admin'],
  namedApproverIds: [],
  requiredApprovals: 1,
}

import { recordApprovalAction } from '../policy-approval-service'

describe('policy-approval-service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('recordApprovalAction — role gate', () => {
    it('throws ROLE_GATE_BLOCKED when actor role is not authorized', async () => {
      // Build a minimal db that returns the chain
      const db = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([VALID_CHAIN]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      }

      await expect(
        recordApprovalAction(
          { chainId: 'chain-1', action: 'approved', actorUserId: 'user-2', actorRole: 'analyst' },
          db,
        ),
      ).rejects.toThrow('ROLE_GATE_BLOCKED')
    })

    it('passes role gate for authorized role', async () => {
      const db = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn()
          .mockResolvedValueOnce([VALID_CHAIN])        // chain lookup
          .mockResolvedValueOnce([{ count: 1 }]),       // approved count
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'action-1', action: 'approved' }]),
      }

      const action = await recordApprovalAction(
        { chainId: 'chain-1', action: 'approved', actorUserId: 'user-1', actorRole: 'admin' },
        db,
      )
      expect(action).toMatchObject({ action: 'approved' })
    })
  })

  describe('recordApprovalAction — named approver gate', () => {
    const namedChain = {
      ...VALID_CHAIN,
      requiresNamedApprovers: true,
      namedApproverIds: ['approver-001'],
    }

    it('throws NAMED_APPROVER_GATE_BLOCKED for non-named approver', async () => {
      const db = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([namedChain]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      }

      await expect(
        recordApprovalAction(
          { chainId: 'chain-1', action: 'approved', actorUserId: 'other-user', actorRole: 'admin' },
          db,
        ),
      ).rejects.toThrow('NAMED_APPROVER_GATE_BLOCKED')
    })

    it('bypasses named approver gate for emergency chain type', async () => {
      const emergencyChain = { ...namedChain, chainType: 'emergency' }
      const db = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn()
          .mockResolvedValueOnce([emergencyChain])
          .mockResolvedValueOnce([{ count: 1 }]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'action-1', action: 'approved' }]),
      }

      const action = await recordApprovalAction(
        { chainId: 'chain-1', action: 'approved', actorUserId: 'anyone', actorRole: 'admin' },
        db,
      )
      expect(action).toMatchObject({ action: 'approved' })
    })
  })
})
