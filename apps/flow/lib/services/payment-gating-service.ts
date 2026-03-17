/**
 * ShopMoiCa — Payment Gating Service
 *
 * Evaluates payment requirements and determines whether a quote
 * can advance to PO generation or production.
 *
 * Business rules:
 * - If quote.status === 'ACCEPTED' and a deposit is required,
 *   the quote must transition to DEPOSIT_REQUIRED before READY_FOR_PO.
 * - READY_FOR_PO requires that any deposit requirement has been met.
 * - Production cannot start if deposit policy blocks it.
 */
import type {
  SetPaymentRequirementInput,
  RecordPaymentEventInput,
  QuotePaymentRequirement,
  PaymentStatusValue,
  POReadinessResult,
  ProductionReadinessResult,
} from '@/lib/schemas/workflow-schemas'
import { SetPaymentRequirementInput as SetPaymentRequirementZod } from '@/lib/schemas/workflow-schemas'
import {
  paymentRequirementRepo,
  paymentStatusRepo,
  paymentEventRepo,
  recordTimelineEvent,
} from '@/lib/repositories/workflow-repository'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { quoteRepo } from '@/lib/db'
import { logger } from '@/lib/logger'

// ── Set Deposit Requirement ────────────────────────────────────────────────

export async function setPaymentRequirement(
  input: SetPaymentRequirementInput,
  userId: string,
  orgId: string,
): Promise<QuotePaymentRequirement> {
  const parsed = SetPaymentRequirementZod.parse(input)

  const quote = await quoteRepo.findById(parsed.quoteId)
  if (!quote) throw new Error('Quote not found')

  const requirement: QuotePaymentRequirement = {
    id: crypto.randomUUID(),
    quoteId: parsed.quoteId,
    depositRequired: parsed.depositRequired,
    depositPercent: parsed.depositPercent ?? null,
    depositAmount: parsed.depositAmount ?? null,
    dueBeforeProduction: parsed.dueBeforeProduction,
    createdAt: new Date(),
  }

  await paymentRequirementRepo.save(requirement)

  // Initialise payment status
  if (parsed.depositRequired) {
    const amountDue =
      parsed.depositAmount ??
      (parsed.depositPercent && quote.total
        ? (parsed.depositPercent / 100) * Number(quote.total)
        : 0)

    await paymentStatusRepo.upsertForQuote(parsed.quoteId, {
      status: 'PENDING_DEPOSIT',
      amountDue,
      amountPaid: 0,
    })
  } else {
    await paymentStatusRepo.upsertForQuote(parsed.quoteId, {
      status: 'NOT_REQUIRED',
      amountDue: 0,
      amountPaid: 0,
    })
  }

  await recordTimelineEvent({
    quoteId: parsed.quoteId,
    event: 'deposit_requirement_set',
    description: parsed.depositRequired
      ? `Deposit required: ${parsed.depositPercent ?? 0}% / $${parsed.depositAmount ?? 0}`
      : 'No deposit required',
    actor: userId,
  })

  emitWorkflowAuditEvent({
    event: 'deposit_required_set',
    quoteId: parsed.quoteId,
    orgId,
    userId,
    metadata: { depositRequired: parsed.depositRequired, percent: parsed.depositPercent },
  })

  logger.info('Payment requirement set', { quoteId: parsed.quoteId, depositRequired: parsed.depositRequired })
  return requirement
}

// ── Record Payment Event ───────────────────────────────────────────────────

export async function recordPayment(
  input: RecordPaymentEventInput,
  userId: string,
  orgId: string,
): Promise<{ newStatus: PaymentStatusValue }> {
  const event = {
    id: crypto.randomUUID(),
    quoteId: input.quoteId,
    eventType: input.eventType,
    amount: input.amount,
    providerRef: input.providerRef ?? null,
    metadataJson: input.metadata ?? null,
    createdAt: new Date(),
  }
  await paymentEventRepo.save(event)

  // Update payment status
  const requirement = await paymentRequirementRepo.findByQuoteId(input.quoteId)
  const currentStatus = await paymentStatusRepo.findByQuoteId(input.quoteId)
  const totalPaid = (currentStatus?.amountPaid ?? 0) + input.amount
  const amountDue = currentStatus?.amountDue ?? 0

  let newStatus: PaymentStatusValue = 'NOT_REQUIRED'
  if (requirement?.depositRequired) {
    if (totalPaid >= amountDue) {
      newStatus = 'PAID'
    } else if (totalPaid > 0) {
      newStatus = 'PARTIALLY_PAID'
    } else {
      newStatus = 'PENDING_DEPOSIT'
    }
  }

  await paymentStatusRepo.upsertForQuote(input.quoteId, {
    status: newStatus,
    amountPaid: totalPaid,
  })

  await recordTimelineEvent({
    quoteId: input.quoteId,
    event: 'payment_recorded',
    description: `Payment of $${input.amount.toFixed(2)} recorded (${input.eventType}). Total paid: $${totalPaid.toFixed(2)}`,
    actor: userId,
  })

  emitWorkflowAuditEvent({
    event: 'payment_status_changed',
    quoteId: input.quoteId,
    orgId,
    userId,
    metadata: { eventType: input.eventType, amount: input.amount, newStatus },
  })

  logger.info('Payment recorded', { quoteId: input.quoteId, newStatus, totalPaid })
  return { newStatus }
}

// ── PO Readiness Check ─────────────────────────────────────────────────────

export async function evaluatePOReadiness(quoteId: string): Promise<POReadinessResult> {
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) {
    return {
      ready: false,
      blockers: ['Quote not found'],
      quoteId,
      quoteStatus: 'DRAFT',
      paymentCleared: false,
      supplierSelected: false,
      requiredFieldsComplete: false,
    }
  }

  const blockers: string[] = []
  const status = quote.status?.toUpperCase() ?? 'DRAFT'

  // Must be in READY_FOR_PO status
  if (status !== 'READY_FOR_PO') {
    blockers.push(`Quote must be in READY_FOR_PO status (current: ${status})`)
  }

  // Check payment gating
  const requirement = await paymentRequirementRepo.findByQuoteId(quoteId)
  const paymentStatus = await paymentStatusRepo.findByQuoteId(quoteId)
  const paymentCleared =
    !requirement?.depositRequired ||
    paymentStatus?.status === 'PAID' ||
    paymentStatus?.status === 'NOT_REQUIRED'

  if (!paymentCleared) {
    blockers.push(`Deposit payment is ${paymentStatus?.status ?? 'unknown'} — must be PAID before PO`)
  }

  // Check required fields
  const requiredFieldsComplete = Boolean(
    quote.title && quote.customerId && quote.total,
  )
  if (!requiredFieldsComplete) {
    blockers.push('Quote is missing required fields (title, customer, or total)')
  }

  // Supplier check is informational — we check if any PO lines have products
  const supplierSelected = true // placeholder — real check against PO supplier

  return {
    ready: blockers.length === 0,
    blockers,
    quoteId,
    quoteStatus: status as POReadinessResult['quoteStatus'],
    paymentCleared,
    supplierSelected,
    requiredFieldsComplete,
  }
}

// ── Production Readiness Check ─────────────────────────────────────────────

export async function evaluateProductionReadiness(
  quoteId: string,
  orderId: string,
): Promise<ProductionReadinessResult> {
  const blockers: string[] = []

  const quote = await quoteRepo.findById(quoteId)
  if (!quote) {
    blockers.push('Quote not found')
  }

  const status = quote?.status?.toUpperCase() ?? ''
  if (status !== 'READY_FOR_PO' && status !== 'IN_PRODUCTION') {
    blockers.push(`Quote is not in an appropriate status for production (current: ${status})`)
  }

  // Check payment gate
  const requirement = await paymentRequirementRepo.findByQuoteId(quoteId)
  const paymentStatus = await paymentStatusRepo.findByQuoteId(quoteId)
  const paymentCleared =
    !requirement?.depositRequired ||
    !requirement?.dueBeforeProduction ||
    paymentStatus?.status === 'PAID' ||
    paymentStatus?.status === 'NOT_REQUIRED'

  if (!paymentCleared) {
    blockers.push('Deposit must be paid before production can start')
  }

  return {
    ready: blockers.length === 0,
    blockers,
    orderId,
    poValid: true, // placeholder — real validation against PO table
    paymentCleared,
    detailsComplete: Boolean(quote?.title && quote?.customerId),
  }
}
