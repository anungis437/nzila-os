'use server'

/**
 * Workflow Trigger Actions
 *
 * Server actions for key workflow transitions:
 * 1. Sales → Procurement: Create PO from accepted quote (via command bus)
 * 2. Receiving → Production: Trigger production readiness when all PO items received
 */
import { getReadContext } from '@/lib/clerk-org-resolver'
import { executeCommand } from '@/lib/control/control-adapter'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

// ── Sales → Procurement Trigger ────────────────────────────────────────────

export interface TriggerPOResult {
  ok: boolean
  orderId?: string
  poId?: string
  blockers?: string[]
  error?: string
}

/**
 * Create a Purchase Order from an accepted quote.
 *
 * Routes through the command bus for full guard/audit pipeline:
 * invariant → workflow → payment → service → event → audit.
 */
export async function triggerSalesToProcurementAction(
  quoteId: string,
): Promise<TriggerPOResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Not authenticated' }

  const result = await executeCommand({
    type: 'trigger_sales_to_procurement',
    quote_id: quoteId,
    actor_id: userId,
  })

  if (result.ok) {
    revalidatePath('/purchase-orders')
    revalidatePath(`/quotes/${quoteId}`)
  }

  return {
    ok: result.ok,
    orderId: result.data?.entity_id,
    error: result.error,
  }
}

// ── Check PO Receiving → Production Readiness ──────────────────────────────

export interface ProductionReadinessResult {
  ok: boolean
  allReceived: boolean
  orderId?: string
  orderRef?: string
  totalPOs: number
  receivedPOs: number
  pendingPOs: number
  message: string
}

/**
 * Check if all POs for an order are fully received.
 * If yes, update order status to "fulfillment" (production ready).
 *
 * Called after each PO line receive operation.
 */
export async function checkProductionReadinessAction(
  orderId: string,
): Promise<ProductionReadinessResult> {
  try {
    const ctx = await getReadContext()

    const { db, commerceOrders, commercePurchaseOrders } = await import('@nzila/db')
    const { eq, and } = await import('drizzle-orm')

    // Get the order
    const [order] = await db
      .select()
      .from(commerceOrders)
      .where(and(eq(commerceOrders.id, orderId), eq(commerceOrders.orgId, ctx.orgId)))
      .limit(1)

    if (!order) return { ok: false, allReceived: false, totalPOs: 0, receivedPOs: 0, pendingPOs: 0, message: 'Order not found' }

    // Get all POs linked to this order
    const pos = await db
      .select()
      .from(commercePurchaseOrders)
      .where(eq(commercePurchaseOrders.orderId, orderId))

    if (pos.length === 0) {
      return {
        ok: true,
        allReceived: false,
        orderId,
        orderRef: order.ref,
        totalPOs: 0,
        receivedPOs: 0,
        pendingPOs: 0,
        message: 'No purchase orders found for this order.',
      }
    }

    const receivedPOs = pos.filter((po) => po.status === 'received').length
    const pendingPOs = pos.length - receivedPOs
    const allReceived = receivedPOs === pos.length

    if (allReceived && order.status !== 'fulfillment' && order.status !== 'shipped' && order.status !== 'delivered' && order.status !== 'completed') {
      // Transition order to fulfillment (production ready)
      await db
        .update(commerceOrders)
        .set({
          status: 'fulfillment',
          updatedAt: new Date(),
        })
        .where(eq(commerceOrders.id, orderId))

      revalidatePath('/orders')
      revalidatePath(`/orders/${orderId}`)
    }

    return {
      ok: true,
      allReceived,
      orderId,
      orderRef: order.ref,
      totalPOs: pos.length,
      receivedPOs,
      pendingPOs,
      message: allReceived
        ? `All ${pos.length} PO(s) received. Order ${order.ref} is ready for production!`
        : `${receivedPOs}/${pos.length} PO(s) received. Waiting on ${pendingPOs} pending PO(s).`,
    }
  } catch (err) {
    return {
      ok: false,
      allReceived: false,
      totalPOs: 0,
      receivedPOs: 0,
      pendingPOs: 0,
      message: err instanceof Error ? err.message : 'Check failed',
    }
  }
}
