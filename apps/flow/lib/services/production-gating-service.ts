/**
 * ShopMoiCa — Production Gating Service
 *
 * Controls transitions for in-production, shipped, delivered, and closed statuses.
 * Enforces that all preconditions are met before advancing.
 */
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { evaluateProductionReadiness } from '@/lib/services/payment-gating-service'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { quoteRepo } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { QuoteWorkflowStatus } from '@/lib/schemas/workflow-schemas'

interface GateResult {
  ok: boolean
  newStatus?: QuoteWorkflowStatus
  blockers?: string[]
  error?: string
}

/**
 * Start production for a quote. Requires READY_FOR_PO status and all gates passed.
 */
export async function startProduction(
  quoteId: string,
  orderId: string,
  userId: string,
  orgId: string,
): Promise<GateResult> {
  const readiness = await evaluateProductionReadiness(quoteId, orderId)
  if (!readiness.ready) {
    return { ok: false, blockers: readiness.blockers }
  }

  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'IN_PRODUCTION')
  if (!transition.ok) {
    return { ok: false, error: transition.reason }
  }

  await quoteRepo.update(quoteId, { status: 'IN_PRODUCTION' })

  await recordTimelineEvent({
    quoteId,
    event: 'production_started',
    description: `Production started for order ${orderId}`,
    actor: userId,
    metadata: { orderId },
  })

  emitWorkflowAuditEvent({
    event: 'production_started',
    quoteId,
    orgId,
    userId,
    metadata: { orderId },
  })

  logger.info('Production started', { quoteId, orderId })
  return { ok: true, newStatus: 'IN_PRODUCTION' }
}

/**
 * Mark order as shipped.
 */
export async function markShipped(
  quoteId: string,
  userId: string,
  orgId: string,
  trackingInfo?: { carrier?: string; trackingNumber?: string },
): Promise<GateResult> {
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'SHIPPED')
  if (!transition.ok) {
    return { ok: false, error: transition.reason }
  }

  await quoteRepo.update(quoteId, { status: 'SHIPPED' })

  await recordTimelineEvent({
    quoteId,
    event: 'order_shipped',
    description: trackingInfo?.trackingNumber
      ? `Order shipped via ${trackingInfo.carrier ?? 'carrier'} — ${trackingInfo.trackingNumber}`
      : 'Order shipped',
    actor: userId,
    metadata: trackingInfo ?? {},
  })

  emitWorkflowAuditEvent({
    event: 'order_shipped',
    quoteId,
    orgId,
    userId,
    metadata: trackingInfo ?? {},
  })

  logger.info('Order shipped', { quoteId })
  return { ok: true, newStatus: 'SHIPPED' }
}

/**
 * Mark order as delivered.
 */
export async function markDelivered(
  quoteId: string,
  userId: string,
  orgId: string,
): Promise<GateResult> {
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'DELIVERED')
  if (!transition.ok) {
    return { ok: false, error: transition.reason }
  }

  await quoteRepo.update(quoteId, { status: 'DELIVERED' })

  await recordTimelineEvent({
    quoteId,
    event: 'order_delivered',
    description: 'Order delivered to customer',
    actor: userId,
  })

  emitWorkflowAuditEvent({
    event: 'order_delivered',
    quoteId,
    orgId,
    userId,
    metadata: {},
  })

  logger.info('Order delivered', { quoteId })
  return { ok: true, newStatus: 'DELIVERED' }
}

/**
 * Close out a quote after delivery.
 */
export async function closeQuote(
  quoteId: string,
  userId: string,
  orgId: string,
): Promise<GateResult> {
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'CLOSED')
  if (!transition.ok) {
    return { ok: false, error: transition.reason }
  }

  await quoteRepo.update(quoteId, { status: 'CLOSED' })

  await recordTimelineEvent({
    quoteId,
    event: 'quote_closed',
    description: 'Quote lifecycle completed — closed',
    actor: userId,
  })

  emitWorkflowAuditEvent({
    event: 'quote_closed',
    quoteId,
    orgId,
    userId,
    metadata: {},
  })

  logger.info('Quote closed', { quoteId })
  return { ok: true, newStatus: 'CLOSED' }
}
