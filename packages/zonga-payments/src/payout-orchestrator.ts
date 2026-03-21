/**
 * @nzila/zonga-payments — Payout Orchestrator
 *
 * Single execution path for all payouts. Enforces eligibility,
 * generates proofs, resolves routes, executes disbursements,
 * and emits audit events.
 *
 * All monetary amounts are in integer minor units (cents).
 */
import type { PayoutInstruction, PaymentProvider } from './types'
import { PayoutStatus } from './types'
import { resolvePayoutRoute, type ProviderRoute } from './payouts'

// ── Ports (Dependency Injection) ──────────────────────────────────────────

export interface PayoutOrchestratorPorts {
  checkEligibility(recipientId: string, orgId: string): Promise<PayoutEligibility>
  loadPendingPayouts(orgId: string, recipientId?: string): Promise<readonly PayoutInstruction[]>
  executeProviderPayout(instruction: PayoutInstruction, route: ProviderRoute): Promise<PayoutExecutionResult>
  recordAuditEvent(event: PayoutAuditEvent): Promise<void>
  updatePayoutStatus(payoutId: string, status: PayoutStatus, providerRef?: string, failureReason?: string): Promise<void>
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface PayoutEligibility {
  readonly eligible: boolean
  readonly recipientId: string
  readonly orgId: string
  readonly blockers: readonly string[]
  readonly kycVerified: boolean
  readonly balanceMinor: number
  readonly minimumPayoutMinor: number
  readonly hasActiveDisputes: boolean
}

export interface PayoutExecutionResult {
  readonly success: boolean
  readonly providerRef: string | null
  readonly error: string | null
  readonly providerFeeMinor: number
}

export interface PayoutAuditEvent {
  readonly eventType: 'payout_initiated' | 'payout_succeeded' | 'payout_failed' | 'payout_blocked'
  readonly payoutId: string
  readonly orgId: string
  readonly recipientId: string
  readonly amountMinor: number
  readonly currency: string
  readonly provider: string
  readonly details: Record<string, unknown>
  readonly timestamp: string
}

export interface OrchestratedPayoutResult {
  readonly payoutId: string
  readonly recipientId: string
  readonly status: 'completed' | 'failed' | 'blocked'
  readonly amountMinor: number
  readonly currency: string
  readonly provider: string
  readonly providerRef: string | null
  readonly error: string | null
}

// ── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Create a payout orchestrator service.
 * This is the SINGLE path through which all payouts must flow.
 */
export function createPayoutOrchestrator(ports: PayoutOrchestratorPorts) {
  return {
    /**
     * Execute a single payout with full eligibility check, routing, and audit.
     */
    async executePayout(
      instruction: PayoutInstruction,
      orgId: string,
    ): Promise<OrchestratedPayoutResult> {
      const timestamp = new Date().toISOString()

      // 1. Check eligibility
      const eligibility = await ports.checkEligibility(instruction.recipientId, orgId)
      if (!eligibility.eligible) {
        await ports.recordAuditEvent({
          eventType: 'payout_blocked',
          payoutId: instruction.id,
          orgId,
          recipientId: instruction.recipientId,
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: instruction.provider,
          details: { blockers: eligibility.blockers },
          timestamp,
        })

        return {
          payoutId: instruction.id,
          recipientId: instruction.recipientId,
          status: 'blocked',
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: instruction.provider,
          providerRef: null,
          error: eligibility.blockers.join('; '),
        }
      }

      // 2. Resolve route
      const routeResult = resolvePayoutRoute(instruction.currency, 'XX', instruction.method)
      const route = routeResult.route
      if (!route) {
        const routeError = routeResult.error ?? 'No route found'
        await ports.updatePayoutStatus(instruction.id, PayoutStatus.FAILED, undefined, routeError)
        await ports.recordAuditEvent({
          eventType: 'payout_failed',
          payoutId: instruction.id,
          orgId,
          recipientId: instruction.recipientId,
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: instruction.provider,
          details: { error: routeError },
          timestamp,
        })
        return {
          payoutId: instruction.id,
          recipientId: instruction.recipientId,
          status: 'failed',
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: instruction.provider,
          providerRef: null,
          error: routeError,
        }
      }

      // 3. Execute
      await ports.updatePayoutStatus(instruction.id, PayoutStatus.PROCESSING)
      await ports.recordAuditEvent({
        eventType: 'payout_initiated',
        payoutId: instruction.id,
        orgId,
        recipientId: instruction.recipientId,
        amountMinor: instruction.amount,
        currency: instruction.currency,
        provider: route.provider,
        details: { method: route.method },
        timestamp,
      })

      const result = await ports.executeProviderPayout(instruction, route)

      if (result.success) {
        await ports.updatePayoutStatus(instruction.id, PayoutStatus.COMPLETED, result.providerRef ?? undefined)
        await ports.recordAuditEvent({
          eventType: 'payout_succeeded',
          payoutId: instruction.id,
          orgId,
          recipientId: instruction.recipientId,
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: route.provider,
          details: { providerRef: result.providerRef, feeMinor: result.providerFeeMinor },
          timestamp: new Date().toISOString(),
        })
        return {
          payoutId: instruction.id,
          recipientId: instruction.recipientId,
          status: 'completed',
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: route.provider,
          providerRef: result.providerRef,
          error: null,
        }
      }

      await ports.updatePayoutStatus(instruction.id, PayoutStatus.FAILED, undefined, result.error ?? 'Unknown error')
      await ports.recordAuditEvent({
        eventType: 'payout_failed',
        payoutId: instruction.id,
        orgId,
        recipientId: instruction.recipientId,
        amountMinor: instruction.amount,
        currency: instruction.currency,
        provider: route.provider,
        details: { error: result.error },
        timestamp: new Date().toISOString(),
      })
      return {
        payoutId: instruction.id,
        recipientId: instruction.recipientId,
        status: 'failed',
        amountMinor: instruction.amount,
        currency: instruction.currency,
        provider: route.provider,
        providerRef: null,
        error: result.error,
      }
    },

    /**
     * Execute a batch of payouts for an org.
     */
    async executeBatch(
      orgId: string,
      recipientId?: string,
    ): Promise<readonly OrchestratedPayoutResult[]> {
      const instructions = await ports.loadPendingPayouts(orgId, recipientId)
      const results: OrchestratedPayoutResult[] = []

      for (const instruction of instructions) {
        const result = await this.executePayout(instruction, orgId)
        results.push(result)
      }

      return results
    },
  }
}
