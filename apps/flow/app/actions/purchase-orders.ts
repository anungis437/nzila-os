'use server'

import {
  listPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrderWithLines,
  getPurchaseOrdersSummary,
  addPurchaseOrderLine,
  updatePurchaseOrder,
  updatePurchaseOrderLine,
  deletePurchaseOrderLine,
  deletePurchaseOrder,
  generatePORef,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/org-resolver'
import { executeCommand } from '@/lib/control/control-adapter'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { resolveOrgContext } from '@/lib/resolve-org'

// Status mutations for PO workflow that must go through command bus
const PO_STATUS_COMMAND_MAP: Record<string, string> = {
  sent: 'send_purchase_order',
  acknowledged: 'confirm_purchase_order',
  cancelled: 'cancel_purchase_order',
}

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
  orderId?: string
  supplierId: string
  ref?: string
  currency?: string
  expectedDeliveryDate?: Date | null
  notes?: string | null
}) {
  // Route through command bus — payment gate is enforced inside the handler
  const ctx = await resolveOrgContext()

  if (!data.orderId) {
    return { error: 'orderId is required for command-driven purchase order creation' }
  }

  const result = await executeCommand({
    type: 'create_purchase_order',
    vendor_id: data.supplierId,
    order_id: data.orderId,
    actor_id: ctx.actorId,
    notes: data.notes ?? undefined,
    expected_delivery: data.expectedDeliveryDate?.toISOString() ?? undefined,
  })

  if (!result.ok) return { error: result.error ?? 'Failed to create purchase order' }

  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PURCHASE_ORDER_CREATED', orgId: ctx.orgId, actorId: ctx.actorId }))
  return result.data
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
    // If there is a status transition, route through command bus — never mutate status directly
    if (data.status) {
      const commandType = PO_STATUS_COMMAND_MAP[data.status]
      if (commandType) {
        const result = await executeCommand({
          type: commandType,
          purchase_order_id: purchaseOrderId,
          actor_id: '',
        })
        if (!result.ok) return { error: result.error ?? 'Status transition failed' }
      } else {
        // Statuses not driven by command bus (e.g. partial_received, received) are managed
        // via receive_po_line handler — reject direct writes to these
        return { error: `Direct status mutation to "${data.status}" is not permitted. Use the appropriate command.` }
      }
    }

    // Non-status field updates (notes, dates, costs) are safe to write directly
    const { status: _, ...nonStatusFields } = data
    if (Object.keys(nonStatusFields).length > 0) {
      const ctx = await getDbContext()
      await updatePurchaseOrder(ctx, purchaseOrderId, nonStatusFields)
      await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PURCHASE_ORDER_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { purchaseOrderId } }))
    }

    const ctx = await getReadContext()
    return getPurchaseOrderById(ctx, purchaseOrderId)
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
