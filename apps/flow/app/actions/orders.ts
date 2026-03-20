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
  return createOrder(ctx, { ...data, createdBy: ctx.actorId })
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
        return updateOrder(ctx, orderId, rest)
      }
      return result
    }
  }
  // Non-status updates or unmapped statuses go direct
  const ctx = await getDbContext()
  return updateOrder(ctx, orderId, data)
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
  return createOrderLine(ctx, { orderId, ...data })
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
  return updateOrderLine(ctx, lineId, data)
}

export async function deleteOrderLineAction(lineId: string) {
  const ctx = await getDbContext()
  return deleteOrderLine(ctx, lineId)
}
