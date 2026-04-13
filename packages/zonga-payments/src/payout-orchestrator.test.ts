import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PayoutStatus, PaymentMethod, type PayoutInstruction } from './types'

// Mock zonga-rights to control proof generation/verification
const mockGeneratePayoutProof = vi.fn()
const mockVerifyProofIntegrity = vi.fn()
const mockMarkProofDisbursed = vi.fn()

vi.mock('@nzila/zonga-rights', () => ({
  generatePayoutProof: (...args: unknown[]) => mockGeneratePayoutProof(...args),
  verifyProofIntegrity: (...args: unknown[]) => mockVerifyProofIntegrity(...args),
  markProofDisbursed: (...args: unknown[]) => mockMarkProofDisbursed(...args),
}))

import {
  createPayoutOrchestrator,
  type PayoutOrchestratorPorts,
} from './payout-orchestrator'

function makeInstruction(partial?: Partial<PayoutInstruction>): PayoutInstruction {
  return {
    id: 'po-1',
    recipientId: 'artist-1',
    amount: 5000,
    currency: 'KES',
    method: PaymentMethod.MOBILE_MONEY,
    provider: 'mpesa',
    destination: {
      type: 'mobile_wallet',
      accountIdentifier: '+254***123',
      accountName: 'Artist One',
      mobileNumber: '+254700123456',
    },
    status: PayoutStatus.PENDING,
    providerPayoutId: null,
    batchId: null,
    scheduledAt: new Date('2025-02-01'),
    completedAt: null,
    ...partial,
  }
}

function makePorts(overrides?: Partial<PayoutOrchestratorPorts>): PayoutOrchestratorPorts {
  return {
    checkEligibility: vi.fn().mockResolvedValue({
      eligible: true,
      recipientId: 'artist-1',
      orgId: 'org-1',
      blockers: [],
      kycVerified: true,
      balanceMinor: 10000,
      minimumPayoutMinor: 500,
      hasActiveDisputes: false,
    }),
    loadPendingPayouts: vi.fn().mockResolvedValue([]),
    executeProviderPayout: vi.fn().mockResolvedValue({
      success: true,
      providerRef: 'prov-ref-123',
      error: null,
      providerFeeMinor: 50,
    }),
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
    updatePayoutStatus: vi.fn().mockResolvedValue(undefined),
    persistProof: vi.fn().mockResolvedValue(undefined),
    loadRevenueBreakdown: vi.fn().mockResolvedValue([
      { source: 'streaming', amountMinor: 5000, units: 1000 },
    ]),
    loadRoyaltyHashes: vi.fn().mockResolvedValue(['hash-abc']),
    ...overrides,
  }
}

describe('payoutOrchestrator — uncovered paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGeneratePayoutProof.mockReturnValue({
      proofId: 'pp-1',
      proofHash: 'valid-hash',
      status: 'generated',
    })
    mockVerifyProofIntegrity.mockReturnValue(true)
    mockMarkProofDisbursed.mockImplementation((proof, ref) => ({
      ...proof,
      status: 'disbursed',
      providerRef: ref,
    }))
  })

  it('blocks payout when proof has no proofHash', async () => {
    mockGeneratePayoutProof.mockReturnValue({
      proofId: 'pp-no-hash',
      proofHash: '',
      status: 'generated',
    })
    const ports = makePorts()
    const orch = createPayoutOrchestrator(ports)
    const result = await orch.executePayout(makeInstruction(), 'org-1')

    expect(result.status).toBe('blocked')
    expect(result.error).toBe('PAYOUT_BLOCKED_INVALID_PROOF')
  })

  it('blocks payout when verifyProofIntegrity returns false', async () => {
    mockVerifyProofIntegrity.mockReturnValue(false)
    const ports = makePorts()
    const orch = createPayoutOrchestrator(ports)
    const result = await orch.executePayout(makeInstruction(), 'org-1')

    expect(result.status).toBe('blocked')
    expect(result.error).toBe('PAYOUT_BLOCKED_INVALID_PROOF')
  })

  it('fails payout when no route is found', async () => {
    // 'JPY' has no route in the orchestrator's CURRENCY_COUNTRY map → 'XX' → no provider
    const ports = makePorts()
    const orch = createPayoutOrchestrator(ports)
    const result = await orch.executePayout(
      makeInstruction({ currency: 'JPY' }),
      'org-1',
    )

    expect(result.status).toBe('failed')
    expect(result.error).toContain('No provider')
    expect(vi.mocked(ports.updatePayoutStatus)).toHaveBeenCalledWith(
      expect.any(String),
      PayoutStatus.FAILED,
      undefined,
      expect.stringContaining('No provider'),
    )
  })

  it('fails payout when provider execution fails', async () => {
    const ports = makePorts({
      executeProviderPayout: vi.fn().mockResolvedValue({
        success: false,
        providerRef: null,
        error: 'Provider timeout',
        providerFeeMinor: 0,
      }),
    })
    const orch = createPayoutOrchestrator(ports)
    const result = await orch.executePayout(makeInstruction(), 'org-1')

    expect(result.status).toBe('failed')
    expect(result.error).toBe('Provider timeout')
    expect(vi.mocked(ports.updatePayoutStatus)).toHaveBeenCalledWith(
      'po-1',
      PayoutStatus.FAILED,
      undefined,
      'Provider timeout',
    )
  })

  it('executeBatch processes all pending payouts for an org', async () => {
    const instructions = [
      makeInstruction({ id: 'po-batch-1', amount: 1000 }),
      makeInstruction({ id: 'po-batch-2', amount: 2000 }),
    ]
    const ports = makePorts({
      loadPendingPayouts: vi.fn().mockResolvedValue(instructions),
    })
    const orch = createPayoutOrchestrator(ports)
    const results = await orch.executeBatch('org-1')

    expect(results).toHaveLength(2)
    expect(results[0]!.payoutId).toBe('po-batch-1')
    expect(results[1]!.payoutId).toBe('po-batch-2')
    expect(vi.mocked(ports.loadPendingPayouts)).toHaveBeenCalledWith('org-1', undefined)
  })

  it('executeBatch passes recipientId filter', async () => {
    const ports = makePorts({
      loadPendingPayouts: vi.fn().mockResolvedValue([]),
    })
    const orch = createPayoutOrchestrator(ports)
    await orch.executeBatch('org-1', 'artist-42')

    expect(vi.mocked(ports.loadPendingPayouts)).toHaveBeenCalledWith('org-1', 'artist-42')
  })
})
