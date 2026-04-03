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
  generatePORef,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'
import { executeCommand } from '@/lib/control/control-adapter'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

type POStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'partial_received'
  | 'received'
  | 'cancelled'

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
  const result = await createPurchaseOrder(ctx, { ...data, ref })
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PURCHASE_ORDER_CREATED', orgId: ctx.orgId, actorId: ctx.actorId }))
  return result
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
  const result = await addPurchaseOrderLine(ctx, purchaseOrderId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PO_LINE_ADDED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { purchaseOrderId } }))
  return result
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
  const result = await updatePurchaseOrder(ctx, purchaseOrderId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PURCHASE_ORDER_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { purchaseOrderId } }))
  return result
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
  const result = await updatePurchaseOrderLine(ctx, lineId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PO_LINE_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { lineId } }))
  return result
}

export async function deletePurchaseOrderLineAction(lineId: string) {
  const ctx = await getDbContext()
  const result = await deletePurchaseOrderLine(ctx, lineId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PO_LINE_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { lineId } }))
  return result
}

export async function deletePurchaseOrderAction(purchaseOrderId: string) {
  const ctx = await getDbContext()
  const result = await deletePurchaseOrder(ctx, purchaseOrderId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PURCHASE_ORDER_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { purchaseOrderId } }))
  return result
}

// ── Workflow Actions ──────────────────────────────────────────────────────

export async function sendPurchaseOrderAction(purchaseOrderId: string) {
  const result = await executeCommand({
    type: 'send_purchase_order',
    purchase_order_id: purchaseOrderId,
    actor_id: '', // resolved by control adapter
  })
  return result.ok
    ? { ...(await getPurchaseOrderById({ orgId: '', actorId: '' } as never, purchaseOrderId)) }
    : { error: result.error }
}

export async function acknowledgePurchaseOrderAction(purchaseOrderId: string) {
  const result = await executeCommand({
    type: 'confirm_purchase_order',
    purchase_order_id: purchaseOrderId,
    actor_id: '', // resolved by control adapter
  })
  return result.ok
    ? { ...(await getPurchaseOrderById({ orgId: '', actorId: '' } as never, purchaseOrderId)) }
    : { error: result.error }
}

export async function receiveLineAction(lineId: string, quantityReceived: number) {
  // Look up the PO for this line via a quick DB query
  const { db: database, commercePurchaseOrderLines } = await import('@nzila/db')
  const { eq } = await import('drizzle-orm')
  const [line] = await database
    .select({ purchaseOrderId: commercePurchaseOrderLines.purchaseOrderId })
    .from(commercePurchaseOrderLines)
    .where(eq(commercePurchaseOrderLines.id, lineId))
    .limit(1)

  if (!line) throw new Error('PO line not found')

  const result = await executeCommand({
    type: 'receive_po_line',
    line_id: lineId,
    purchase_order_id: line.purchaseOrderId,
    quantity_received: quantityReceived,
    actor_id: '',
  })
  if (!result.ok) throw new Error(result.error ?? 'Failed to record received quantity')
  return result.data
}

export async function cancelPurchaseOrderAction(purchaseOrderId: string) {
  const result = await executeCommand({
    type: 'cancel_purchase_order',
    purchase_order_id: purchaseOrderId,
    actor_id: '',
  })
  if (!result.ok) throw new Error(result.error ?? 'Failed to cancel purchase order')
  return result.data
}
