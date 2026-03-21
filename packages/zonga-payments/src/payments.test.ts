import { describe, it, expect } from 'vitest'
import type { PaymentIntent, PaymentRefund, PayoutInstruction } from './types'
import { PaymentIntentStatus, PaymentMethod, PayoutStatus, RefundStatus } from './types'
import {
  canTransitionIntent,
  getAvailableIntentTransitions,
  isIntentExpired,
  computeRefundSummary,
  validateRefundRequest,
  findByIdempotencyKey,
} from './intents'
import {
  resolvePayoutRoute,
  planPayoutBatches,
  reconcilePayouts,
} from './payouts'
import { createPayoutOrchestrator, type PayoutOrchestratorPorts } from './payout-orchestrator'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeIntent(partial?: Partial<PaymentIntent>): PaymentIntent {
  return {
    id: 'pi-1',
    orderId: 'ord-1',
    userId: 'user-1',
    amount: 100,
    currency: 'USD',
    method: PaymentMethod.CARD,
    provider: 'stripe',
    status: PaymentIntentStatus.CAPTURED,
    providerIntentId: 'pi_stripe_1',
    metadata: {},
    idempotencyKey: 'idem-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    capturedAt: new Date('2025-01-01'),
    expiresAt: new Date('2025-01-02'),
    ...partial,
  }
}

function makeRefund(partial?: Partial<PaymentRefund>): PaymentRefund {
  return {
    id: 'ref-1',
    intentId: 'pi-1',
    amount: 30,
    reason: 'Customer request',
    status: RefundStatus.COMPLETED,
    providerRefundId: null,
    requestedAt: new Date('2025-01-02'),
    completedAt: new Date('2025-01-02'),
    ...partial,
  }
}

function makePayoutInstruction(partial?: Partial<PayoutInstruction>): PayoutInstruction {
  return {
    id: 'po-1',
    recipientId: 'artist-1',
    amount: 50,
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

// ── Intent Transitions ───────────────────────────────────────────────────────

describe('canTransitionIntent', () => {
  it('allows created → processing', () => {
    const r = canTransitionIntent(PaymentIntentStatus.CREATED, PaymentIntentStatus.PROCESSING)
    expect(r.allowed).toBe(true)
  })

  it('allows processing → captured', () => {
    const r = canTransitionIntent(PaymentIntentStatus.PROCESSING, PaymentIntentStatus.CAPTURED)
    expect(r.allowed).toBe(true)
  })

  it('rejects created → captured (must go through processing)', () => {
    const r = canTransitionIntent(PaymentIntentStatus.CREATED, PaymentIntentStatus.CAPTURED)
    expect(r.allowed).toBe(false)
  })

  it('allows captured → refunded', () => {
    const r = canTransitionIntent(PaymentIntentStatus.CAPTURED, PaymentIntentStatus.REFUNDED)
    expect(r.allowed).toBe(true)
  })

  it('blocked from terminal states', () => {
    const r = canTransitionIntent(PaymentIntentStatus.FAILED, PaymentIntentStatus.PROCESSING)
    expect(r.allowed).toBe(false)
  })
})

describe('getAvailableIntentTransitions', () => {
  it('returns processing and cancelled from created', () => {
    const available = getAvailableIntentTransitions(PaymentIntentStatus.CREATED)
    expect(available).toContain(PaymentIntentStatus.PROCESSING)
    expect(available).toContain(PaymentIntentStatus.CANCELLED)
    expect(available).toHaveLength(2)
  })

  it('returns empty for terminal state (failed)', () => {
    expect(getAvailableIntentTransitions(PaymentIntentStatus.FAILED)).toHaveLength(0)
  })
})

// ── Expiration ───────────────────────────────────────────────────────────────

describe('isIntentExpired', () => {
  it('returns true when past expiry and not captured', () => {
    const intent = makeIntent({
      status: PaymentIntentStatus.CREATED,
      expiresAt: new Date('2025-01-01'),
    })
    expect(isIntentExpired(intent, new Date('2025-01-02'))).toBe(true)
  })

  it('returns false when not yet expired', () => {
    const intent = makeIntent({
      status: PaymentIntentStatus.CREATED,
      expiresAt: new Date('2025-12-31'),
    })
    expect(isIntentExpired(intent, new Date('2025-01-01'))).toBe(false)
  })

  it('returns false for captured intent even if past expiry', () => {
    const intent = makeIntent({
      status: PaymentIntentStatus.CAPTURED,
      expiresAt: new Date('2025-01-01'),
    })
    expect(isIntentExpired(intent, new Date('2025-06-01'))).toBe(false)
  })
})

// ── Refund Calculations ──────────────────────────────────────────────────────

describe('computeRefundSummary', () => {
  it('computes total of completed refunds', () => {
    const intent = makeIntent({ amount: 100 })
    const refunds = [
      makeRefund({ amount: 30 }),
      makeRefund({ id: 'ref-2', amount: 20 }),
    ]
    const summary = computeRefundSummary(intent, refunds)
    expect(summary.totalRefunded).toBe(50)
    expect(summary.remainingRefundable).toBe(50)
    expect(summary.refundCount).toBe(2)
    expect(summary.isFullyRefunded).toBe(false)
  })

  it('detects fully refunded', () => {
    const intent = makeIntent({ amount: 100 })
    const refunds = [makeRefund({ amount: 100 })]
    const summary = computeRefundSummary(intent, refunds)
    expect(summary.isFullyRefunded).toBe(true)
    expect(summary.remainingRefundable).toBe(0)
  })

  it('ignores non-completed refunds', () => {
    const intent = makeIntent({ amount: 100 })
    const refunds = [makeRefund({ amount: 50, status: RefundStatus.PENDING })]
    const summary = computeRefundSummary(intent, refunds)
    expect(summary.totalRefunded).toBe(0)
  })
})

describe('validateRefundRequest', () => {
  it('allows valid refund on captured intent', () => {
    const intent = makeIntent({ status: PaymentIntentStatus.CAPTURED, amount: 100 })
    const result = validateRefundRequest(intent, 50, [])
    expect(result.allowed).toBe(true)
  })

  it('rejects refund on non-captured intent', () => {
    const intent = makeIntent({ status: PaymentIntentStatus.PROCESSING })
    const result = validateRefundRequest(intent, 10, [])
    expect(result.allowed).toBe(false)
  })

  it('rejects refund exceeding remaining', () => {
    const intent = makeIntent({ amount: 100 })
    const existing = [makeRefund({ amount: 80 })]
    const result = validateRefundRequest(intent, 30, existing)
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('exceeds')
  })

  it('rejects zero refund amount', () => {
    const intent = makeIntent()
    const result = validateRefundRequest(intent, 0, [])
    expect(result.allowed).toBe(false)
  })
})

// ── Idempotency ──────────────────────────────────────────────────────────────

describe('findByIdempotencyKey', () => {
  it('finds matching intent by key', () => {
    const intents = [
      makeIntent({ id: 'pi-1', idempotencyKey: 'key-a' }),
      makeIntent({ id: 'pi-2', idempotencyKey: 'key-b' }),
    ]
    const found = findByIdempotencyKey(intents, 'key-b')
    expect(found?.id).toBe('pi-2')
  })

  it('returns undefined when no match', () => {
    const found = findByIdempotencyKey([makeIntent()], 'nonexistent')
    expect(found).toBeUndefined()
  })
})

// ── Provider Routing ─────────────────────────────────────────────────────────

describe('resolvePayoutRoute', () => {
  it('resolves M-Pesa for KES in Kenya', () => {
    const result = resolvePayoutRoute('KES', 'KE')
    expect(result.matched).toBe(true)
    expect(result.route?.provider).toBe('mpesa')
  })

  it('resolves MTN MoMo for GHS in Ghana', () => {
    const result = resolvePayoutRoute('GHS', 'GH')
    expect(result.matched).toBe(true)
    expect(result.route).not.toBeNull()
  })

  it('returns no match for unsupported currency/country', () => {
    const result = resolvePayoutRoute('JPY', 'JP')
    expect(result.matched).toBe(false)
    expect(result.error).toContain('No provider')
  })

  it('prefers specified payment method', () => {
    const result = resolvePayoutRoute('KES', 'KE', PaymentMethod.BANK_TRANSFER)
    expect(result.matched).toBe(true)
    expect(result.route?.method).toBe(PaymentMethod.BANK_TRANSFER)
  })
})

// ── Batch Scheduling ─────────────────────────────────────────────────────────

describe('planPayoutBatches', () => {
  it('groups pending instructions by provider and currency', () => {
    const instructions = [
      makePayoutInstruction({ id: 'po-1', provider: 'mpesa', currency: 'KES', amount: 100 }),
      makePayoutInstruction({ id: 'po-2', provider: 'mpesa', currency: 'KES', amount: 200 }),
      makePayoutInstruction({ id: 'po-3', provider: 'flutterwave', currency: 'NGN', amount: 500 }),
    ]
    const batches = planPayoutBatches(instructions)
    expect(batches).toHaveLength(2)
    const mpesaBatch = batches.find(b => b.provider === 'mpesa')
    expect(mpesaBatch?.totalAmount).toBe(300)
    expect(mpesaBatch?.instructionCount).toBe(2)
  })

  it('excludes non-pending instructions', () => {
    const instructions = [
      makePayoutInstruction({ status: PayoutStatus.COMPLETED }),
      makePayoutInstruction({ id: 'po-2', status: PayoutStatus.PENDING }),
    ]
    const batches = planPayoutBatches(instructions)
    expect(batches).toHaveLength(1)
    expect(batches[0]!.instructionCount).toBe(1)
  })
})

// ── Reconciliation ───────────────────────────────────────────────────────────

describe('reconcilePayouts', () => {
  it('computes correct reconciliation stats', () => {
    const instructions = [
      makePayoutInstruction({ id: 'po-1', status: PayoutStatus.COMPLETED, amount: 100 }),
      makePayoutInstruction({ id: 'po-2', status: PayoutStatus.COMPLETED, amount: 200 }),
      makePayoutInstruction({ id: 'po-3', status: PayoutStatus.FAILED, amount: 50 }),
      makePayoutInstruction({ id: 'po-4', status: PayoutStatus.PENDING, amount: 75 }),
    ]
    const result = reconcilePayouts(instructions)
    expect(result.totalInstructions).toBe(4)
    expect(result.completed).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.pending).toBe(1)
    expect(result.totalDisbursed).toBe(300)
    expect(result.totalFailed).toBe(50)
    expect(result.completionRate).toBe(50)
  })

  it('handles empty instructions', () => {
    const result = reconcilePayouts([])
    expect(result.totalInstructions).toBe(0)
    expect(result.completionRate).toBe(0)
  })
})

// ── Payout Orchestrator — Proof Gate ─────────────────────────────────────────

function makePorts(overrides?: Partial<PayoutOrchestratorPorts>): PayoutOrchestratorPorts {
  return {
    checkEligibility: async () => ({
      eligible: true,
      recipientId: 'artist-1',
      orgId: 'org-1',
      blockers: [],
      kycVerified: true,
      balanceMinor: 10000,
      minimumPayoutMinor: 500,
      hasActiveDisputes: false,
    }),
    loadPendingPayouts: async () => [],
    executeProviderPayout: async () => ({
      success: true,
      providerRef: 'prov-ref-123',
      error: null,
      providerFeeMinor: 50,
    }),
    recordAuditEvent: async () => {},
    updatePayoutStatus: async () => {},
    persistProof: async () => {},
    loadRevenueBreakdown: async () => [
      { source: 'streaming', amountMinor: 5000, units: 1000 },
    ],
    loadRoyaltyHashes: async () => ['hash-abc'],
    ...overrides,
  }
}

describe('createPayoutOrchestrator — proof gate', () => {
  it('blocks payout when proof generation throws (PAYOUT_BLOCKED_NO_PROOF)', async () => {
    const ports = makePorts({
      // Return a breakdown that does NOT match the instruction amount (5000 ≠ 100)
      // This will cause generatePayoutProof to throw because breakdown total ≠ amount
      loadRevenueBreakdown: async () => [
        { source: 'streaming', amountMinor: 9999, units: 1 },
      ],
    })
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-proof-1', amount: 5000, currency: 'KES' })
    const result = await orch.executePayout(instruction, 'org-1')

    expect(result.status).toBe('blocked')
    expect(result.error).toBe('PAYOUT_BLOCKED_NO_PROOF')
  })

  it('blocks payout with zero amount (generatePayoutProof rejects amount <= 0)', async () => {
    const ports = makePorts({
      loadRevenueBreakdown: async () => [],
    })
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-zero', amount: 0, currency: 'KES' })
    const result = await orch.executePayout(instruction, 'org-1')

    expect(result.status).toBe('blocked')
    expect(result.error).toBe('PAYOUT_BLOCKED_NO_PROOF')
  })

  it('persists proof BEFORE provider execution', async () => {
    const callOrder: string[] = []
    const ports = makePorts({
      persistProof: async () => { callOrder.push('persistProof') },
      executeProviderPayout: async () => {
        callOrder.push('executeProviderPayout')
        return { success: true, providerRef: 'ref-1', error: null, providerFeeMinor: 0 }
      },
    })
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-order', amount: 5000, currency: 'KES' })
    await orch.executePayout(instruction, 'org-1')

    const persistIdx = callOrder.indexOf('persistProof')
    const executeIdx = callOrder.indexOf('executeProviderPayout')
    expect(persistIdx).toBeLessThan(executeIdx)
  })

  it('completes payout with valid proof', async () => {
    const ports = makePorts()
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-valid', amount: 5000, currency: 'KES' })
    const result = await orch.executePayout(instruction, 'org-1')

    expect(result.status).toBe('completed')
    expect(result.providerRef).toBe('prov-ref-123')
    expect(result.error).toBeNull()
  })

  it('marks proof as disbursed on success', async () => {
    let lastProof: unknown = null
    const ports = makePorts({
      persistProof: async (proof) => { lastProof = proof },
    })
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-disbursed', amount: 5000, currency: 'KES' })
    await orch.executePayout(instruction, 'org-1')

    expect(lastProof).not.toBeNull()
    expect((lastProof as { status: string }).status).toBe('disbursed')
  })

  it('blocks payout when eligibility check fails', async () => {
    const ports = makePorts({
      checkEligibility: async () => ({
        eligible: false,
        recipientId: 'artist-1',
        orgId: 'org-1',
        blockers: ['KYC not verified'],
        kycVerified: false,
        balanceMinor: 10000,
        minimumPayoutMinor: 500,
        hasActiveDisputes: false,
      }),
    })
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-inelig', amount: 5000, currency: 'KES' })
    const result = await orch.executePayout(instruction, 'org-1')

    expect(result.status).toBe('blocked')
    expect(result.error).toContain('KYC not verified')
  })

  it('records audit event with proofId on success', async () => {
    let auditDetails: Record<string, unknown> = {}
    const ports = makePorts({
      recordAuditEvent: async (event) => {
        if (event.eventType === 'payout_succeeded') {
          auditDetails = event.details
        }
      },
    })
    const orch = createPayoutOrchestrator(ports)
    const instruction = makePayoutInstruction({ id: 'po-audit', amount: 5000, currency: 'KES' })
    await orch.executePayout(instruction, 'org-1')

    expect(auditDetails.proofId).toBeDefined()
    expect(String(auditDetails.proofId)).toMatch(/^pp-/)
  })
})
