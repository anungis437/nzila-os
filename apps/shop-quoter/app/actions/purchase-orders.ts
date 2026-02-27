'use server'

import {
  listPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrderWithLines,
  getPurchaseOrdersSummary,
  createPurchaseOrder,
  addPurchaseOrderLine,
  updatePurchaseOrder,
  updatePurchaseOrderLine,
  deletePurchaseOrderLine,
  deletePurchaseOrder,
  sendPurchaseOrder,
  acknowledgePurchaseOrder,
  receiveLineItem,
  cancelPurchaseOrder,
  generatePORef,
} from '@nzila/commerce-db'
import { auth } from '@clerk/nextjs/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

type POStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'partial_received'
  | 'received'
  | 'cancelled'

async function getDbContext(): Promise<CommerceDbContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return {
    entityId: orgId,
    actorId: userId,
    actorRole: 'user',
  }
}

async function getReadContext(): Promise<CommerceReadContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return { entityId: orgId }
}

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getPurchaseOrdersAction(opts?: {
  limit?: number
  offset?: number
  status?: POStatus
  supplierId?: string
}) {
  const ctx = await getReadContext()
  return listPurchaseOrders(ctx, opts)
}

export async function getPurchaseOrderAction(purchaseOrderId: string) {
  const ctx = await getReadContext()
  return getPurchaseOrderById(ctx, purchaseOrderId)
}

export async function getPurchaseOrderWithLinesAction(purchaseOrderId: string) {
  const ctx = await getReadContext()
  return getPurchaseOrderWithLines(ctx, purchaseOrderId)
}

export async function getPurchaseOrdersSummaryAction() {
  const ctx = await getReadContext()
  return getPurchaseOrdersSummary(ctx)
}

export async function generatePORefAction() {
  const ctx = await getReadContext()
  return generatePORef(ctx)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createPurchaseOrderAction(data: {
  supplierId: string
  ref?: string
  currency?: string
  expectedDeliveryDate?: Date | null
  notes?: string | null
}) {
  const ctx = await getDbContext()
  const ref = data.ref ?? (await generatePORef(ctx))
  return createPurchaseOrder(ctx, { ...data, ref })
}

export async function addPurchaseOrderLineAction(
  purchaseOrderId: string,
  data: {
    productId?: string | null
    description: string
    sku?: string | null
    quantity: number
    unitCost: string
    sortOrder?: number
    orderId?: string | null
  },
) {
  const ctx = await getDbContext()
  return addPurchaseOrderLine(ctx, purchaseOrderId, data)
}

export async function updatePurchaseOrderAction(
  purchaseOrderId: string,
  data: Partial<{
    status: POStatus
    expectedDeliveryDate: Date | null
    actualDeliveryDate: Date | null
    sentAt: Date | null
    notes: string | null
    shippingCost: string
    taxTotal: string
  }>,
) {
  const ctx = await getDbContext()
  return updatePurchaseOrder(ctx, purchaseOrderId, data)
}

export async function updatePurchaseOrderLineAction(
  lineId: string,
  data: Partial<{
    quantity: number
    unitCost: string
    quantityReceived: number
    sortOrder: number
    orderId: string | null
  }>,
) {
  const ctx = await getDbContext()
  return updatePurchaseOrderLine(ctx, lineId, data)
}

export async function deletePurchaseOrderLineAction(lineId: string) {
  const ctx = await getDbContext()
  return deletePurchaseOrderLine(ctx, lineId)
}

export async function deletePurchaseOrderAction(purchaseOrderId: string) {
  const ctx = await getDbContext()
  return deletePurchaseOrder(ctx, purchaseOrderId)
}

// ── Workflow Actions ──────────────────────────────────────────────────────

export async function sendPurchaseOrderAction(purchaseOrderId: string) {
  const ctx = await getDbContext()
  return sendPurchaseOrder(ctx, purchaseOrderId)
}

export async function acknowledgePurchaseOrderAction(purchaseOrderId: string) {
  const ctx = await getDbContext()
  return acknowledgePurchaseOrder(ctx, purchaseOrderId)
}

export async function receiveLineAction(lineId: string, quantityReceived: number) {
  const ctx = await getDbContext()
  return receiveLineItem(ctx, lineId, quantityReceived)
}

export async function cancelPurchaseOrderAction(purchaseOrderId: string) {
  const ctx = await getDbContext()
  return cancelPurchaseOrder(ctx, purchaseOrderId)
}
