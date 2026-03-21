/**
 * @nzila/zonga-payments — Payment Flow Orchestration
 *
 * End-to-end payment flow:
 *   Client → Payment Intent → Provider → Flow → Economic Engine → Ledger → Wallet/Payout
 *
 * ALL mutations go through the Flow orchestrator.
 * ALL financial mutations go through the Economic Engine.
 * Idempotent at every step.
 *
 * @module @nzila/zonga-payments/flow
 */

import type {
  PaymentProviderAdapter,
  PaymentIntent,
  PaymentCapture,
  PayoutInstruction,
  CreateIntentParams,
} from './types'
import { PaymentIntentStatus, PaymentProvider } from './types'
import { canTransitionIntent } from './intents'
import type {
  Wallet,
  WalletOperationResult,
  CreditParams,
  DebitParams,
} from './wallet'
import { WalletTxType } from './wallet'

// ── Flow Ports ──────────────────────────────────────────────────────────────

/** Port for the orchestrator (Flow app). */
export interface FlowOrchestrator {
  executeWorkflow<T>(params: {
    workflowId: string
    input: Record<string, unknown>
    correlationId: string
  }): Promise<T>
}

/** Port for payment intent persistence. */
export interface PaymentIntentRepository {
  findById(intentId: string): Promise<PaymentIntent | null>
  findByIdempotencyKey(key: string): Promise<PaymentIntent | null>
  save(intent: PaymentIntent): Promise<PaymentIntent>
  updateStatus(intentId: string, status: PaymentIntentStatus): Promise<PaymentIntent>
}

/** Port for webhook event persistence. */
export interface WebhookEventRepository {
  findById(eventId: string): Promise<{ id: string; processed: boolean } | null>
  save(event: {
    id: string
    provider: string
    eventType: string
    payload: Record<string, unknown>
    signature: string
    processed: boolean
  }): Promise<void>
  markProcessed(eventId: string): Promise<void>
}

/** Port for audit logging. */
export interface AuditLogger {
  log(event: {
    type: string
    correlationId: string
    data: Record<string, unknown>
  }): Promise<void>
}

// ── Payment Flow Service ────────────────────────────────────────────────────

export interface PaymentFlowDeps {
  readonly adapters: Map<string, PaymentProviderAdapter>
  readonly intentRepo: PaymentIntentRepository
  readonly webhookRepo: WebhookEventRepository
  readonly flow: FlowOrchestrator
  readonly audit: AuditLogger
  readonly walletCredit: (params: CreditParams) => Promise<WalletOperationResult>
  readonly walletDebit: (params: DebitParams) => Promise<WalletOperationResult>
}

/**
 * Creates the payment flow service.
 * Orchestrates the full payment lifecycle through Flow.
 */
export function createPaymentFlowService(deps: PaymentFlowDeps) {
  const { adapters, intentRepo, webhookRepo, flow, audit, walletCredit, walletDebit } = deps

  function getAdapter(provider: string): PaymentProviderAdapter {
    const adapter = adapters.get(provider)
    if (!adapter) throw new Error(`No adapter registered for provider: ${provider}`)
    return adapter
  }

  return {
    /**
     * Step 1: Create a payment intent.
     * Idempotent — returns existing intent if idempotency key matches.
     */
    async createPaymentIntent(params: CreateIntentParams): Promise<PaymentIntent> {
      // Idempotency check
      const existing = await intentRepo.findByIdempotencyKey(params.idempotencyKey)
      if (existing) return existing

      const adapter = getAdapter(params.provider ?? '')

      // Route through Flow orchestrator
      const intent = await flow.executeWorkflow<PaymentIntent>({
        workflowId: 'zonga:payment:create-intent',
        correlationId: params.idempotencyKey,
        input: {
          step: 'create_intent',
          provider: adapter.provider,
          params,
        },
      })

      // Create via provider
      const providerIntent = await adapter.createIntent(params)

      // Persist
      const saved = await intentRepo.save(providerIntent)

      await audit.log({
        type: 'payment.intent.created',
        correlationId: params.idempotencyKey,
        data: {
          intentId: saved.id,
          provider: adapter.provider,
          amount: params.amount,
          currency: params.currency,
        },
      })

      return saved
    },

    /**
     * Step 2: Process a payment confirmation (from provider callback/webhook).
     * Routes through Flow → Economic Engine → Wallet.
     */
    async confirmPayment(params: {
      intentId: string
      providerTransactionId: string
      correlationId: string
    }): Promise<{
      intent: PaymentIntent
      capture: PaymentCapture
      walletResult: WalletOperationResult | null
    }> {
      const intent = await intentRepo.findById(params.intentId)
      if (!intent) throw new Error(`Intent not found: ${params.intentId}`)

      // Validate state transition
      const transition = canTransitionIntent(intent.status, PaymentIntentStatus.CAPTURED)
      if (!transition.allowed) {
        throw new Error(`Invalid transition for intent ${params.intentId}: ${transition.error}`)
      }

      const adapter = getAdapter(intent.provider)

      // Route through Flow
      await flow.executeWorkflow({
        workflowId: 'zonga:payment:confirm',
        correlationId: params.correlationId,
        input: {
          step: 'confirm_payment',
          intentId: params.intentId,
          provider: intent.provider,
        },
      })

      // Capture via provider
      const capture = await adapter.captureIntent(params.intentId)

      // Update intent status
      const updatedIntent = await intentRepo.updateStatus(
        params.intentId,
        PaymentIntentStatus.CAPTURED,
      )

      // Credit the user's wallet via Economic Engine
      let walletResult: WalletOperationResult | null = null
      if (intent.metadata?.walletId) {
        walletResult = await walletCredit({
          walletId: intent.metadata.walletId as string,
          amount: intent.amount,
          description: `Payment ${intent.id} — ${intent.provider}`,
          referenceId: params.providerTransactionId,
          idempotencyKey: `payment_credit_${intent.id}`,
          source: 'revenue_share',
        })
      }

      await audit.log({
        type: 'payment.confirmed',
        correlationId: params.correlationId,
        data: {
          intentId: params.intentId,
          capturedAmount: capture.capturedAmount,
          providerTransactionId: capture.providerTransactionId,
          walletCredited: walletResult?.success ?? false,
        },
      })

      return { intent: updatedIntent, capture, walletResult }
    },

    /**
     * Step 3: Process a webhook event from a payment provider.
     * Idempotent — skips already-processed events.
     */
    async processWebhook(params: {
      provider: string
      eventId: string
      eventType: string
      signature: string
      payload: string
      parsedPayload: Record<string, unknown>
    }): Promise<{ processed: boolean; intentId: string | null }> {
      // Idempotency: skip if already processed
      const existingEvent = await webhookRepo.findById(params.eventId)
      if (existingEvent?.processed) {
        return { processed: true, intentId: null }
      }

      const adapter = getAdapter(params.provider)

      // Verify webhook signature
      const isValid = adapter.verifyWebhook(params.signature, params.payload)
      if (!isValid) {
        await audit.log({
          type: 'payment.webhook.invalid_signature',
          correlationId: params.eventId,
          data: { provider: params.provider, eventType: params.eventType },
        })
        return { processed: false, intentId: null }
      }

      // Persist webhook event
      await webhookRepo.save({
        id: params.eventId,
        provider: params.provider,
        eventType: params.eventType,
        payload: params.parsedPayload,
        signature: params.signature,
        processed: false,
      })

      // Route to appropriate handler based on event type
      let intentId: string | null = null

      if (params.eventType.includes('succeeded') || params.eventType.includes('SUCCESSFUL')) {
        intentId = (params.parsedPayload.intentId as string) ?? null
        if (intentId) {
          await this.confirmPayment({
            intentId,
            providerTransactionId: (params.parsedPayload.transactionId as string) ?? params.eventId,
            correlationId: params.eventId,
          })
        }
      }

      await webhookRepo.markProcessed(params.eventId)

      return { processed: true, intentId }
    },

    /**
     * Step 4: Initiate a creator payout.
     * Flow: Debit wallet → Hold → Route to provider → Execute payout → Confirm
     */
    async initiatePayout(params: {
      instruction: PayoutInstruction
      walletId: string
      correlationId: string
    }): Promise<{
      instruction: PayoutInstruction
      walletResult: WalletOperationResult
    }> {
      // Route through Flow
      await flow.executeWorkflow({
        workflowId: 'zonga:payment:payout',
        correlationId: params.correlationId,
        input: {
          step: 'initiate_payout',
          instruction: params.instruction,
          walletId: params.walletId,
        },
      })

      // Debit wallet
      const walletResult = await walletDebit({
        walletId: params.walletId,
        amount: params.instruction.amount,
        description: `Payout ${params.instruction.id} — ${params.instruction.provider}`,
        referenceId: params.instruction.id,
        idempotencyKey: `payout_debit_${params.instruction.id}`,
        reason: 'payout',
      })

      if (!walletResult.success) {
        throw new Error(`Wallet debit failed for payout: ${walletResult.error}`)
      }

      // Execute via provider
      const adapter = getAdapter(params.instruction.provider)
      const executedInstruction = await adapter.createPayout(params.instruction)

      await audit.log({
        type: 'payment.payout.initiated',
        correlationId: params.correlationId,
        data: {
          payoutId: params.instruction.id,
          amount: params.instruction.amount,
          currency: params.instruction.currency,
          provider: params.instruction.provider,
        },
      })

      return { instruction: executedInstruction, walletResult }
    },
  }
}
