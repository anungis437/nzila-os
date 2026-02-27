/**
 * @nzila/commerce-db — Inventory repository
 *
 * Org-scoped operations for commerce_inventory and commerce_stock_movements.
 * Reads use ReadOnlyScopedDb. Writes use AuditedScopedDb.
 *
 * @module @nzila/commerce-db/inventory
 */
import {
  createScopedDb,
  createAuditedScopedDb,
  commerceInventory,
  commerceStockMovements,
  commerceProducts,
} from '@nzila/db'
import { eq } from 'drizzle-orm'
import type { CommerceDbContext, CommerceReadContext, PaginationOpts } from '../types'

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'
type MovementType = 'receipt' | 'allocation' | 'adjustment' | 'return' | 'sale'

// ── Reads ─────────────────────────────────────────────────────────────────

export async function listInventory(
  ctx: CommerceReadContext,
  opts: PaginationOpts & { stockStatus?: StockStatus; productId?: string } = {},
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  let rows = await db.select(commerceInventory)

  if (opts.stockStatus) {
    rows = rows.filter((r) => r.stockStatus === opts.stockStatus)
  }

  if (opts.productId) {
    rows = rows.filter((r) => r.productId === opts.productId)
  }

  const sorted = rows.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    limit,
    offset,
  }
}

export async function getInventoryById(
  ctx: CommerceReadContext,
  inventoryId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(
    commerceInventory,
    eq(commerceInventory.id, inventoryId),
  )
  return rows[0] ?? null
}

export async function getInventoryByProductId(
  ctx: CommerceReadContext,
  productId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commerceInventory)
  return rows.find((r) => r.productId === productId) ?? null
}

export async function listLowStockProducts(ctx: CommerceReadContext) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const inventory = await db.select(commerceInventory)
  return inventory.filter(
    (i) =>
      i.stockStatus === 'low_stock' ||
      i.stockStatus === 'out_of_stock' ||
      i.currentStock <= i.reorderPoint,
  )
}

export async function getStockMovements(
  ctx: CommerceReadContext,
  opts: PaginationOpts & {
    inventoryId?: string
    productId?: string
    movementType?: MovementType
  } = {},
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const limit = Math.min(opts.limit ?? 100, 500)
  const offset = opts.offset ?? 0

  let rows = await db.select(commerceStockMovements)

  if (opts.inventoryId) {
    rows = rows.filter((r) => r.inventoryId === opts.inventoryId)
  }

  if (opts.productId) {
    rows = rows.filter((r) => r.productId === opts.productId)
  }

  if (opts.movementType) {
    rows = rows.filter((r) => r.movementType === opts.movementType)
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

export async function getInventorySummary(ctx: CommerceReadContext) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const [inventory, products] = await Promise.all([
    db.select(commerceInventory),
    db.select(commerceProducts),
  ])

  let totalStockValue = 0
  let totalItems = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  for (const inv of inventory) {
    const product = products.find((p) => p.id === inv.productId)
    if (product) {
      totalStockValue += inv.currentStock * parseFloat(product.costPrice)
      totalItems += inv.currentStock
    }
    if (inv.stockStatus === 'low_stock') lowStockCount++
    if (inv.stockStatus === 'out_of_stock') outOfStockCount++
  }

  return {
    totalProducts: inventory.length,
    totalItems,
    totalStockValue,
    lowStockCount,
    outOfStockCount,
  }
}

// ── Writes ────────────────────────────────────────────────────────────────

export async function createInventoryRecord(
  ctx: CommerceDbContext,
  values: {
    productId: string
    currentStock?: number
    allocatedStock?: number
    reorderPoint?: number
    minStockLevel?: number
    maxStockLevel?: number | null
    location?: string | null
    zohoWarehouseId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const available =
    (values.currentStock ?? 0) - (values.allocatedStock ?? 0)
  const stockStatus = calculateStockStatus(
    values.currentStock ?? 0,
    values.reorderPoint ?? 10,
    values.minStockLevel ?? 5,
  )

  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.insert(commerceInventory, {
    ...values,
    availableStock: available,
    stockStatus,
  })
}

export async function updateInventory(
  ctx: CommerceDbContext,
  inventoryId: string,
  values: Partial<{
    currentStock: number
    allocatedStock: number
    reorderPoint: number
    minStockLevel: number
    maxStockLevel: number | null
    location: string | null
    zohoWarehouseId: string | null
    metadata: Record<string, unknown>
  }>,
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  // Fetch current to recalculate derived fields
  const current = await getInventoryById(ctx, inventoryId)
  if (!current) throw new Error('Inventory record not found')

  const newCurrent = values.currentStock ?? current.currentStock
  const newAllocated = values.allocatedStock ?? current.allocatedStock
  const newReorderPoint = values.reorderPoint ?? current.reorderPoint
  const newMinLevel = values.minStockLevel ?? current.minStockLevel
  const available = newCurrent - newAllocated
  const stockStatus = calculateStockStatus(newCurrent, newReorderPoint, newMinLevel)

  return db.update(
    commerceInventory,
    {
      ...values,
      availableStock: available,
      stockStatus,
      updatedAt: new Date(),
    },
    eq(commerceInventory.id, inventoryId),
  )
}

export async function recordStockMovement(
  ctx: CommerceDbContext,
  values: {
    inventoryId: string
    productId: string
    movementType: MovementType
    quantity: number
    referenceType?: string | null
    referenceId?: string | null
    reason?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })

  // Create movement record
  const movement = await db.insert(commerceStockMovements, {
    ...values,
    performedBy: ctx.actorId,
  })

  // Update inventory counts
  const current = await getInventoryById(ctx, values.inventoryId)
  if (current) {
    const newStock = current.currentStock + values.quantity
    await updateInventory(ctx, values.inventoryId, {
      currentStock: newStock,
      ...(values.quantity > 0 && { lastRestockedAt: new Date() }),
    })
  }

  return movement
}

export async function adjustStock(
  ctx: CommerceDbContext,
  inventoryId: string,
  newQuantity: number,
  reason: string,
) {
  const current = await getInventoryById(ctx, inventoryId)
  if (!current) throw new Error('Inventory record not found')

  const adjustment = newQuantity - current.currentStock

  return recordStockMovement(ctx, {
    inventoryId,
    productId: current.productId,
    movementType: 'adjustment',
    quantity: adjustment,
    reason,
  })
}

export async function allocateStock(
  ctx: CommerceDbContext,
  inventoryId: string,
  quantity: number,
  orderId: string,
) {
  const current = await getInventoryById(ctx, inventoryId)
  if (!current) throw new Error('Inventory record not found')
  if (current.availableStock < quantity) {
    throw new Error('Insufficient available stock')
  }

  await updateInventory(ctx, inventoryId, {
    allocatedStock: current.allocatedStock + quantity,
  })

  return recordStockMovement(ctx, {
    inventoryId,
    productId: current.productId,
    movementType: 'allocation',
    quantity: -quantity,
    referenceType: 'order',
    referenceId: orderId,
    reason: `Allocated for order`,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────

function calculateStockStatus(
  currentStock: number,
  reorderPoint: number,
  minLevel: number,
): StockStatus {
  if (currentStock <= 0) return 'out_of_stock'
  if (currentStock <= minLevel || currentStock <= reorderPoint) return 'low_stock'
  return 'in_stock'
}
