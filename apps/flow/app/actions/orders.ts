'use server'

import {
  listOrders,
  getOrderById,
  getOrderByRef,
  listOrderLines,
  createOrder,
  updateOrder,
  createOrderLine,
  updateOrderLine,
  deleteOrderLine,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'
import { executeCommand } from '@/lib/control/control-adapter'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getOrdersAction(opts?: {
  limit?: number
  offset?: number
  status?: string
  customerId?: string
}) {
  const ctx = await getReadContext()
  return listOrders(ctx, opts)
}

export async function getOrderAction(orderId: string) {
  const ctx = await getReadContext()
  return getOrderById(ctx, orderId)
}

export async function getOrderByRefAction(ref: string) {
  const ctx = await getReadContext()
  return getOrderByRef(ctx, ref)
}

export async function getOrderLinesAction(orderId: string) {
  const ctx = await getReadContext()
  return listOrderLines(ctx, orderId)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createOrderAction(data: {
  customerId: string
  quoteId?: string | null
  ref: string
  currency?: string
  subtotal: string
  taxTotal: string
  total: string
  shippingAddress?: Record<string, unknown> | null
  billingAddress?: Record<string, unknown> | null
  notes?: string | null
}) {
  const ctx = await getDbContext()
  const result = await createOrder(ctx, { ...data, createdBy: ctx.actorId })
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'ORDER_CREATED', orgId: ctx.orgId, actorId: ctx.actorId }))
  return result
}

/**
 * Update order. Status changes route through the command bus for governance;
 * non-status field updates go direct to commerce-db.
 */
export async function updateOrderAction(
  orderId: string,
  data: Partial<{
    status: string
    notes: string | null
    shippingAddress: Record<string, unknown> | null
    billingAddress: Record<string, unknown> | null
  }>,
) {
  // If there's a status change, route it through the command bus
  if (data.status) {
    const statusCommandMap: Record<string, string> = {
      confirmed: 'confirm_order',
      fulfillment: 'start_fulfillment',
      shipped: 'ship_order',
      delivered: 'mark_order_delivered',
      completed: 'complete_order',
      cancelled: 'cancel_order',
    }
    const commandType = statusCommandMap[data.status]
    if (commandType) {
      const result = await executeCommand({
        type: commandType,
        order_id: orderId,
        actor_id: '', // resolved by control adapter
      })
      if (!result.ok) return result
      // If there are other fields besides status, update those directly
      const { status: _, ...rest } = data
      if (Object.keys(rest).length > 0) {
        const ctx = await getDbContext()
        const result = await updateOrder(ctx, orderId, rest)
        await processEvidencePack(buildEvidencePackFromAction({ actionType: 'ORDER_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { orderId } }))
        return result
      }
      return result
    }
  }
  // Non-status updates go direct
  const ctx = await getDbContext()
  const result = await updateOrder(ctx, orderId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'ORDER_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { orderId } }))
  return result
}

export async function createOrderLineAction(
  orderId: string,
  data: {
    quoteLineId?: string | null
    description: string
    sku?: string | null
    quantity: number
    unitPrice: string
    discount?: string
    lineTotal: string
    sortOrder?: number
  },
) {
  const ctx = await getDbContext()
  const result = await createOrderLine(ctx, { orderId, ...data })
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'ORDER_LINE_CREATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { orderId } }))
  return result
}

export async function updateOrderLineAction(
  lineId: string,
  data: Partial<{
    description: string
    quantity: number
    unitPrice: string
    discount: string
    lineTotal: string
    sortOrder: number
  }>,
) {
  const ctx = await getDbContext()
  const result = await updateOrderLine(ctx, lineId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'ORDER_LINE_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { lineId } }))
  return result
}

export async function deleteOrderLineAction(lineId: string) {
  const ctx = await getDbContext()
  const result = await deleteOrderLine(ctx, lineId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'ORDER_LINE_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { lineId } }))
  return result
}
