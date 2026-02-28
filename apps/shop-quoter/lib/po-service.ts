/**
 * Purchase Order Service
 *
 * Handles CRUD operations for purchase orders, including:
 * - PO creation with automatic reference numbering
 * - Line item management
 * - Receiving and inventory updates
 * - Zoho Books synchronization
 *
 * Ported from legacy shop_quoter_tool_v1 purchase-order-service.ts.
 */

import { and, eq, desc, sql, gte, lte } from 'drizzle-orm'
import {
  db,
  commercePurchaseOrders,
  commercePurchaseOrderLines,
  commerceSuppliers,
  commerceInventory,
  commerceStockMovements,
} from '@nzila/db'
import { logger } from './logger'
import { ZohoBooksClient } from './zoho/books-client'
import type { ZohoPurchaseOrder, ZohoPurchaseOrderLine } from './zoho/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type POStatus = 'draft' | 'sent' | 'acknowledged' | 'partial_received' | 'received' | 'cancelled'

export interface POLine {
  id?: string
  productId?: string
  description: string
  sku?: string
  quantity: number
  unitCost: number
  orderId?: string // mandate assignment
}

export interface CreatePOInput {
  entityId: string
  supplierId: string
  lines: POLine[]
  expectedDeliveryDate?: Date
  notes?: string
  currency?: string
  shippingCost?: number
  createdBy: string
}

export interface UpdatePOInput {
  lines?: POLine[]
  expectedDeliveryDate?: Date
  notes?: string
  shippingCost?: number
  status?: POStatus
}

export interface ReceiveLineInput {
  lineId: string
  quantityReceived: number
  receivedBy: string
  notes?: string
}

export interface POWithLines {
  po: typeof commercePurchaseOrders.$inferSelect
  lines: Array<typeof commercePurchaseOrderLines.$inferSelect>
  supplier: typeof commerceSuppliers.$inferSelect | null
}

export interface POListFilter {
  entityId: string
  status?: POStatus | POStatus[]
  supplierId?: string
  fromDate?: Date
  toDate?: Date
  search?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference Number Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generatePORef(entityId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PO-${year}-`

  // Get the last PO number for this entity and year
  const [lastPO] = await db
    .select({ ref: commercePurchaseOrders.ref })
    .from(commercePurchaseOrders)
    .where(
      and(
        eq(commercePurchaseOrders.entityId, entityId),
        sql`${commercePurchaseOrders.ref} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(commercePurchaseOrders.ref))
    .limit(1)

  if (!lastPO) {
    return `${prefix}001`
  }

  const lastNumber = parseInt(lastPO.ref.replace(prefix, ''), 10)
  const nextNumber = (lastNumber + 1).toString().padStart(3, '0')
  return `${prefix}${nextNumber}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calculateLineTotals(lines: POLine[]): { subtotal: number; lineItems: Array<POLine & { lineTotal: number }> } {
  let subtotal = 0
  const lineItems = lines.map((line) => {
    const lineTotal = line.quantity * line.unitCost
    subtotal += lineTotal
    return { ...line, lineTotal }
  })
  return { subtotal, lineItems }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(input: CreatePOInput): Promise<POWithLines> {
  const {
    entityId,
    supplierId,
    lines,
    expectedDeliveryDate,
    notes,
    currency = 'CAD',
    shippingCost = 0,
    createdBy,
  } = input

  const ref = await generatePORef(entityId)
  const { subtotal, lineItems } = calculateLineTotals(lines)
  const total = subtotal + shippingCost

  logger.info('Creating purchase order', { entityId, ref, supplierId, lineCount: lines.length })

  // Create PO in transaction
  const result = await db.transaction(async (tx) => {
    // Create PO header
    const [po] = await tx
      .insert(commercePurchaseOrders)
      .values({
        entityId,
        supplierId,
        ref,
        status: 'draft',
        currency,
        subtotal: subtotal.toFixed(2),
        taxTotal: '0', // Tax handled separately if needed
        shippingCost: shippingCost.toFixed(2),
        total: total.toFixed(2),
        expectedDeliveryDate,
        notes,
        createdBy,
      })
      .returning()

    // Create line items
    const insertedLines = await tx
      .insert(commercePurchaseOrderLines)
      .values(
        lineItems.map((line, index) => ({
          entityId,
          purchaseOrderId: po.id,
          productId: line.productId ?? null,
          description: line.description,
          sku: line.sku ?? null,
          quantity: line.quantity,
          unitCost: line.unitCost.toFixed(2),
          lineTotal: line.lineTotal.toFixed(2),
          sortOrder: index,
          orderId: line.orderId ?? null,
        })),
      )
      .returning()

    return { po, lines: insertedLines }
  })

  // Get supplier for return
  const [supplier] = await db
    .select()
    .from(commerceSuppliers)
    .where(eq(commerceSuppliers.id, supplierId))
    .limit(1)

  logger.info('Purchase order created', { poId: result.po.id, ref })

  return { ...result, supplier }
}

export async function getPurchaseOrder(poId: string): Promise<POWithLines | null> {
  const [po] = await db
    .select()
    .from(commercePurchaseOrders)
    .where(eq(commercePurchaseOrders.id, poId))
    .limit(1)

  if (!po) return null

  const lines = await db
    .select()
    .from(commercePurchaseOrderLines)
    .where(eq(commercePurchaseOrderLines.purchaseOrderId, poId))
    .orderBy(commercePurchaseOrderLines.sortOrder)

  const [supplier] = await db
    .select()
    .from(commerceSuppliers)
    .where(eq(commerceSuppliers.id, po.supplierId))
    .limit(1)

  return { po, lines, supplier }
}

export async function listPurchaseOrders(filter: POListFilter): Promise<POWithLines[]> {
  const conditions = [eq(commercePurchaseOrders.entityId, filter.entityId)]

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    conditions.push(sql`${commercePurchaseOrders.status} = ANY(${statuses})`)
  }

  if (filter.supplierId) {
    conditions.push(eq(commercePurchaseOrders.supplierId, filter.supplierId))
  }

  if (filter.fromDate) {
    conditions.push(gte(commercePurchaseOrders.createdAt, filter.fromDate))
  }

  if (filter.toDate) {
    conditions.push(lte(commercePurchaseOrders.createdAt, filter.toDate))
  }

  if (filter.search) {
    conditions.push(
      sql`(${commercePurchaseOrders.ref} ILIKE ${'%' + filter.search + '%'} OR ${commercePurchaseOrders.notes} ILIKE ${'%' + filter.search + '%'})`,
    )
  }

  const pos = await db
    .select()
    .from(commercePurchaseOrders)
    .where(and(...conditions))
    .orderBy(desc(commercePurchaseOrders.createdAt))

  // Batch load lines and suppliers
  const results: POWithLines[] = []
  for (const po of pos) {
    const lines = await db
      .select()
      .from(commercePurchaseOrderLines)
      .where(eq(commercePurchaseOrderLines.purchaseOrderId, po.id))
      .orderBy(commercePurchaseOrderLines.sortOrder)

    const [supplier] = await db
      .select()
      .from(commerceSuppliers)
      .where(eq(commerceSuppliers.id, po.supplierId))
      .limit(1)

    results.push({ po, lines, supplier })
  }

  return results
}

export async function updatePurchaseOrder(poId: string, input: UpdatePOInput): Promise<POWithLines | null> {
  const existing = await getPurchaseOrder(poId)
  if (!existing) return null

  // Only allow updates on draft or sent POs
  if (!['draft', 'sent'].includes(existing.po.status)) {
    throw new Error(`Cannot update PO in ${existing.po.status} status`)
  }

  await db.transaction(async (tx) => {
    // Update lines if provided
    if (input.lines) {
      // Delete existing lines
      await tx
        .delete(commercePurchaseOrderLines)
        .where(eq(commercePurchaseOrderLines.purchaseOrderId, poId))

      // Insert new lines
      const { subtotal, lineItems } = calculateLineTotals(input.lines)
      const shippingCost = input.shippingCost ?? Number(existing.po.shippingCost)
      const total = subtotal + shippingCost

      await tx
        .insert(commercePurchaseOrderLines)
        .values(
          lineItems.map((line, index) => ({
            entityId: existing.po.entityId,
            purchaseOrderId: poId,
            productId: line.productId ?? null,
            description: line.description,
            sku: line.sku ?? null,
            quantity: line.quantity,
            unitCost: line.unitCost.toFixed(2),
            lineTotal: line.lineTotal.toFixed(2),
            sortOrder: index,
            orderId: line.orderId ?? null,
          })),
        )

      await tx
        .update(commercePurchaseOrders)
        .set({
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(commercePurchaseOrders.id, poId))
    }

    // Update other fields
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.expectedDeliveryDate !== undefined) {
      updates.expectedDeliveryDate = input.expectedDeliveryDate
    }
    if (input.notes !== undefined) {
      updates.notes = input.notes
    }
    if (input.status !== undefined) {
      updates.status = input.status
    }
    if (input.shippingCost !== undefined && !input.lines) {
      const newTotal = Number(existing.po.subtotal) + input.shippingCost
      updates.shippingCost = input.shippingCost.toFixed(2)
      updates.total = newTotal.toFixed(2)
    }

    await tx
      .update(commercePurchaseOrders)
      .set(updates)
      .where(eq(commercePurchaseOrders.id, poId))
  })

  return getPurchaseOrder(poId)
}

export async function sendPurchaseOrder(poId: string): Promise<POWithLines | null> {
  const existing = await getPurchaseOrder(poId)
  if (!existing) return null

  if (existing.po.status !== 'draft') {
    throw new Error(`Cannot send PO in ${existing.po.status} status`)
  }

  await db
    .update(commercePurchaseOrders)
    .set({
      status: 'sent',
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(commercePurchaseOrders.id, poId))

  logger.info('Purchase order sent', { poId, ref: existing.po.ref })

  return getPurchaseOrder(poId)
}

export async function cancelPurchaseOrder(poId: string): Promise<POWithLines | null> {
  const existing = await getPurchaseOrder(poId)
  if (!existing) return null

  if (['received', 'cancelled'].includes(existing.po.status)) {
    throw new Error(`Cannot cancel PO in ${existing.po.status} status`)
  }

  await db
    .update(commercePurchaseOrders)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(commercePurchaseOrders.id, poId))

  logger.info('Purchase order cancelled', { poId, ref: existing.po.ref })

  return getPurchaseOrder(poId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Receiving Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function receivePOLine(input: ReceiveLineInput): Promise<typeof commercePurchaseOrderLines.$inferSelect> {
  const { lineId, quantityReceived, receivedBy, notes } = input

  // Get the line and its PO
  const [line] = await db
    .select()
    .from(commercePurchaseOrderLines)
    .where(eq(commercePurchaseOrderLines.id, lineId))
    .limit(1)

  if (!line) {
    throw new Error(`PO line ${lineId} not found`)
  }

  const [po] = await db
    .select()
    .from(commercePurchaseOrders)
    .where(eq(commercePurchaseOrders.id, line.purchaseOrderId))
    .limit(1)

  if (!po) {
    throw new Error(`PO not found for line ${lineId}`)
  }

  if (!['sent', 'acknowledged', 'partial_received'].includes(po.status)) {
    throw new Error(`Cannot receive items for PO in ${po.status} status`)
  }

  const newQuantityReceived = line.quantityReceived + quantityReceived
  if (newQuantityReceived > line.quantity) {
    throw new Error(`Cannot receive more than ordered quantity (${line.quantity})`)
  }

  logger.info('Receiving PO line items', {
    lineId,
    quantityReceived,
    previousReceived: line.quantityReceived,
    ordered: line.quantity,
  })

  await db.transaction(async (tx) => {
    // Update line quantity received
    await tx
      .update(commercePurchaseOrderLines)
      .set({
        quantityReceived: newQuantityReceived,
        updatedAt: new Date(),
      })
      .where(eq(commercePurchaseOrderLines.id, lineId))

    // Update inventory if product is linked
    if (line.productId) {
      // Get or create inventory record
      let [inventory] = await tx
        .select()
        .from(commerceInventory)
        .where(
          and(
            eq(commerceInventory.entityId, line.entityId),
            eq(commerceInventory.productId, line.productId),
          ),
        )
        .limit(1)

      if (!inventory) {
        [inventory] = await tx
          .insert(commerceInventory)
          .values({
            entityId: line.entityId,
            productId: line.productId,
            currentStock: 0,
            allocatedStock: 0,
            availableStock: 0,
          })
          .returning()
      }

      const newCurrentStock = inventory.currentStock + quantityReceived
      const newAvailableStock = newCurrentStock - inventory.allocatedStock

      await tx
        .update(commerceInventory)
        .set({
          currentStock: newCurrentStock,
          availableStock: newAvailableStock,
          lastRestockedAt: new Date(),
          stockStatus:
            newAvailableStock <= 0
              ? 'out_of_stock'
              : newAvailableStock <= inventory.reorderPoint
                ? 'low_stock'
                : 'in_stock',
          updatedAt: new Date(),
        })
        .where(eq(commerceInventory.id, inventory.id))

      // Record stock movement
      await tx.insert(commerceStockMovements).values({
        entityId: line.entityId,
        inventoryId: inventory.id,
        productId: line.productId,
        movementType: 'receipt',
        quantity: quantityReceived,
        referenceType: 'purchase_order',
        referenceId: po.id,
        reason: notes ?? `PO ${po.ref} receipt`,
        performedBy: receivedBy,
      })
    }

    // Check if all lines are fully received
    const allLines = await tx
      .select()
      .from(commercePurchaseOrderLines)
      .where(eq(commercePurchaseOrderLines.purchaseOrderId, po.id))

    // Recalculate after our update
    const updatedLines = allLines.map((l) =>
      l.id === lineId ? { ...l, quantityReceived: newQuantityReceived } : l,
    )

    const allReceived = updatedLines.every((l) => l.quantityReceived >= l.quantity)
    const someReceived = updatedLines.some((l) => l.quantityReceived > 0)

    let newStatus: POStatus = po.status as POStatus
    if (allReceived) {
      newStatus = 'received'
    } else if (someReceived) {
      newStatus = 'partial_received'
    }

    if (newStatus !== po.status) {
      await tx
        .update(commercePurchaseOrders)
        .set({
          status: newStatus,
          actualDeliveryDate: allReceived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(commercePurchaseOrders.id, po.id))
    }
  })

  // Return updated line
  const [updatedLine] = await db
    .select()
    .from(commercePurchaseOrderLines)
    .where(eq(commercePurchaseOrderLines.id, lineId))
    .limit(1)

  return updatedLine
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho Sync
// ─────────────────────────────────────────────────────────────────────────────

export async function syncPOToZoho(
  poId: string,
  booksClient: ZohoBooksClient,
): Promise<string> {
  const poData = await getPurchaseOrder(poId)
  if (!poData) {
    throw new Error(`PO ${poId} not found`)
  }

  const { po, lines, supplier } = poData

  // Get Zoho vendor ID from supplier
  const zohoVendorId = supplier?.zohoVendorId
  if (!zohoVendorId) {
    throw new Error(`Supplier ${supplier?.name ?? po.supplierId} not linked to Zoho`)
  }

  const zohoLineItems: ZohoPurchaseOrderLine[] = lines.map((line) => ({
    line_item_id: '',
    item_id: '', // Would need product's zohoItemId
    name: line.description ?? '',
    description: line.description,
    quantity: line.quantity,
    rate: Number(line.unitCost),
    amount: Number(line.lineTotal),
  }))

  const zohoPO: Partial<ZohoPurchaseOrder> = {
    vendor_id: zohoVendorId,
    purchaseorder_number: po.ref,
    date: po.createdAt.toISOString().split('T')[0],
    delivery_date: po.expectedDeliveryDate?.toISOString().split('T')[0],
    line_items: zohoLineItems,
  }

  let zohoPoId: string

  if (po.zohoPoId) {
    // Update existing
    const updated = await booksClient.updatePurchaseOrder(po.zohoPoId, zohoPO)
    zohoPoId = updated.purchaseorder_id
    logger.info('Updated PO in Zoho Books', { poId, zohoPoId })
  } else {
    // Create new
    const created = await booksClient.createPurchaseOrder(zohoPO)
    zohoPoId = created.purchaseorder_id

    // Store Zoho PO ID
    await db
      .update(commercePurchaseOrders)
      .set({ zohoPoId, updatedAt: new Date() })
      .where(eq(commercePurchaseOrders.id, poId))

    logger.info('Created PO in Zoho Books', { poId, zohoPoId })
  }

  return zohoPoId
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics / Reporting
// ─────────────────────────────────────────────────────────────────────────────

export interface POSummary {
  totalPOs: number
  totalValue: number
  byStatus: Record<POStatus, { count: number; value: number }>
  topSuppliers: Array<{ supplierId: string; supplierName: string; poCount: number; totalValue: number }>
}

export async function getPOSummary(entityId: string, fromDate?: Date, toDate?: Date): Promise<POSummary> {
  const conditions = [eq(commercePurchaseOrders.entityId, entityId)]

  if (fromDate) {
    conditions.push(gte(commercePurchaseOrders.createdAt, fromDate))
  }
  if (toDate) {
    conditions.push(lte(commercePurchaseOrders.createdAt, toDate))
  }

  const pos = await db
    .select({
      po: commercePurchaseOrders,
      supplier: commerceSuppliers,
    })
    .from(commercePurchaseOrders)
    .leftJoin(commerceSuppliers, eq(commercePurchaseOrders.supplierId, commerceSuppliers.id))
    .where(and(...conditions))

  const summary: POSummary = {
    totalPOs: pos.length,
    totalValue: 0,
    byStatus: {
      draft: { count: 0, value: 0 },
      sent: { count: 0, value: 0 },
      acknowledged: { count: 0, value: 0 },
      partial_received: { count: 0, value: 0 },
      received: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 },
    },
    topSuppliers: [],
  }

  const supplierMap = new Map<string, { name: string; count: number; value: number }>()

  for (const { po, supplier } of pos) {
    const value = Number(po.total)
    summary.totalValue += value

    const status = po.status as POStatus
    summary.byStatus[status].count++
    summary.byStatus[status].value += value

    if (supplier) {
      const existing = supplierMap.get(supplier.id) ?? { name: supplier.name, count: 0, value: 0 }
      existing.count++
      existing.value += value
      supplierMap.set(supplier.id, existing)
    }
  }

  summary.topSuppliers = Array.from(supplierMap.entries())
    .map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.name,
      poCount: data.count,
      totalValue: data.value,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10)

  return summary
}
