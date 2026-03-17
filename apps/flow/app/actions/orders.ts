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
import { auth } from '@clerk/nextjs/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

async function getDbContext(): Promise<CommerceDbContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return {
    orgId: orgId,
    actorId: userId,
    actorRole: 'user',
  }
}

async function getReadContext(): Promise<CommerceReadContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return { orgId: orgId }
}

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

export async function updateOrderAction(
  orderId: string,
  data: Partial<{
    status: string
    notes: string | null
    shippingAddress: Record<string, unknown> | null
    billingAddress: Record<string, unknown> | null
  }>,
) {
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
