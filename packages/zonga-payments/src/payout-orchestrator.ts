/**
 * @nzila/zonga-payments — Payout Orchestrator
 *
 * Single execution path for all payouts. Enforces eligibility,
 * generates proofs, resolves routes, executes disbursements,
 * and emits audit events.
 *
 * HARD RULE: No payout executes without a valid, persisted proof.
 *
 * All monetary amounts are in integer minor units (cents).
 */
import type { PayoutInstruction, PaymentProvider } from './types'
import { PayoutStatus } from './types'
import { resolvePayoutRoute, type ProviderRoute } from './payouts'
import {
  generatePayoutProof,
  verifyProofIntegrity,
  markProofDisbursed,
  type PayoutProof,
  type PayoutProofInput,
  type RevenueSourceAmount,
} from '@nzila/zonga-rights'

// ── Ports (Dependency Injection) ──────────────────────────────────────────

export interface PayoutOrchestratorPorts {
  checkEligibility(recipientId: string, orgId: string): Promise<PayoutEligibility>
  loadPendingPayouts(orgId: string, recipientId?: string): Promise<readonly PayoutInstruction[]>
  executeProviderPayout(instruction: PayoutInstruction, route: ProviderRoute): Promise<PayoutExecutionResult>
  recordAuditEvent(event: PayoutAuditEvent): Promise<void>
  updatePayoutStatus(payoutId: string, status: PayoutStatus, providerRef?: string, failureReason?: string): Promise<void>
  /** Persist proof BEFORE payout execution — required */
  persistProof(proof: PayoutProof): Promise<void>
  /** Load revenue breakdown for proof generation */
  loadRevenueBreakdown(recipientId: string, orgId: string): Promise<readonly RevenueSourceAmount[]>
  /** Load royalty computation hashes that justify this payout */
  loadRoyaltyHashes(recipientId: string, orgId: string): Promise<readonly string[]>
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

      // 2. HARD GATE: Generate payout proof (BEFORE any execution)
      const [revenueBreakdown, royaltyHashes] = await Promise.all([
        ports.loadRevenueBreakdown(instruction.recipientId, orgId),
        ports.loadRoyaltyHashes(instruction.recipientId, orgId),
      ])

      const proofInput: PayoutProofInput = {
        payoutId: instruction.id,
        orgId,
        recipientId: instruction.recipientId,
        recipientName: instruction.destination.accountName,
        amountMinor: instruction.amount,
        currency: instruction.currency,
        revenueSourceBreakdown: revenueBreakdown,
        royaltyComputationHashes: royaltyHashes,
        provider: instruction.provider,
      }

      let proof: PayoutProof
      try {
        proof = generatePayoutProof(proofInput)
      } catch (proofError) {
        await ports.recordAuditEvent({
          eventType: 'payout_blocked',
          payoutId: instruction.id,
          orgId,
          recipientId: instruction.recipientId,
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: instruction.provider,
          details: { error: 'PAYOUT_BLOCKED_NO_PROOF', reason: String(proofError) },
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
          error: 'PAYOUT_BLOCKED_NO_PROOF',
        }
      }

      // 3. HARD GATE: Validate proof integrity
      if (!proof.proofHash || !verifyProofIntegrity(proof)) {
        await ports.recordAuditEvent({
          eventType: 'payout_blocked',
          payoutId: instruction.id,
          orgId,
          recipientId: instruction.recipientId,
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: instruction.provider,
          details: { error: 'PAYOUT_BLOCKED_INVALID_PROOF', proofId: proof.proofId },
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
          error: 'PAYOUT_BLOCKED_INVALID_PROOF',
        }
      }

      // 4. Persist proof BEFORE payout execution (non-negotiable)
      await ports.persistProof(proof)

      // 5. Resolve route
      const routeResult = resolvePayoutRoute(instruction.currency, countryFromCurrency(instruction.currency), instruction.method)
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
        // Mark proof as disbursed with provider reference
        const disbursedProof = markProofDisbursed(proof, result.providerRef ?? instruction.id)
        await ports.persistProof(disbursedProof)

        await ports.updatePayoutStatus(instruction.id, PayoutStatus.COMPLETED, result.providerRef ?? undefined)
        await ports.recordAuditEvent({
          eventType: 'payout_succeeded',
          payoutId: instruction.id,
          orgId,
          recipientId: instruction.recipientId,
          amountMinor: instruction.amount,
          currency: instruction.currency,
          provider: route.provider,
          details: { providerRef: result.providerRef, feeMinor: result.providerFeeMinor, proofId: proof.proofId },
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

// ── Helpers ───────────────────────────────────────────────────────────────

const CURRENCY_COUNTRY: Record<string, string> = {
  KES: 'KE', TZS: 'TZ', UGX: 'UG', NGN: 'NG', GHS: 'GH',
  ZAR: 'ZA', RWF: 'RW', XOF: 'SN', XAF: 'CM', MWK: 'MW',
  ZMW: 'ZM', BWP: 'BW', MAD: 'MA', LSL: 'LS', SZL: 'SZ',
}

function countryFromCurrency(currency: string): string {
  return CURRENCY_COUNTRY[currency] ?? 'XX'
}
