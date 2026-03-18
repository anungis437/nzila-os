/**
 * Flow — Production Gating Service (Order-Centric)
 *
 * Controls transitions for in-production, shipped, delivered, and closed statuses.
 * Drives the ORDER workflow as the system center; also syncs quote status for
 * backward compatibility with quote-centric UI surfaces.
 */
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { attemptOrderTransition } from '@/lib/workflows/order-workflow'
import { evaluateProductionReadiness } from '@/lib/services/payment-gating-service'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { quoteRepo } from '@/lib/db'
import { orderRepo } from '@/lib/repositories/order-repo'
import { logger } from '@/lib/logger'
import type { QuoteWorkflowStatus } from '@/lib/schemas/workflow-schemas'
import type { OrderStatus } from '@/domain/entities'

interface GateResult {
  ok: boolean
  newStatus?: QuoteWorkflowStatus
  blockers?: string[]
  error?: string
}

/**
 * Start production for an order. Requires payment gate + valid order transition.
 * Drives the ORDER workflow (IN_PRODUCTION); syncs quote status for backward compat.
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

  // ── Order workflow (primary) ─────────────────────────────────────────────
  const order = await orderRepo.findById(orderId, orgId)
  if (order) {
    const orderStatus = (order.status?.toUpperCase() ?? 'CREATED') as OrderStatus
    const orderTransition = attemptOrderTransition(orderStatus, 'IN_PRODUCTION')
    if (!orderTransition.ok) {
      return { ok: false, error: orderTransition.reason }
    }
    await orderRepo.update(orderId, orgId, { status: 'fulfillment' })
  }

  // ── Quote workflow (backward compat sync) ────────────────────────────────
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'IN_PRODUCTION')
  if (!transition.ok && !order) {
    return { ok: false, error: transition.reason }
  }
  if (transition.ok) {
    await quoteRepo.update(quoteId, { status: 'IN_PRODUCTION' })
  }

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
 * Mark order as shipped. Drives order workflow (SHIPPED); syncs quote status.
 */
export async function markShipped(
  quoteId: string,
  userId: string,
  orgId: string,
  trackingInfo?: { carrier?: string; trackingNumber?: string },
  orderId?: string,
): Promise<GateResult> {
  // ── Order workflow (primary) ─────────────────────────────────────────────
  if (orderId) {
    const order = await orderRepo.findById(orderId, orgId)
    if (order) {
      const orderStatus = (order.status?.toUpperCase() ?? 'CREATED') as OrderStatus
      const orderTransition = attemptOrderTransition(orderStatus, 'SHIPPED')
      if (!orderTransition.ok) {
        return { ok: false, error: orderTransition.reason }
      }
      await orderRepo.update(orderId, orgId, { status: 'shipped' })
    }
  }

  // ── Quote workflow (backward compat sync) ────────────────────────────────
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'SHIPPED')
  if (transition.ok) {
    await quoteRepo.update(quoteId, { status: 'SHIPPED' })
  }

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
 * Mark order as delivered. Drives order workflow (DELIVERED); syncs quote status.
 */
export async function markDelivered(
  quoteId: string,
  userId: string,
  orgId: string,
  orderId?: string,
): Promise<GateResult> {
  // ── Order workflow (primary) ─────────────────────────────────────────────
  if (orderId) {
    const order = await orderRepo.findById(orderId, orgId)
    if (order) {
      const orderStatus = (order.status?.toUpperCase() ?? 'CREATED') as OrderStatus
      const orderTransition = attemptOrderTransition(orderStatus, 'DELIVERED')
      if (!orderTransition.ok) {
        return { ok: false, error: orderTransition.reason }
      }
      await orderRepo.update(orderId, orgId, { status: 'delivered' })
    }
  }

  // ── Quote workflow (backward compat sync) ────────────────────────────────
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'DELIVERED')
  if (transition.ok) {
    await quoteRepo.update(quoteId, { status: 'DELIVERED' })
  }

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
 * Close out a quote/order after delivery. Drives order workflow (CLOSED); syncs quote.
 */
export async function closeQuote(
  quoteId: string,
  userId: string,
  orgId: string,
  orderId?: string,
): Promise<GateResult> {
  // ── Order workflow (primary) ─────────────────────────────────────────────
  if (orderId) {
    const order = await orderRepo.findById(orderId, orgId)
    if (order) {
      const orderStatus = (order.status?.toUpperCase() ?? 'CREATED') as OrderStatus
      const orderTransition = attemptOrderTransition(orderStatus, 'CLOSED')
      if (!orderTransition.ok) {
        return { ok: false, error: orderTransition.reason }
      }
      await orderRepo.update(orderId, orgId, { status: 'completed' })
    }
  }

  // ── Quote workflow (backward compat sync) ────────────────────────────────
  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  const current = (quote.status?.toUpperCase() ?? 'DRAFT') as QuoteWorkflowStatus
  const transition = attemptQuoteTransition(current, 'CLOSED')
  if (transition.ok) {
    await quoteRepo.update(quoteId, { status: 'CLOSED' })
  }

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
