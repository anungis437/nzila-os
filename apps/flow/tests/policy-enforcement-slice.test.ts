import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEvaluatePolicy, mockIsBlocked } = vi.hoisted(() => ({
  mockEvaluatePolicy: vi.fn(),
  mockIsBlocked: vi.fn(),
}))

vi.mock('@nzila/platform-policy-engine', () => ({
  evaluatePolicy: mockEvaluatePolicy,
  isBlocked: mockIsBlocked,
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_QUOTE_POLICY: {
    approvalThreshold: 1000,
  },
}))

describe('policy-enforcement slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEvaluatePolicy.mockReturnValue({ decisions: [{ reason: 'policy blocked' }] })
    mockIsBlocked.mockReturnValue(false)
  })

  it('allows action when policy result is not blocked', async () => {
    const { checkQuoterPolicy } = await import('@/lib/policy-enforcement')

    const result = await checkQuoterPolicy('quote_generation', {
      orgId: 'org-1',
      userId: 'u-1',
      roles: ['sales'],
    })

    expect(result).toEqual({
      allowed: true,
      action: 'quote_generation',
      reason: undefined,
      policyId: 'quoter-generation',
    })
    expect(mockEvaluatePolicy).toHaveBeenCalledTimes(1)
  })

  it('returns blocked reason when policy engine marks action as blocked', async () => {
    mockIsBlocked.mockReturnValue(true)
    const { checkQuoterPolicy } = await import('@/lib/policy-enforcement')

    const result = await checkQuoterPolicy('po_generation', {
      orgId: 'org-2',
      userId: 'u-2',
      roles: ['sales'],
      paymentCleared: false,
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('policy blocked')
    expect(result.policyId).toBe('quoter-po-generation')
  })

  it('short-circuits to allow when override action has no direct matching condition value', async () => {
    const { checkQuoterPolicy } = await import('@/lib/policy-enforcement')

    const result = await checkQuoterPolicy(
      'price_override',
      { amount: 8000 },
      {
        approvalThreshold: 7500,
      } as never,
    )

    expect(result.allowed).toBe(true)
    expect(result.policyId).toBeUndefined()
    expect(mockEvaluatePolicy).not.toHaveBeenCalled()
  })

  it('falls back to allow when action has no matching policy definition', async () => {
    const { checkQuoterPolicy } = await import('@/lib/policy-enforcement')

    const result = await checkQuoterPolicy('unknown_action' as never, {
      orgId: 'org-1',
    })

    expect(result.allowed).toBe(true)
    expect(result.policyId).toBeUndefined()
    expect(mockEvaluatePolicy).not.toHaveBeenCalled()
  })
})
