import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createPaymentFlowService,
  type PaymentFlowDeps,
  type PaymentIntentRepository,
  type WebhookEventRepository,
  type FlowOrchestrator,
  type AuditLogger,
} from './payment-flow'
import {
  PaymentIntentStatus,
  PaymentProvider,
  type PaymentProviderAdapter,
  type PaymentIntent,
  type PaymentCapture,
} from './types'
import type { WalletOperationResult, CreditParams, DebitParams } from './wallet'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeIntent(overrides?: Partial<PaymentIntent>): PaymentIntent {
  return {
    id: 'intent-1',
    orderId: 'order-1',
    userId: 'user-1',
    amount: 10000,
    currency: 'USD',
    method: 'card',
    provider: PaymentProvider.STRIPE,
    status: PaymentIntentStatus.PROCESSING,
    providerIntentId: 'pi_123',
    metadata: { walletId: 'wallet-1' },
    idempotencyKey: 'idem-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    capturedAt: null,
    expiresAt: new Date('2025-01-02'),
    ...overrides,
  }
}

function makeCapture(overrides?: Partial<PaymentCapture>): PaymentCapture {
  return {
    intentId: 'intent-1',
    capturedAmount: 10000,
    providerTransactionId: 'txn_123',
    receiptUrl: null,
    capturedAt: new Date(),
    ...overrides,
  }
}

function makeWalletResult(overrides?: Partial<WalletOperationResult>): WalletOperationResult {
  return {
    success: true,
    transactionId: 'wtx-1',
    wallet: {} as any,
    error: null,
    ...overrides,
  }
}

function makeMockAdapter(): PaymentProviderAdapter {
  return {
    provider: PaymentProvider.STRIPE,
    createIntent: vi.fn().mockResolvedValue(makeIntent()),
    captureIntent: vi.fn().mockResolvedValue(makeCapture()),
    refundIntent: vi.fn(),
    createPayout: vi.fn().mockImplementation(async (instruction) => instruction),
    verifyWebhook: vi.fn().mockReturnValue(true),
  }
}

function makeMockDeps(): PaymentFlowDeps {
  const adapter = makeMockAdapter()
  return {
    adapters: new Map([[PaymentProvider.STRIPE, adapter]]),
    intentRepo: {
      findById: vi.fn().mockResolvedValue(makeIntent()),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (i) => i),
      updateStatus: vi.fn().mockImplementation(async (id, status) => ({
        ...makeIntent(),
        id,
        status,
      })),
    } satisfies PaymentIntentRepository,
    webhookRepo: {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    } satisfies WebhookEventRepository,
    flow: {
      executeWorkflow: vi.fn().mockResolvedValue({}),
    } satisfies FlowOrchestrator,
    audit: {
      log: vi.fn().mockResolvedValue(undefined),
    } satisfies AuditLogger,
    walletCredit: vi.fn<[CreditParams], Promise<WalletOperationResult>>().mockResolvedValue(makeWalletResult()),
    walletDebit: vi.fn<[DebitParams], Promise<WalletOperationResult>>().mockResolvedValue(makeWalletResult()),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createPaymentFlowService', () => {
  let deps: ReturnType<typeof makeMockDeps>
  let service: ReturnType<typeof createPaymentFlowService>

  beforeEach(() => {
    deps = makeMockDeps()
    service = createPaymentFlowService(deps)
  })

  describe('createPaymentIntent', () => {
    it('creates a new payment intent through flow and provider', async () => {
      const result = await service.createPaymentIntent({
        orderId: 'order-1',
        userId: 'user-1',
        amount: 10000,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        idempotencyKey: 'idem-new',
      })
      expect(deps.flow.executeWorkflow).toHaveBeenCalled()
      expect(deps.intentRepo.save).toHaveBeenCalled()
      expect(deps.audit.log).toHaveBeenCalled()
      expect(result.id).toBe('intent-1')
    })

    it('returns existing intent for duplicate idempotency key', async () => {
      const existing = makeIntent({ id: 'existing-intent' })
      vi.mocked(deps.intentRepo.findByIdempotencyKey).mockResolvedValueOnce(existing)

      const result = await service.createPaymentIntent({
        orderId: 'order-1',
        userId: 'user-1',
        amount: 10000,
        currency: 'USD',
        method: 'card',
        provider: PaymentProvider.STRIPE,
        idempotencyKey: 'idem-dup',
      })
      expect(result.id).toBe('existing-intent')
      expect(deps.flow.executeWorkflow).not.toHaveBeenCalled()
    })

    it('throws for unknown provider', async () => {
      await expect(
        service.createPaymentIntent({
          orderId: 'order-1',
          userId: 'user-1',
          amount: 10000,
          currency: 'USD',
          method: 'card',
          provider: 'unknown_provider',
          idempotencyKey: 'idem-bad',
        }),
      ).rejects.toThrow('No adapter registered')
    })
  })

  describe('confirmPayment', () => {
    it('confirms payment and credits wallet', async () => {
      const result = await service.confirmPayment({
        intentId: 'intent-1',
        providerTransactionId: 'txn_123',
        correlationId: 'corr-1',
      })

      expect(result.intent.status).toBe(PaymentIntentStatus.CAPTURED)
      expect(result.capture).toBeDefined()
      expect(result.walletResult).not.toBeNull()
      expect(deps.walletCredit).toHaveBeenCalled()
      expect(deps.audit.log).toHaveBeenCalled()
    })

    it('throws for non-existent intent', async () => {
      vi.mocked(deps.intentRepo.findById).mockResolvedValueOnce(null)
      await expect(
        service.confirmPayment({
          intentId: 'missing',
          providerTransactionId: 'txn',
          correlationId: 'corr',
        }),
      ).rejects.toThrow('Intent not found')
    })

    it('throws for invalid state transition', async () => {
      vi.mocked(deps.intentRepo.findById).mockResolvedValueOnce(
        makeIntent({ status: PaymentIntentStatus.CAPTURED }),
      )

      await expect(
        service.confirmPayment({
          intentId: 'intent-1',
          providerTransactionId: 'txn',
          correlationId: 'corr',
        }),
      ).rejects.toThrow('Invalid transition')
    })

    it('skips wallet credit when no walletId in metadata', async () => {
      vi.mocked(deps.intentRepo.findById).mockResolvedValueOnce(
        makeIntent({ metadata: {} }),
      )

      const result = await service.confirmPayment({
        intentId: 'intent-1',
        providerTransactionId: 'txn',
        correlationId: 'corr',
      })
      expect(result.walletResult).toBeNull()
      expect(deps.walletCredit).not.toHaveBeenCalled()
    })
  })

  describe('processWebhook', () => {
    it('processes a valid webhook event', async () => {
      const result = await service.processWebhook({
        provider: PaymentProvider.STRIPE,
        eventId: 'evt-1',
        eventType: 'payment.succeeded',
        signature: 'sig-1',
        payload: '{}',
        parsedPayload: { intentId: 'intent-1', transactionId: 'txn-1' },
      })
      expect(result.processed).toBe(true)
      expect(result.intentId).toBe('intent-1')
      expect(deps.webhookRepo.save).toHaveBeenCalled()
      expect(deps.webhookRepo.markProcessed).toHaveBeenCalled()
    })

    it('skips already-processed events', async () => {
      vi.mocked(deps.webhookRepo.findById).mockResolvedValueOnce({
        id: 'evt-1',
        processed: true,
      })

      const result = await service.processWebhook({
        provider: PaymentProvider.STRIPE,
        eventId: 'evt-1',
        eventType: 'payment.succeeded',
        signature: 'sig-1',
        payload: '{}',
        parsedPayload: {},
      })
      expect(result.processed).toBe(true)
      expect(result.intentId).toBeNull()
      expect(deps.webhookRepo.save).not.toHaveBeenCalled()
    })

    it('rejects invalid webhook signature', async () => {
      const adapter = deps.adapters.get(PaymentProvider.STRIPE)!
      vi.mocked(adapter.verifyWebhook).mockReturnValueOnce(false)

      const result = await service.processWebhook({
        provider: PaymentProvider.STRIPE,
        eventId: 'evt-2',
        eventType: 'payment.succeeded',
        signature: 'bad-sig',
        payload: '{}',
        parsedPayload: {},
      })
      expect(result.processed).toBe(false)
      expect(deps.audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'payment.webhook.invalid_signature' }),
      )
    })

    it('handles event types that do not trigger confirmation', async () => {
      const result = await service.processWebhook({
        provider: PaymentProvider.STRIPE,
        eventId: 'evt-3',
        eventType: 'payment.created',
        signature: 'sig-1',
        payload: '{}',
        parsedPayload: {},
      })
      expect(result.processed).toBe(true)
      expect(result.intentId).toBeNull()
    })
  })

  describe('initiatePayout', () => {
    it('initiates a payout via flow + wallet debit + provider', async () => {
      const instruction = {
        id: 'payout-1',
        recipientId: 'recip-1',
        amount: 5000,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        status: 'pending' as any,
        destination: { type: 'bank' as any, details: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await service.initiatePayout({
        instruction,
        walletId: 'wallet-1',
        correlationId: 'corr-1',
      })

      expect(deps.flow.executeWorkflow).toHaveBeenCalled()
      expect(deps.walletDebit).toHaveBeenCalled()
      expect(result.instruction).toBeDefined()
      expect(result.walletResult).toBeDefined()
      expect(deps.audit.log).toHaveBeenCalled()
    })

    it('throws when wallet debit fails', async () => {
      vi.mocked(deps.walletDebit).mockResolvedValueOnce(
        makeWalletResult({ success: false, error: 'Insufficient funds' }),
      )

      const instruction = {
        id: 'payout-2',
        recipientId: 'recip-1',
        amount: 5000,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        status: 'pending' as any,
        destination: { type: 'bank' as any, details: {} },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await expect(
        service.initiatePayout({
          instruction,
          walletId: 'wallet-1',
          correlationId: 'corr-2',
        }),
      ).rejects.toThrow('Wallet debit failed')
    })
  })
})
