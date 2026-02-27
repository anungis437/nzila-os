/**
 * @nzila/commerce-db — Purchase Orders repository
 *
 * Org-scoped CRUD for commerce_purchase_orders and commerce_purchase_order_lines.
 * Reads use ReadOnlyScopedDb. Writes use AuditedScopedDb.
 *
 * @module @nzila/commerce-db/purchase-orders
 */
import {
  createScopedDb,
  createAuditedScopedDb,
  commercePurchaseOrders,
  commercePurchaseOrderLines,
  commerceSuppliers,
} from '@nzila/db'
import { eq } from 'drizzle-orm'
import type { CommerceDbContext, CommerceReadContext, PaginationOpts } from '../types'

type POStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'partial_received'
  | 'received'
  | 'cancelled'

// ── Reads ─────────────────────────────────────────────────────────────────

export async function listPurchaseOrders(
  ctx: CommerceReadContext,
  opts: PaginationOpts & { status?: POStatus; supplierId?: string } = {},
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  let rows = await db.select(commercePurchaseOrders)

  if (opts.status) {
    rows = rows.filter((r) => r.status === opts.status)
  }

  if (opts.supplierId) {
    rows = rows.filter((r) => r.supplierId === opts.supplierId)
  }

  const sorted = rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    limit,
    offset,
  }
}

export async function getPurchaseOrderById(
  ctx: CommerceReadContext,
  purchaseOrderId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(
    commercePurchaseOrders,
    eq(commercePurchaseOrders.id, purchaseOrderId),
  )
  return rows[0] ?? null
}

export async function getPurchaseOrderByRef(
  ctx: CommerceReadContext,
  ref: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commercePurchaseOrders)
  return rows.find((r) => r.ref === ref) ?? null
}

export async function getPurchaseOrderByZohoId(
  ctx: CommerceReadContext,
  zohoPoId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commercePurchaseOrders)
  return rows.find((r) => r.zohoPoId === zohoPoId) ?? null
}

export async function getPurchaseOrderLines(
  ctx: CommerceReadContext,
  purchaseOrderId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commercePurchaseOrderLines)
  return rows
    .filter((r) => r.purchaseOrderId === purchaseOrderId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getPurchaseOrderWithLines(
  ctx: CommerceReadContext,
  purchaseOrderId: string,
) {
  const [po, lines] = await Promise.all([
    getPurchaseOrderById(ctx, purchaseOrderId),
    getPurchaseOrderLines(ctx, purchaseOrderId),
  ])

  if (!po) return null

  return { ...po, lines }
}

export async function getPurchaseOrdersForSupplier(
  ctx: CommerceReadContext,
  supplierId: string,
  opts: PaginationOpts = {},
) {
  return listPurchaseOrders(ctx, { ...opts, supplierId })
}

export async function getPurchaseOrdersSummary(ctx: CommerceReadContext) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const pos = await db.select(commercePurchaseOrders)

  const counts = {
    total: pos.length,
    draft: 0,
    sent: 0,
    acknowledged: 0,
    partialReceived: 0,
    received: 0,
    cancelled: 0,
    totalValue: 0,
    pendingValue: 0,
  }

  for (const po of pos) {
    const total = parseFloat(po.total)
    counts.totalValue += total

    switch (po.status) {
      case 'draft':
        counts.draft++
        break
      case 'sent':
        counts.sent++
        counts.pendingValue += total
        break
      case 'acknowledged':
        counts.acknowledged++
        counts.pendingValue += total
        break
      case 'partial_received':
        counts.partialReceived++
        break
      case 'received':
        counts.received++
        break
      case 'cancelled':
        counts.cancelled++
        break
    }
  }

  return counts
}

// ── Writes ────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(
  ctx: CommerceDbContext,
  values: {
    supplierId: string
    ref: string
    currency?: string
    expectedDeliveryDate?: Date | null
    notes?: string | null
    zohoPoId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.insert(commercePurchaseOrders, {
    ...values,
    status: 'draft',
    subtotal: '0',
    taxTotal: '0',
    shippingCost: '0',
    total: '0',
    createdBy: ctx.actorId,
  })
}

export async function addPurchaseOrderLine(
  ctx: CommerceDbContext,
  purchaseOrderId: string,
  values: {
    productId?: string | null
    description: string
    sku?: string | null
    quantity: number
    unitCost: string
    sortOrder?: number
    orderId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  const lineTotal = (values.quantity * parseFloat(values.unitCost)).toFixed(2)

  const line = await db.insert(commercePurchaseOrderLines, {
    purchaseOrderId,
    ...values,
    lineTotal,
    quantityReceived: 0,
  })

  // Recalculate PO totals
  await recalculatePOTotals(ctx, purchaseOrderId)

  return line
}

export async function updatePurchaseOrder(
  ctx: CommerceDbContext,
  purchaseOrderId: string,
  values: Partial<{
    status: POStatus
    expectedDeliveryDate: Date | null
    actualDeliveryDate: Date | null
    sentAt: Date | null
    notes: string | null
    zohoPoId: string | null
    shippingCost: string
    taxTotal: string
    metadata: Record<string, unknown>
  }>,
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  const result = await db.update(
    commercePurchaseOrders,
    { ...values, updatedAt: new Date() },
    eq(commercePurchaseOrders.id, purchaseOrderId),
  )

  // If shipping/tax changed, recalculate totals
  if ('shippingCost' in values || 'taxTotal' in values) {
    await recalculatePOTotals(ctx, purchaseOrderId)
  }

  return result
}

export async function updatePurchaseOrderLine(
  ctx: CommerceDbContext,
  lineId: string,
  values: Partial<{
    quantity: number
    unitCost: string
    quantityReceived: number
    sortOrder: number
    orderId: string | null
    metadata: Record<string, unknown>
  }>,
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  // Get current line to calc new total
  const allLines = await db.select(commercePurchaseOrderLines)
  const currentLine = allLines.find((l) => l.id === lineId)
  if (!currentLine) throw new Error('PO line not found')

  const newQty = values.quantity ?? currentLine.quantity
  const newCost = values.unitCost ?? currentLine.unitCost
  const lineTotal = (newQty * parseFloat(newCost)).toFixed(2)

  const result = await db.update(
    commercePurchaseOrderLines,
    { ...values, lineTotal, updatedAt: new Date() },
    eq(commercePurchaseOrderLines.id, lineId),
  )

  await recalculatePOTotals(ctx, currentLine.purchaseOrderId)

  return result
}

export async function deletePurchaseOrderLine(
  ctx: CommerceDbContext,
  lineId: string,
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  const allLines = await db.select(commercePurchaseOrderLines)
  const line = allLines.find((l) => l.id === lineId)
  if (!line) throw new Error('PO line not found')

  await db.delete(commercePurchaseOrderLines, eq(commercePurchaseOrderLines.id, lineId))
  await recalculatePOTotals(ctx, line.purchaseOrderId)
}

export async function deletePurchaseOrder(
  ctx: CommerceDbContext,
  purchaseOrderId: string,
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  // Delete all lines first
  const lines = await getPurchaseOrderLines(ctx, purchaseOrderId)
  for (const line of lines) {
    await db.delete(commercePurchaseOrderLines, eq(commercePurchaseOrderLines.id, line.id))
  }

  return db.delete(commercePurchaseOrders, eq(commercePurchaseOrders.id, purchaseOrderId))
}

// ── PO Workflow ───────────────────────────────────────────────────────────

export async function sendPurchaseOrder(
  ctx: CommerceDbContext,
  purchaseOrderId: string,
) {
  return updatePurchaseOrder(ctx, purchaseOrderId, {
    status: 'sent',
    sentAt: new Date(),
  })
}

export async function acknowledgePurchaseOrder(
  ctx: CommerceDbContext,
  purchaseOrderId: string,
) {
  return updatePurchaseOrder(ctx, purchaseOrderId, {
    status: 'acknowledged',
  })
}

export async function receiveLineItem(
  ctx: CommerceDbContext,
  lineId: string,
  quantityReceived: number,
) {
  const lines = await ctx.entityId // Need to fetch
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  const allLines = await db.select(commercePurchaseOrderLines)
  const line = allLines.find((l) => l.id === lineId)
  if (!line) throw new Error('PO line not found')

  const newReceived = Math.min(
    line.quantityReceived + quantityReceived,
    line.quantity,
  )

  await updatePurchaseOrderLine(ctx, lineId, {
    quantityReceived: newReceived,
  })

  // Check if all lines fully received
  const poLines = await getPurchaseOrderLines(ctx, line.purchaseOrderId)
  const allFullyReceived = poLines.every(
    (l) => l.id === lineId
      ? newReceived >= l.quantity
      : l.quantityReceived >= l.quantity,
  )
  const someReceived = poLines.some((l) => l.quantityReceived > 0)

  if (allFullyReceived) {
    await updatePurchaseOrder(ctx, line.purchaseOrderId, {
      status: 'received',
      actualDeliveryDate: new Date(),
    })
  } else if (someReceived) {
    await updatePurchaseOrder(ctx, line.purchaseOrderId, {
      status: 'partial_received',
    })
  }
}

export async function cancelPurchaseOrder(
  ctx: CommerceDbContext,
  purchaseOrderId: string,
) {
  return updatePurchaseOrder(ctx, purchaseOrderId, {
    status: 'cancelled',
  })
}

// ── Ref Generation ────────────────────────────────────────────────────────

export async function generatePORef(ctx: CommerceReadContext): Promise<string> {
  const db = createScopedDb({ orgId: ctx.entityId })
  const pos = await db.select(commercePurchaseOrders)

  const year = new Date().getFullYear()
  const prefix = `PO-${year}-`

  const existingRefs = pos
    .map((po) => po.ref)
    .filter((ref) => ref.startsWith(prefix))
    .map((ref) => parseInt(ref.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n))

  const maxNum = existingRefs.length > 0 ? Math.max(...existingRefs) : 0
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function recalculatePOTotals(ctx: CommerceDbContext, purchaseOrderId: string) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  const po = await getPurchaseOrderById(ctx, purchaseOrderId)
  if (!po) throw new Error('PO not found')

  const lines = await getPurchaseOrderLines(ctx, purchaseOrderId)
  const subtotal = lines.reduce((sum, l) => sum + parseFloat(l.lineTotal), 0)
  const taxTotal = parseFloat(po.taxTotal)
  const shipping = parseFloat(po.shippingCost)
  const total = subtotal + taxTotal + shipping

  await db.update(
    commercePurchaseOrders,
    {
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date(),
    },
    eq(commercePurchaseOrders.id, purchaseOrderId),
  )
}
