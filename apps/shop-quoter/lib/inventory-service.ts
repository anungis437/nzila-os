/**
 * Inventory Service
 *
 * Handles products, inventory levels, and stock movements.
 * Ported from legacy shop_quoter_tool_v1 inventory-management.ts.
 */

import { and, eq, desc, sql, ilike, or, inArray } from 'drizzle-orm'
import {
  db,
  commerceProducts,
  commerceInventory,
  commerceStockMovements,
  commerceSuppliers,
} from '@nzila/db'
import { logger } from './logger'
import { ZohoInventoryClient } from './zoho/inventory-client'
import type { ZohoItem } from './zoho/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProductStatus = 'active' | 'inactive' | 'discontinued'
export type MovementType = 'in' | 'out' | 'adjustment' | 'transfer'

export interface CreateProductInput {
  entityId: string
  sku: string
  name: string
  description?: string
  categoryId?: string
  supplierId?: string
  unitCost?: number
  unitPrice?: number
  currency?: string
  unit?: string
  reorderPoint?: number
  reorderQty?: number
  leadTimeDays?: number
  weight?: number
  dimensions?: { length: number; width: number; height: number }
  tags?: string[]
}

export interface UpdateProductInput {
  name?: string
  description?: string
  categoryId?: string
  supplierId?: string
  unitCost?: number
  unitPrice?: number
  currency?: string
  unit?: string
  reorderPoint?: number
  reorderQty?: number
  leadTimeDays?: number
  weight?: number
  dimensions?: { length: number; width: number; height: number }
  status?: ProductStatus
  tags?: string[]
}

export interface ProductWithInventory {
  product: typeof commerceProducts.$inferSelect
  supplier: typeof commerceSuppliers.$inferSelect | null
  inventory: typeof commerceInventory.$inferSelect | null
}

export interface StockMovementInput {
  entityId: string
  productId: string
  type: MovementType
  quantity: number
  reason?: string
  referenceType?: string
  referenceId?: string
  costPerUnit?: number
  notes?: string
  userId?: string
}

export interface ProductListFilter {
  entityId: string
  status?: ProductStatus | ProductStatus[]
  search?: string
  categoryId?: string
  supplierId?: string
  lowStock?: boolean
  tags?: string[]
}

export interface InventorySnapshot {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  topCategories: { categoryId: string; count: number; value: number }[]
  recentMovements: (typeof commerceStockMovements.$inferSelect)[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Product CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductWithInventory> {
  logger.info('Creating product', { entityId: input.entityId, sku: input.sku })

  // Check for duplicate SKU
  const [existing] = await db
    .select({ id: commerceProducts.id })
    .from(commerceProducts)
    .where(and(eq(commerceProducts.entityId, input.entityId), eq(commerceProducts.sku, input.sku)))
    .limit(1)

  if (existing) {
    throw new Error(`Product with SKU ${input.sku} already exists`)
  }

  const [product] = await db
    .insert(commerceProducts)
    .values({
      entityId: input.entityId,
      sku: input.sku,
      name: input.name,
      description: input.description ?? null,
      category: input.categoryId ?? 'general',
      supplierId: input.supplierId ?? null,
      costPrice: input.unitCost?.toFixed(2) ?? '0.00',
      basePrice: input.unitPrice?.toFixed(2) ?? '0.00',
      weightGrams: input.weight ? Math.round(input.weight * 1000) : null,
      dimensions: input.dimensions
        ? `${input.dimensions.length}x${input.dimensions.width}x${input.dimensions.height}`
        : null,
      tags: input.tags ?? [],
      status: 'active',
    })
    .returning()

  // Initialize inventory record
  const [inventory] = await db
    .insert(commerceInventory)
    .values({
      entityId: input.entityId,
      productId: product.id,
      currentStock: 0,
      allocatedStock: 0,
      availableStock: 0,
      reorderPoint: input.reorderPoint ?? 10,
    })
    .returning()

  // Get supplier
  let supplier = null
  if (input.supplierId) {
    const [s] = await db
      .select()
      .from(commerceSuppliers)
      .where(eq(commerceSuppliers.id, input.supplierId))
      .limit(1)
    supplier = s
  }

  logger.info('Product created', { productId: product.id, sku: product.sku })

  return { product, supplier, inventory }
}

export async function getProduct(productId: string): Promise<ProductWithInventory | null> {
  const [product] = await db
    .select()
    .from(commerceProducts)
    .where(eq(commerceProducts.id, productId))
    .limit(1)

  if (!product) return null

  const [inventory] = await db
    .select()
    .from(commerceInventory)
    .where(eq(commerceInventory.productId, productId))
    .limit(1)

  let supplier = null
  if (product.supplierId) {
    const [s] = await db
      .select()
      .from(commerceSuppliers)
      .where(eq(commerceSuppliers.id, product.supplierId))
      .limit(1)
    supplier = s
  }

  return { product, supplier, inventory: inventory ?? null }
}

export async function getProductBySku(
  entityId: string,
  sku: string,
): Promise<ProductWithInventory | null> {
  const [product] = await db
    .select()
    .from(commerceProducts)
    .where(and(eq(commerceProducts.entityId, entityId), eq(commerceProducts.sku, sku)))
    .limit(1)

  if (!product) return null

  return getProduct(product.id)
}

export async function listProducts(filter: ProductListFilter): Promise<ProductWithInventory[]> {
  const conditions = [eq(commerceProducts.entityId, filter.entityId)]

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    conditions.push(sql`${commerceProducts.status} = ANY(${statuses})`)
  }

  if (filter.search) {
    conditions.push(
      or(
        ilike(commerceProducts.name, `%${filter.search}%`),
        ilike(commerceProducts.sku, `%${filter.search}%`),
        ilike(commerceProducts.description, `%${filter.search}%`),
      )!,
    )
  }

  if (filter.categoryId) {
    conditions.push(eq(commerceProducts.category, filter.categoryId))
  }

  if (filter.supplierId) {
    conditions.push(eq(commerceProducts.supplierId, filter.supplierId))
  }

  if (filter.tags && filter.tags.length > 0) {
    conditions.push(sql`${commerceProducts.tags} ?| ${filter.tags}`)
  }

  const products = await db
    .select()
    .from(commerceProducts)
    .where(and(...conditions))
    .orderBy(commerceProducts.name)

  // Get inventory for all products
  const productIds = products.map((p) => p.id)
  const inventories =
    productIds.length > 0
      ? await db.select().from(commerceInventory).where(inArray(commerceInventory.productId, productIds))
      : []

  const inventoryMap = new Map(inventories.map((i) => [i.productId, i]))

  // Get suppliers
  const supplierIds = [...new Set(products.map((p) => p.supplierId).filter(Boolean))] as string[]
  const suppliers =
    supplierIds.length > 0
      ? await db.select().from(commerceSuppliers).where(inArray(commerceSuppliers.id, supplierIds))
      : []

  const supplierMap = new Map(suppliers.map((s) => [s.id, s]))

  let results = products.map((product) => ({
    product,
    supplier: product.supplierId ? supplierMap.get(product.supplierId) ?? null : null,
    inventory: inventoryMap.get(product.id) ?? null,
  }))

  // Filter low stock if requested
  if (filter.lowStock) {
    results = results.filter((r) => {
      if (!r.inventory) return true // No inventory = out of stock
      return r.inventory.availableStock <= r.inventory.reorderPoint
    })
  }

  return results
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<typeof commerceProducts.$inferSelect | null> {
  const [existing] = await db
    .select()
    .from(commerceProducts)
    .where(eq(commerceProducts.id, productId))
    .limit(1)

  if (!existing) return null

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.categoryId !== undefined) updates.category = input.categoryId
  if (input.supplierId !== undefined) updates.supplierId = input.supplierId
  if (input.unitCost !== undefined) updates.costPrice = input.unitCost.toFixed(2)
  if (input.unitPrice !== undefined) updates.basePrice = input.unitPrice.toFixed(2)
  if (input.weight !== undefined) updates.weightGrams = input.weight ? Math.round(input.weight * 1000) : null
  if (input.dimensions !== undefined)
    updates.dimensions = input.dimensions
      ? `${input.dimensions.length}x${input.dimensions.width}x${input.dimensions.height}`
      : null
  if (input.status !== undefined) updates.status = input.status
  if (input.tags !== undefined) updates.tags = input.tags

  const [updated] = await db
    .update(commerceProducts)
    .set(updates)
    .where(eq(commerceProducts.id, productId))
    .returning()

  logger.info('Product updated', { productId, updates: Object.keys(updates) })

  return updated
}

export async function deleteProduct(productId: string): Promise<boolean> {
  // Check for stock movements
  const [existingMovement] = await db
    .select({ id: commerceStockMovements.id })
    .from(commerceStockMovements)
    .where(eq(commerceStockMovements.productId, productId))
    .limit(1)

  if (existingMovement) {
    throw new Error('Cannot delete product with stock movement history. Set status to discontinued instead.')
  }

  // Delete inventory record
  await db.delete(commerceInventory).where(eq(commerceInventory.productId, productId))

  // Delete product
  await db.delete(commerceProducts).where(eq(commerceProducts.id, productId))

  logger.info('Product deleted', { productId })

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock Movements & Inventory
// ─────────────────────────────────────────────────────────────────────────────

export async function recordStockMovement(
  input: StockMovementInput,
): Promise<typeof commerceStockMovements.$inferSelect> {
  const [product] = await db
    .select()
    .from(commerceProducts)
    .where(eq(commerceProducts.id, input.productId))
    .limit(1)

  if (!product) {
    throw new Error(`Product ${input.productId} not found`)
  }

  // Get current inventory
  let [inventory] = await db
    .select()
    .from(commerceInventory)
    .where(eq(commerceInventory.productId, input.productId))
    .limit(1)

  // Create inventory record if it doesn't exist
  if (!inventory) {
    const [created] = await db
      .insert(commerceInventory)
      .values({
        entityId: input.entityId,
        productId: input.productId,
        currentStock: 0,
        allocatedStock: 0,
        availableStock: 0,
      })
      .returning()
    inventory = created
  }

  const previousQty = inventory.currentStock

  // Calculate new quantity
  let newQty: number
  switch (input.type) {
    case 'in':
      newQty = previousQty + input.quantity
      break
    case 'out':
      newQty = previousQty - input.quantity
      if (newQty < 0) {
        throw new Error(`Insufficient stock. Available: ${previousQty}, Requested: ${input.quantity}`)
      }
      break
    case 'adjustment':
      newQty = input.quantity // Direct set
      break
    case 'transfer':
      // Transfer doesn't change total, just records movement
      newQty = previousQty
      break
    default:
      throw new Error(`Invalid movement type: ${input.type}`)
  }

  // Record movement
  const [movement] = await db
    .insert(commerceStockMovements)
    .values({
      entityId: input.entityId,
      inventoryId: inventory.id,
      productId: input.productId,
      movementType: input.type,
      quantity: input.type === 'adjustment' ? input.quantity - previousQty : input.quantity,
      reason: input.reason ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      performedBy: input.userId ?? 'system',
      metadata: {
        previousQuantity: previousQty,
        newQuantity: newQty,
        costPerUnit: input.costPerUnit ?? Number(product.costPrice),
        totalCost: (input.costPerUnit ?? Number(product.costPrice)) * Math.abs(input.quantity),
        notes: input.notes ?? null,
      },
    })
    .returning()

  // Update inventory
  await db
    .update(commerceInventory)
    .set({
      currentStock: newQty,
      availableStock: newQty - inventory.allocatedStock,
      updatedAt: new Date(),
    })
    .where(eq(commerceInventory.productId, input.productId))

  logger.info('Stock movement recorded', {
    productId: input.productId,
    type: input.type,
    quantity: input.quantity,
    previousQty,
    newQty,
  })

  return movement
}

export async function reserveStock(
  productId: string,
  quantity: number,
  referenceType?: string,
  referenceId?: string,
): Promise<boolean> {
  const [inventory] = await db
    .select()
    .from(commerceInventory)
    .where(eq(commerceInventory.productId, productId))
    .limit(1)

  if (!inventory) {
    throw new Error(`Inventory record not found for product ${productId}`)
  }

  const newReserved = inventory.allocatedStock + quantity
  const newAvailable = inventory.currentStock - newReserved

  if (newAvailable < 0) {
    throw new Error(`Insufficient available stock. Available: ${inventory.availableStock}, Requested: ${quantity}`)
  }

  await db
    .update(commerceInventory)
    .set({
      allocatedStock: newReserved,
      availableStock: newAvailable,
      updatedAt: new Date(),
    })
    .where(eq(commerceInventory.productId, productId))

  logger.info('Stock reserved', { productId, quantity, referenceType, referenceId })

  return true
}

export async function releaseReservation(productId: string, quantity: number): Promise<boolean> {
  const [inventory] = await db
    .select()
    .from(commerceInventory)
    .where(eq(commerceInventory.productId, productId))
    .limit(1)

  if (!inventory) {
    throw new Error(`Inventory record not found for product ${productId}`)
  }

  const newReserved = Math.max(0, inventory.allocatedStock - quantity)
  const newAvailable = inventory.currentStock - newReserved

  await db
    .update(commerceInventory)
    .set({
      allocatedStock: newReserved,
      availableStock: newAvailable,
      updatedAt: new Date(),
    })
    .where(eq(commerceInventory.productId, productId))

  logger.info('Reservation released', { productId, quantity })

  return true
}

export async function getStockHistory(
  productId: string,
  limit = 50,
): Promise<(typeof commerceStockMovements.$inferSelect)[]> {
  return db
    .select()
    .from(commerceStockMovements)
    .where(eq(commerceStockMovements.productId, productId))
    .orderBy(desc(commerceStockMovements.createdAt))
    .limit(limit)
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getInventorySnapshot(entityId: string): Promise<InventorySnapshot> {
  const products = await db
    .select()
    .from(commerceProducts)
    .where(and(eq(commerceProducts.entityId, entityId), eq(commerceProducts.status, 'active')))

  const productIds = products.map((p) => p.id)

  const inventories =
    productIds.length > 0
      ? await db.select().from(commerceInventory).where(inArray(commerceInventory.productId, productIds))
      : []

  const inventoryMap = new Map(inventories.map((i) => [i.productId, i]))

  let totalValue = 0
  let lowStockCount = 0
  let outOfStockCount = 0
  const categoryStats: Map<string, { count: number; value: number }> = new Map()

  for (const product of products) {
    const inventory = inventoryMap.get(product.id)
    const qty = inventory?.currentStock ?? 0
    const value = qty * Number(product.costPrice)
    totalValue += value

    if (qty === 0) {
      outOfStockCount++
    } else if (inventory && qty <= inventory.reorderPoint) {
      lowStockCount++
    }

    const cat = product.category ?? 'uncategorized'
    const stats = categoryStats.get(cat) ?? { count: 0, value: 0 }
    stats.count++
    stats.value += value
    categoryStats.set(cat, stats)
  }

  // Get recent movements
  const recentMovements = await db
    .select()
    .from(commerceStockMovements)
    .where(eq(commerceStockMovements.entityId, entityId))
    .orderBy(desc(commerceStockMovements.createdAt))
    .limit(10)

  // Sort categories by value
  const topCategories = Array.from(categoryStats.entries())
    .map(([categoryId, stats]) => ({ categoryId, ...stats }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return {
    totalProducts: products.length,
    totalValue,
    lowStockCount,
    outOfStockCount,
    topCategories,
    recentMovements,
  }
}

export async function getLowStockProducts(entityId: string): Promise<ProductWithInventory[]> {
  const products = await listProducts({ entityId, status: 'active', lowStock: true })
  return products
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho Sync
// ─────────────────────────────────────────────────────────────────────────────

export async function syncProductToZoho(
  productId: string,
  inventoryClient: ZohoInventoryClient,
): Promise<string> {
  const data = await getProduct(productId)
  if (!data) {
    throw new Error(`Product ${productId} not found`)
  }

  const { product, inventory } = data

  const zohoItem: Partial<ZohoItem> = {
    name: product.name,
    sku: product.sku,
    description: product.description ?? undefined,
    rate: Number(product.basePrice),
    purchase_rate: Number(product.costPrice),
    unit: 'qty',
    reorder_level: inventory?.reorderPoint ?? 10,
    stock_on_hand: inventory?.currentStock ?? 0,
  }

  let zohoItemId: string

  if (product.zohoItemId) {
    // Update existing
    const updated = await inventoryClient.updateItem(product.zohoItemId, zohoItem)
    zohoItemId = updated.item_id
    logger.info('Updated product in Zoho Inventory', { productId, zohoItemId })
  } else {
    // Create new
    const created = await inventoryClient.createItem(zohoItem)
    zohoItemId = created.item_id

    // Store Zoho item ID
    await db
      .update(commerceProducts)
      .set({ zohoItemId, updatedAt: new Date() })
      .where(eq(commerceProducts.id, productId))

    logger.info('Created product in Zoho Inventory', { productId, zohoItemId })
  }

  return zohoItemId
}

export async function syncProductFromZoho(
  entityId: string,
  zohoItem: ZohoItem,
  supplierId?: string,
): Promise<typeof commerceProducts.$inferSelect> {
  // Check if product already exists with this Zoho ID
  const [existing] = await db
    .select()
    .from(commerceProducts)
    .where(eq(commerceProducts.zohoItemId, zohoItem.item_id))
    .limit(1)

  if (existing) {
    // Update existing product
    const [updated] = await db
      .update(commerceProducts)
      .set({
        name: zohoItem.name,
        description: zohoItem.description ?? null,
        costPrice: (zohoItem.purchase_rate ?? 0).toFixed(2),
        basePrice: (zohoItem.rate ?? 0).toFixed(2),
        status: zohoItem.status === 'active' ? 'active' : 'inactive',
        updatedAt: new Date(),
      })
      .where(eq(commerceProducts.id, existing.id))
      .returning()

    // Update inventory
    if (zohoItem.stock_on_hand !== undefined) {
      await db
        .update(commerceInventory)
        .set({
          currentStock: zohoItem.stock_on_hand,
          availableStock: zohoItem.stock_on_hand,
          updatedAt: new Date(),
        })
        .where(eq(commerceInventory.productId, existing.id))
    }

    logger.info('Updated product from Zoho', { productId: updated.id })
    return updated
  } else {
    // Create new product
    const [created] = await db
      .insert(commerceProducts)
      .values({
        entityId,
        sku: zohoItem.sku ?? zohoItem.item_id,
        name: zohoItem.name,
        description: zohoItem.description ?? null,
        category: 'general',
        supplierId: supplierId ?? null,
        costPrice: (zohoItem.purchase_rate ?? 0).toFixed(2),
        basePrice: (zohoItem.rate ?? 0).toFixed(2),
        zohoItemId: zohoItem.item_id,
        status: zohoItem.status === 'active' ? 'active' : 'inactive',
      })
      .returning()

    // Create inventory record
    await db.insert(commerceInventory).values({
      entityId,
      productId: created.id,
      currentStock: zohoItem.stock_on_hand ?? 0,
      allocatedStock: 0,
      availableStock: zohoItem.stock_on_hand ?? 0,
    })

    logger.info('Created product from Zoho', { productId: created.id, zohoItemId: zohoItem.item_id })
    return created
  }
}
