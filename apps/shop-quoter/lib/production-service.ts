/**
 * Production Planning Service
 *
 * Handles order fulfillment, material allocation, and production scheduling.
 * Ported from legacy shop_quoter_tool_v1 MandateProductionPlanningDashboard.
 *
 * Key concepts:
 * - Mandate: A confirmed customer order requiring fulfillment
 * - Allocation: Reserved inventory for an order
 * - Production Schedule: Planned work to fulfill orders
 */

import { and, eq, desc, sql, gte, lte, inArray, or, ne } from 'drizzle-orm'
import {
  db,
  commerceOrders,
  commerceOrderLines,
  commerceCustomers,
  commerceProducts,
  commerceInventory,
  commerceMandateAllocations,
  commerceStockMovements,
} from '@nzila/db'
import { logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'created'
  | 'confirmed'
  | 'fulfillment'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_requested'
  | 'needs_attention'

export type AllocationStatus = 'reserved' | 'allocated' | 'fulfilled' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface OrderLine {
  productId: string
  description: string
  sku?: string
  quantity: number
  unitPrice: number
  discount?: number
}

export interface CreateOrderInput {
  entityId: string
  customerId: string
  quoteId?: string
  lines: OrderLine[]
  currency?: string
  shippingAddress?: {
    street?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
  }
  billingAddress?: {
    street?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
  }
  notes?: string
  userId: string
}

export interface AllocationInput {
  orderId: string
  productId: string
  quantity: number
  priority?: Priority
  expectedFulfillmentDate?: Date
  notes?: string
}

export interface OrderWithDetails {
  order: typeof commerceOrders.$inferSelect
  customer: typeof commerceCustomers.$inferSelect
  lines: (typeof commerceOrderLines.$inferSelect)[]
  allocations: (typeof commerceMandateAllocations.$inferSelect)[]
}

export interface ProductionScheduleItem {
  orderId: string
  orderRef: string
  customerId: string
  customerName: string
  productId: string
  productName: string
  sku: string
  quantityRequired: number
  quantityAllocated: number
  quantityFulfilled: number
  quantityShortage: number
  stockAvailable: number
  priority: Priority
  expectedFulfillmentDate: Date | null
  status: AllocationStatus
}

export interface ProductionDashboard {
  summary: {
    totalOrders: number
    ordersInFulfillment: number
    ordersNeedingAttention: number
    totalAllocations: number
    shortages: number
    pendingFulfillments: number
  }
  schedule: ProductionScheduleItem[]
  criticalShortages: {
    productId: string
    productName: string
    sku: string
    shortageQty: number
    affectedOrders: number
  }[]
  upcomingDeadlines: {
    orderId: string
    orderRef: string
    customerName: string
    dueDate: Date
    daysRemaining: number
    percentComplete: number
  }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference Number Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateOrderRef(entityId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ORD-${year}-`

  const [latest] = await db
    .select({ ref: commerceOrders.ref })
    .from(commerceOrders)
    .where(and(eq(commerceOrders.entityId, entityId), sql`${commerceOrders.ref} LIKE ${prefix + '%'}`))
    .orderBy(desc(commerceOrders.ref))
    .limit(1)

  let nextNum = 1
  if (latest?.ref) {
    const match = latest.ref.match(/ORD-\d{4}-(\d+)/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Management
// ─────────────────────────────────────────────────────────────────────────────

function calculateLineTotals(lines: OrderLine[]): { subtotal: number; taxTotal: number; total: number } {
  const subtotal = lines.reduce((sum, line) => {
    const discountMultiplier = 1 - (line.discount ?? 0) / 100
    return sum + line.quantity * line.unitPrice * discountMultiplier
  }, 0)

  // Assume 15% tax (configurable in production)
  const taxRate = 0.15
  const taxTotal = subtotal * taxRate
  const total = subtotal + taxTotal

  return { subtotal, taxTotal, total }
}

export async function createOrder(input: CreateOrderInput): Promise<OrderWithDetails> {
  logger.info({ entityId: input.entityId, customerId: input.customerId }, 'Creating order')

  const ref = await generateOrderRef(input.entityId)
  const { subtotal, taxTotal, total } = calculateLineTotals(input.lines)

  // Create order
  const [order] = await db
    .insert(commerceOrders)
    .values({
      entityId: input.entityId,
      customerId: input.customerId,
      quoteId: input.quoteId ?? null,
      ref,
      status: 'created',
      currency: input.currency ?? 'CAD',
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      shippingAddress: input.shippingAddress ?? null,
      billingAddress: input.billingAddress ?? null,
      notes: input.notes ?? null,
      createdBy: input.userId,
    })
    .returning()

  // Create order lines
  const lineValues = input.lines.map((line, idx) => {
    const discountMultiplier = 1 - (line.discount ?? 0) / 100
    const lineTotal = line.quantity * line.unitPrice * discountMultiplier

    return {
      entityId: input.entityId,
      orderId: order.id,
      description: line.description,
      sku: line.sku ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toFixed(2),
      discount: (line.discount ?? 0).toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      sortOrder: idx,
    }
  })

  const lines = await db.insert(commerceOrderLines).values(lineValues).returning()

  // Get customer
  const [customer] = await db
    .select()
    .from(commerceCustomers)
    .where(eq(commerceCustomers.id, input.customerId))
    .limit(1)

  logger.info({ orderId: order.id, ref: order.ref }, 'Order created')

  return { order, customer, lines, allocations: [] }
}

export async function getOrder(orderId: string): Promise<OrderWithDetails | null> {
  const [order] = await db.select().from(commerceOrders).where(eq(commerceOrders.id, orderId)).limit(1)

  if (!order) return null

  const [customer] = await db
    .select()
    .from(commerceCustomers)
    .where(eq(commerceCustomers.id, order.customerId))
    .limit(1)

  const lines = await db
    .select()
    .from(commerceOrderLines)
    .where(eq(commerceOrderLines.orderId, orderId))
    .orderBy(commerceOrderLines.sortOrder)

  const allocations = await db
    .select()
    .from(commerceMandateAllocations)
    .where(eq(commerceMandateAllocations.orderId, orderId))

  return { order, customer, lines, allocations }
}

export async function confirmOrder(orderId: string): Promise<typeof commerceOrders.$inferSelect> {
  const [order] = await db
    .select()
    .from(commerceOrders)
    .where(and(eq(commerceOrders.id, orderId), eq(commerceOrders.status, 'created')))
    .limit(1)

  if (!order) {
    throw new Error('Order not found or cannot be confirmed')
  }

  const [updated] = await db
    .update(commerceOrders)
    .set({
      status: 'confirmed',
      updatedAt: new Date(),
    })
    .where(eq(commerceOrders.id, orderId))
    .returning()

  logger.info({ orderId, ref: order.ref }, 'Order confirmed')

  return updated
}

export async function startFulfillment(orderId: string): Promise<typeof commerceOrders.$inferSelect> {
  const [order] = await db
    .select()
    .from(commerceOrders)
    .where(and(eq(commerceOrders.id, orderId), eq(commerceOrders.status, 'confirmed')))
    .limit(1)

  if (!order) {
    throw new Error('Order not found or cannot start fulfillment')
  }

  const [updated] = await db
    .update(commerceOrders)
    .set({
      status: 'fulfillment',
      updatedAt: new Date(),
    })
    .where(eq(commerceOrders.id, orderId))
    .returning()

  logger.info({ orderId, ref: order.ref }, 'Order fulfillment started')

  return updated
}

export async function markOrderShipped(
  orderId: string,
  trackingInfo?: { carrier?: string; trackingNumber?: string },
): Promise<typeof commerceOrders.$inferSelect> {
  const [order] = await db
    .select()
    .from(commerceOrders)
    .where(and(eq(commerceOrders.id, orderId), eq(commerceOrders.status, 'fulfillment')))
    .limit(1)

  if (!order) {
    throw new Error('Order not found or cannot be marked as shipped')
  }

  const metadata = { ...(order.metadata as object), shipping: trackingInfo }

  const [updated] = await db
    .update(commerceOrders)
    .set({
      status: 'shipped',
      metadata,
      updatedAt: new Date(),
    })
    .where(eq(commerceOrders.id, orderId))
    .returning()

  logger.info({ orderId, ref: order.ref, trackingInfo }, 'Order shipped')

  return updated
}

export async function completeOrder(orderId: string): Promise<typeof commerceOrders.$inferSelect> {
  const [order] = await db
    .select()
    .from(commerceOrders)
    .where(
      and(
        eq(commerceOrders.id, orderId),
        or(eq(commerceOrders.status, 'shipped'), eq(commerceOrders.status, 'delivered')),
      ),
    )
    .limit(1)

  if (!order) {
    throw new Error('Order not found or cannot be completed')
  }

  const [updated] = await db
    .update(commerceOrders)
    .set({
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(commerceOrders.id, orderId))
    .returning()

  logger.info({ orderId, ref: order.ref }, 'Order completed')

  return updated
}

export async function cancelOrder(orderId: string, reason?: string): Promise<typeof commerceOrders.$inferSelect> {
  const [order] = await db
    .select()
    .from(commerceOrders)
    .where(and(eq(commerceOrders.id, orderId), ne(commerceOrders.status, 'completed')))
    .limit(1)

  if (!order) {
    throw new Error('Order not found or already completed')
  }

  // Release any allocations
  await db
    .update(commerceMandateAllocations)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(commerceMandateAllocations.orderId, orderId), ne(commerceMandateAllocations.status, 'fulfilled')))

  const metadata = { ...(order.metadata as object), cancellationReason: reason }

  const [updated] = await db
    .update(commerceOrders)
    .set({
      status: 'cancelled',
      metadata,
      updatedAt: new Date(),
    })
    .where(eq(commerceOrders.id, orderId))
    .returning()

  logger.info({ orderId, ref: order.ref, reason }, 'Order cancelled')

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Allocation
// ─────────────────────────────────────────────────────────────────────────────

export async function allocateInventory(input: AllocationInput): Promise<typeof commerceMandateAllocations.$inferSelect> {
  // Get product and inventory
  const [product] = await db
    .select()
    .from(commerceProducts)
    .where(eq(commerceProducts.id, input.productId))
    .limit(1)

  if (!product) {
    throw new Error(`Product ${input.productId} not found`)
  }

  const [inventory] = await db
    .select()
    .from(commerceInventory)
    .where(eq(commerceInventory.productId, input.productId))
    .limit(1)

  if (!inventory) {
    throw new Error(`No inventory record for product ${input.productId}`)
  }

  // Check available stock
  if (inventory.quantityAvailable < input.quantity) {
    logger.warn(
      {
        productId: input.productId,
        requested: input.quantity,
        available: inventory.quantityAvailable,
      },
      'Insufficient stock for full allocation',
    )
  }

  // Reserve the inventory
  const reserveQty = Math.min(input.quantity, inventory.quantityAvailable)

  await db
    .update(commerceInventory)
    .set({
      quantityReserved: inventory.quantityReserved + reserveQty,
      quantityAvailable: inventory.quantityAvailable - reserveQty,
      updatedAt: new Date(),
    })
    .where(eq(commerceInventory.productId, input.productId))

  // Get order for entityId
  const [order] = await db.select().from(commerceOrders).where(eq(commerceOrders.id, input.orderId)).limit(1)

  if (!order) {
    throw new Error(`Order ${input.orderId} not found`)
  }

  // Create allocation record
  const [allocation] = await db
    .insert(commerceMandateAllocations)
    .values({
      entityId: order.entityId,
      orderId: input.orderId,
      productId: input.productId,
      inventoryId: inventory.id,
      quantityReserved: input.quantity,
      quantityAllocated: reserveQty,
      status: reserveQty >= input.quantity ? 'allocated' : 'reserved',
      expectedFulfillmentDate: input.expectedFulfillmentDate ?? null,
      priority: input.priority ?? 'medium',
      notes: input.notes ?? null,
    })
    .returning()

  logger.info(
    {
      allocationId: allocation.id,
      orderId: input.orderId,
      productId: input.productId,
      requested: input.quantity,
      allocated: reserveQty,
    },
    'Inventory allocated',
  )

  return allocation
}

export async function fulfillAllocation(
  allocationId: string,
  quantityFulfilled: number,
): Promise<typeof commerceMandateAllocations.$inferSelect> {
  const [allocation] = await db
    .select()
    .from(commerceMandateAllocations)
    .where(eq(commerceMandateAllocations.id, allocationId))
    .limit(1)

  if (!allocation) {
    throw new Error(`Allocation ${allocationId} not found`)
  }

  const maxFulfill = allocation.quantityAllocated - allocation.quantityFulfilled
  const actualFulfill = Math.min(quantityFulfilled, maxFulfill)

  if (actualFulfill <= 0) {
    throw new Error('No items available to fulfill')
  }

  const newFulfilled = allocation.quantityFulfilled + actualFulfill
  const newStatus = newFulfilled >= allocation.quantityReserved ? 'fulfilled' : 'allocated'

  // Update allocation
  const [updated] = await db
    .update(commerceMandateAllocations)
    .set({
      quantityFulfilled: newFulfilled,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(commerceMandateAllocations.id, allocationId))
    .returning()

  // Reduce inventory on hand and reserved
  await db
    .update(commerceInventory)
    .set({
      quantityOnHand: sql`${commerceInventory.quantityOnHand} - ${actualFulfill}`,
      quantityReserved: sql`${commerceInventory.quantityReserved} - ${actualFulfill}`,
      lastMovementAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(commerceInventory.id, allocation.inventoryId))

  // Record stock movement
  await db.insert(commerceStockMovements).values({
    entityId: allocation.entityId,
    productId: allocation.productId,
    type: 'out',
    quantity: actualFulfill,
    reason: 'Order fulfillment',
    referenceType: 'order',
    referenceId: allocation.orderId,
  })

  logger.info(
    {
      allocationId,
      quantityFulfilled: actualFulfill,
      status: newStatus,
    },
    'Allocation fulfilled',
  )

  return updated
}

export async function cancelAllocation(allocationId: string): Promise<typeof commerceMandateAllocations.$inferSelect> {
  const [allocation] = await db
    .select()
    .from(commerceMandateAllocations)
    .where(and(eq(commerceMandateAllocations.id, allocationId), ne(commerceMandateAllocations.status, 'fulfilled')))
    .limit(1)

  if (!allocation) {
    throw new Error('Allocation not found or already fulfilled')
  }

  // Release reserved inventory
  const releaseQty = allocation.quantityAllocated - allocation.quantityFulfilled

  await db
    .update(commerceInventory)
    .set({
      quantityReserved: sql`${commerceInventory.quantityReserved} - ${releaseQty}`,
      quantityAvailable: sql`${commerceInventory.quantityAvailable} + ${releaseQty}`,
      updatedAt: new Date(),
    })
    .where(eq(commerceInventory.id, allocation.inventoryId))

  // Update allocation
  const [updated] = await db
    .update(commerceMandateAllocations)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(commerceMandateAllocations.id, allocationId))
    .returning()

  logger.info({ allocationId, releasedQty: releaseQty }, 'Allocation cancelled')

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Allocation
// ─────────────────────────────────────────────────────────────────────────────

export async function autoAllocateOrder(
  orderId: string,
  priority: Priority = 'medium',
): Promise<(typeof commerceMandateAllocations.$inferSelect)[]> {
  const orderData = await getOrder(orderId)
  if (!orderData) {
    throw new Error(`Order ${orderId} not found`)
  }

  const { order, lines } = orderData

  if (order.status !== 'confirmed' && order.status !== 'fulfillment') {
    throw new Error('Order must be confirmed or in fulfillment to auto-allocate')
  }

  const allocations: (typeof commerceMandateAllocations.$inferSelect)[] = []

  for (const line of lines) {
    if (!line.sku) continue

    // Find product by SKU
    const [product] = await db
      .select()
      .from(commerceProducts)
      .where(and(eq(commerceProducts.entityId, order.entityId), eq(commerceProducts.sku, line.sku)))
      .limit(1)

    if (!product) {
      logger.warn({ orderId, sku: line.sku }, 'Product not found for auto-allocation')
      continue
    }

    // Check if already allocated
    const [existingAllocation] = await db
      .select()
      .from(commerceMandateAllocations)
      .where(
        and(
          eq(commerceMandateAllocations.orderId, orderId),
          eq(commerceMandateAllocations.productId, product.id),
          ne(commerceMandateAllocations.status, 'cancelled'),
        ),
      )
      .limit(1)

    if (existingAllocation) {
      logger.info({ orderId, productId: product.id }, 'Skipping - already allocated')
      continue
    }

    try {
      const allocation = await allocateInventory({
        orderId,
        productId: product.id,
        quantity: line.quantity,
        priority,
      })
      allocations.push(allocation)
    } catch (error) {
      logger.error({ orderId, productId: product.id, error }, 'Auto-allocation failed')
    }
  }

  logger.info({ orderId, allocationsCreated: allocations.length }, 'Auto-allocation complete')

  return allocations
}

// ─────────────────────────────────────────────────────────────────────────────
// Production Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getProductionDashboard(entityId: string): Promise<ProductionDashboard> {
  // Get orders in active states
  const orders = await db
    .select()
    .from(commerceOrders)
    .where(
      and(
        eq(commerceOrders.entityId, entityId),
        or(
          eq(commerceOrders.status, 'confirmed'),
          eq(commerceOrders.status, 'fulfillment'),
          eq(commerceOrders.status, 'needs_attention'),
        ),
      ),
    )

  const orderIds = orders.map((o) => o.id)

  // Get all allocations for these orders
  const allocations =
    orderIds.length > 0
      ? await db
          .select()
          .from(commerceMandateAllocations)
          .where(
            and(inArray(commerceMandateAllocations.orderId, orderIds), ne(commerceMandateAllocations.status, 'cancelled')),
          )
      : []

  // Get products for allocations
  const productIds = [...new Set(allocations.map((a) => a.productId))]
  const products =
    productIds.length > 0 ? await db.select().from(commerceProducts).where(inArray(commerceProducts.id, productIds)) : []

  const productMap = new Map(products.map((p) => [p.id, p]))

  // Get inventory for products
  const inventories =
    productIds.length > 0
      ? await db.select().from(commerceInventory).where(inArray(commerceInventory.productId, productIds))
      : []

  const inventoryMap = new Map(inventories.map((i) => [i.productId, i]))

  // Get customers
  const customerIds = [...new Set(orders.map((o) => o.customerId))]
  const customers =
    customerIds.length > 0
      ? await db.select().from(commerceCustomers).where(inArray(commerceCustomers.id, customerIds))
      : []

  const customerMap = new Map(customers.map((c) => [c.id, c]))
  const orderMap = new Map(orders.map((o) => [o.id, o]))

  // Build schedule
  const schedule: ProductionScheduleItem[] = allocations.map((alloc) => {
    const product = productMap.get(alloc.productId)
    const inventory = inventoryMap.get(alloc.productId)
    const order = orderMap.get(alloc.orderId)
    const customer = order ? customerMap.get(order.customerId) : null

    const shortage = Math.max(0, alloc.quantityReserved - alloc.quantityAllocated)

    return {
      orderId: alloc.orderId,
      orderRef: order?.ref ?? '',
      customerId: order?.customerId ?? '',
      customerName: customer?.name ?? '',
      productId: alloc.productId,
      productName: product?.name ?? '',
      sku: product?.sku ?? '',
      quantityRequired: alloc.quantityReserved,
      quantityAllocated: alloc.quantityAllocated,
      quantityFulfilled: alloc.quantityFulfilled,
      quantityShortage: shortage,
      stockAvailable: inventory?.quantityAvailable ?? 0,
      priority: alloc.priority as Priority,
      expectedFulfillmentDate: alloc.expectedFulfillmentDate,
      status: alloc.status as AllocationStatus,
    }
  })

  // Calculate shortages by product
  const shortageMap = new Map<string, { productId: string; productName: string; sku: string; shortageQty: number; affectedOrders: Set<string> }>()

  for (const item of schedule) {
    if (item.quantityShortage > 0) {
      const existing = shortageMap.get(item.productId)
      if (existing) {
        existing.shortageQty += item.quantityShortage
        existing.affectedOrders.add(item.orderId)
      } else {
        shortageMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          shortageQty: item.quantityShortage,
          affectedOrders: new Set([item.orderId]),
        })
      }
    }
  }

  const criticalShortages = Array.from(shortageMap.values())
    .map((s) => ({
      productId: s.productId,
      productName: s.productName,
      sku: s.sku,
      shortageQty: s.shortageQty,
      affectedOrders: s.affectedOrders.size,
    }))
    .sort((a, b) => b.affectedOrders - a.affectedOrders)
    .slice(0, 10)

  // Upcoming deadlines (orders with expected fulfillment dates)
  const now = new Date()
  const upcomingDeadlines = orders
    .filter((o) => o.status === 'fulfillment' || o.status === 'confirmed')
    .map((order) => {
      const orderAllocations = allocations.filter((a) => a.orderId === order.id)
      const totalRequired = orderAllocations.reduce((sum, a) => sum + a.quantityReserved, 0)
      const totalFulfilled = orderAllocations.reduce((sum, a) => sum + a.quantityFulfilled, 0)
      const percentComplete = totalRequired > 0 ? (totalFulfilled / totalRequired) * 100 : 0

      // Use earliest expected fulfillment date from allocations
      const earliestDate = orderAllocations
        .filter((a) => a.expectedFulfillmentDate)
        .map((a) => a.expectedFulfillmentDate!)
        .sort((a, b) => a.getTime() - b.getTime())[0]

      const dueDate = earliestDate ?? new Date(order.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000) // Default 14 days
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      const customer = customerMap.get(order.customerId)

      return {
        orderId: order.id,
        orderRef: order.ref,
        customerName: customer?.name ?? '',
        dueDate,
        daysRemaining,
        percentComplete,
      }
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10)

  // Summary stats
  const summary = {
    totalOrders: orders.length,
    ordersInFulfillment: orders.filter((o) => o.status === 'fulfillment').length,
    ordersNeedingAttention: orders.filter((o) => o.status === 'needs_attention').length,
    totalAllocations: allocations.length,
    shortages: shortageMap.size,
    pendingFulfillments: allocations.filter((a) => a.status !== 'fulfilled' && a.status !== 'cancelled').length,
  }

  return {
    summary,
    schedule,
    criticalShortages,
    upcomingDeadlines,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order List
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderListFilter {
  entityId: string
  status?: OrderStatus | OrderStatus[]
  customerId?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export async function listOrders(filter: OrderListFilter): Promise<OrderWithDetails[]> {
  const conditions = [eq(commerceOrders.entityId, filter.entityId)]

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    conditions.push(sql`${commerceOrders.status} = ANY(${statuses})`)
  }

  if (filter.customerId) {
    conditions.push(eq(commerceOrders.customerId, filter.customerId))
  }

  if (filter.dateFrom) {
    conditions.push(gte(commerceOrders.createdAt, filter.dateFrom))
  }

  if (filter.dateTo) {
    conditions.push(lte(commerceOrders.createdAt, filter.dateTo))
  }

  const orders = await db
    .select()
    .from(commerceOrders)
    .where(and(...conditions))
    .orderBy(desc(commerceOrders.createdAt))

  // Get all related data
  const orderIds = orders.map((o) => o.id)
  const customerIds = [...new Set(orders.map((o) => o.customerId))]

  const [lines, allocationsData, customersData] = await Promise.all([
    orderIds.length > 0
      ? db.select().from(commerceOrderLines).where(inArray(commerceOrderLines.orderId, orderIds))
      : [],
    orderIds.length > 0
      ? db.select().from(commerceMandateAllocations).where(inArray(commerceMandateAllocations.orderId, orderIds))
      : [],
    customerIds.length > 0
      ? db.select().from(commerceCustomers).where(inArray(commerceCustomers.id, customerIds))
      : [],
  ])

  const linesMap = new Map<string, (typeof commerceOrderLines.$inferSelect)[]>()
  for (const line of lines) {
    const existing = linesMap.get(line.orderId) ?? []
    existing.push(line)
    linesMap.set(line.orderId, existing)
  }

  const allocationsMap = new Map<string, (typeof commerceMandateAllocations.$inferSelect)[]>()
  for (const alloc of allocationsData) {
    const existing = allocationsMap.get(alloc.orderId) ?? []
    existing.push(alloc)
    allocationsMap.set(alloc.orderId, existing)
  }

  const customerMap = new Map(customersData.map((c) => [c.id, c]))

  return orders.map((order) => ({
    order,
    customer: customerMap.get(order.customerId)!,
    lines: linesMap.get(order.id) ?? [],
    allocations: allocationsMap.get(order.id) ?? [],
  }))
}
