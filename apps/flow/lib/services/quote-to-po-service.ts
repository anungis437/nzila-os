/**
 * ShopMoiCa — Quote to PO Service
 *
 * Creates a Purchase Order from an approved, payment-cleared quote.
 * Validates PO readiness before creation.
 */
import { evaluatePOReadiness } from '@/lib/services/payment-gating-service'
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { quoteRepo } from '@/lib/db'
import type { QuoteLine } from '@/lib/db'
import { createPurchaseOrder, type CreatePOInput } from '@/lib/po-service'
import { createOrder, type CreateOrderInput } from '@/lib/production-service'
import { logger } from '@/lib/logger'

interface QuoteToPOResult {
  ok: boolean
  orderId?: string
  poId?: string
  blockers?: string[]
  error?: string
}

/**
 * Convert an approved quote to an order + purchase order.
 *
 * Prerequisites enforced:
 * 1. Quote must be in READY_FOR_PO status
 * 2. Payment gating must be cleared
 * 3. Required fields must be complete
 */
export async function createPurchaseOrderFromQuote(
  quoteId: string,
  supplierId: string,
  userId: string,
  orgId: string,
): Promise<QuoteToPOResult> {
  // Step 1 — Evaluate readiness
  const readiness = await evaluatePOReadiness(quoteId)
  if (!readiness.ready) {
    logger.warn('PO readiness check failed', { quoteId, blockers: readiness.blockers })
    emitWorkflowAuditEvent({
      event: 'quote_blocked_by_payment_policy',
      quoteId,
      orgId,
      userId,
      metadata: { blockers: readiness.blockers },
    })
    return { ok: false, blockers: readiness.blockers }
  }

  const quote = await quoteRepo.findById(quoteId)
  if (!quote) return { ok: false, error: 'Quote not found' }

  try {
    // Step 2 — Create Order from quote
    const orderInput: CreateOrderInput = {
      orgId,
      customerId: quote.customerId,
      quoteId,
      lines: (quote.lines ?? []).map((l: QuoteLine) => ({
        productId: l.id,
        description: l.description,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitCost,
        discount: undefined,
      })),
      notes: `Created from quote ${quote.reference ?? quoteId}`,
      userId,
    }

    const orderResult = await createOrder(orderInput)

    // Step 3 — Create PO from order
    const poInput: CreatePOInput = {
      orgId,
      supplierId,
      lines: orderInput.lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        sku: l.sku,
        quantity: l.quantity,
        unitCost: l.unitPrice,
        orderId: orderResult.order.id,
      })),
      notes: `PO for order from quote ${quote.reference ?? quoteId}`,
      createdBy: userId,
    }

    const poResult = await createPurchaseOrder(poInput)

    // Step 4 — Transition quote to IN_PRODUCTION
    const transition = attemptQuoteTransition('READY_FOR_PO', 'IN_PRODUCTION')
    if (transition.ok) {
      await quoteRepo.update(quoteId, { status: 'IN_PRODUCTION' })
    }

    // Step 5 — Audit + timeline
    await recordTimelineEvent({
      quoteId,
      event: 'po_created',
      description: `PO ${poResult.po.ref ?? poResult.po.id} created from quote. Order: ${orderResult.order.ref ?? orderResult.order.id}`,
      actor: userId,
      metadata: { orderId: orderResult.order.id, poId: poResult.po.id },
    })

    emitWorkflowAuditEvent({
      event: 'po_created_from_quote',
      quoteId,
      orgId,
      userId,
      metadata: { orderId: orderResult.order.id, poId: poResult.po.id },
    })

    logger.info('PO created from quote', { quoteId, orderId: orderResult.order.id, poId: poResult.po.id })
    return { ok: true, orderId: orderResult.order.id, poId: poResult.po.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to create PO from quote', { quoteId, error: msg })
    return { ok: false, error: msg }
  }
}
