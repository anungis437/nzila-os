/**
 * ShopMoiCa — Payment Server Actions
 *
 * Server actions for setting deposit requirements, recording payments,
 * and checking PO/production readiness from the dashboard UI.
 */
'use server'

import type { SetPaymentRequirementInput, RecordPaymentEventInput } from '@/lib/schemas/workflow-schemas'
import {
  setPaymentRequirement,
  recordPayment,
  evaluatePOReadiness,
  evaluateProductionReadiness,
} from '@/lib/services/payment-gating-service'
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { quoteRepo } from '@/lib/db'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { getOrgPaymentPolicy } from '@nzila/platform-commerce-org/service'
import { logger } from '@/lib/logger'

interface ActionResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export async function setDepositRequirementAction(
  input: SetPaymentRequirementInput,
): Promise<ActionResult<{ requirementId: string }>> {
  try {
    const ctx = await resolveOrgContext()
    const requirement = await setPaymentRequirement(input, ctx.actorId, ctx.orgId)

    // Transition quote to DEPOSIT_REQUIRED if currently ACCEPTED
    const quote = await quoteRepo.findById(input.quoteId)
    if (quote && input.depositRequired) {
      const current = quote.status?.toUpperCase() ?? ''
      const transition = attemptQuoteTransition(current as 'ACCEPTED', 'DEPOSIT_REQUIRED')
      if (transition.ok) {
        await quoteRepo.update(input.quoteId, { status: 'DEPOSIT_REQUIRED' })
        await recordTimelineEvent({
          quoteId: input.quoteId,
          event: 'status_change',
          description: `Quote moved to DEPOSIT_REQUIRED`,
          actor: ctx.actorId,
        })
      }
    } else if (quote && !input.depositRequired) {
      const current = quote.status?.toUpperCase() ?? ''
      const transition = attemptQuoteTransition(current as 'ACCEPTED', 'READY_FOR_PO')
      if (transition.ok) {
        await quoteRepo.update(input.quoteId, { status: 'READY_FOR_PO' })
        await recordTimelineEvent({
          quoteId: input.quoteId,
          event: 'status_change',
          description: `Quote advanced to READY_FOR_PO (no deposit required)`,
          actor: ctx.actorId,
        })
        emitWorkflowAuditEvent({
          event: 'quote_unblocked_for_po',
          quoteId: input.quoteId,
          orgId: ctx.orgId,
          userId: ctx.actorId,
          metadata: {},
        })
      }
    }

    return { ok: true, data: { requirementId: requirement.id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to set deposit requirement', { error: msg })
    return { ok: false, error: msg }
  }
}

export async function recordPaymentAction(
  input: RecordPaymentEventInput,
): Promise<ActionResult<{ newStatus: string }>> {
  try {
    const ctx = await resolveOrgContext()
    const result = await recordPayment(input, ctx.actorId, ctx.orgId)

    // If payment is cleared, advance to READY_FOR_PO
    if (result.newStatus === 'PAID') {
      const quote = await quoteRepo.findById(input.quoteId)
      if (quote) {
        const current = quote.status?.toUpperCase() ?? ''
        const transition = attemptQuoteTransition(current as 'DEPOSIT_REQUIRED', 'READY_FOR_PO')
        if (transition.ok) {
          await quoteRepo.update(input.quoteId, { status: 'READY_FOR_PO' })
          await recordTimelineEvent({
            quoteId: input.quoteId,
            event: 'status_change',
            description: 'Deposit payment cleared — quote advanced to READY_FOR_PO',
            actor: ctx.actorId,
          })
          emitWorkflowAuditEvent({
            event: 'quote_unblocked_for_po',
            quoteId: input.quoteId,
            orgId: ctx.orgId,
            userId: ctx.actorId,
            metadata: { newStatus: result.newStatus },
          })
        }
      }
    }

    return { ok: true, data: { newStatus: result.newStatus } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to record payment', { error: msg })
    return { ok: false, error: msg }
  }
}

export async function checkPOReadinessAction(
  quoteId: string,
): Promise<ActionResult<{ ready: boolean; blockers: string[] }>> {
  try {
    const result = await evaluatePOReadiness(quoteId)
    return { ok: true, data: { ready: result.ready, blockers: result.blockers } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to check PO readiness', { error: msg })
    return { ok: false, error: msg }
  }
}

export async function checkProductionReadinessAction(
  quoteId: string,
  orderId: string,
): Promise<ActionResult<{ ready: boolean; blockers: string[] }>> {
  try {
    const result = await evaluateProductionReadiness(quoteId, orderId)
    return { ok: true, data: { ready: result.ready, blockers: result.blockers } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to check production readiness', { error: msg })
    return { ok: false, error: msg }
  }
}

/**
 * Auto-apply the org's payment policy to a quote.
 * Called when a quote is accepted to automatically set deposit requirements
 * based on the org's configured payment policy (depositRequired, defaultDepositPercent, etc.).
 */
export async function autoApplyOrgDepositPolicyAction(
  quoteId: string,
): Promise<ActionResult<{ requirementId: string; depositRequired: boolean }>> {
  try {
    const ctx = await resolveOrgContext()
    const policy = await getOrgPaymentPolicy(ctx.orgId)

    const quote = await quoteRepo.findById(quoteId)
    if (!quote) return { ok: false, error: 'Quote not found' }

    const depositAmount = policy.depositRequired && quote.total
      ? (policy.defaultDepositPercent / 100) * quote.total
      : 0

    const requirement = await setPaymentRequirement(
      {
        quoteId,
        depositRequired: policy.depositRequired,
        depositPercent: policy.depositRequired ? policy.defaultDepositPercent : undefined,
        depositAmount: policy.depositRequired ? depositAmount : undefined,
        dueBeforeProduction: policy.depositRequiredBeforeProduction,
      },
      ctx.actorId,
      ctx.orgId,
    )

    return {
      ok: true,
      data: { requirementId: requirement.id, depositRequired: policy.depositRequired },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to auto-apply org deposit policy', { error: msg })
    return { ok: false, error: msg }
  }
}
