'use server'

/**
 * Production Server Actions
 *
 * Next.js server actions for order management and production planning.
 */

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import {
  createOrder,
  getOrder,
  listOrders,
  confirmOrder,
  startFulfillment,
  markOrderShipped,
  completeOrder,
  cancelOrder,
  allocateInventory,
  fulfillAllocation,
  cancelAllocation,
  autoAllocateOrder,
  getProductionDashboard,
  type OrderWithDetails,
  type OrderListFilter,
  type OrderStatus,
  type Priority,
  type ProductionDashboard,
} from './production-service'
import { commerceOrders, commerceMandateAllocations } from '@nzila/db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface OrderLineInput {
  productId: string
  description: string
  sku?: string
  quantity: number
  unitPrice: number
  discount?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function createOrderAction(input: {
  customerId: string
  quoteId?: string
  lines: OrderLineInput[]
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
}): Promise<ActionResult<OrderWithDetails>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const data = await createOrder({
      ...input,
      entityId,
      userId,
    })

    revalidatePath('/orders')
    revalidatePath('/production')

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    }
  }
}

export async function getOrderAction(orderId: string): Promise<ActionResult<OrderWithDetails>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const data = await getOrder(orderId)
    if (!data) {
      return { success: false, error: 'Order not found' }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get order',
    }
  }
}

export async function listOrdersAction(filter?: {
  status?: OrderStatus | OrderStatus[]
  customerId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}): Promise<ActionResult<OrderWithDetails[]>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const filterObj: OrderListFilter = {
      entityId,
      status: filter?.status,
      customerId: filter?.customerId,
      dateFrom: filter?.dateFrom ? new Date(filter.dateFrom) : undefined,
      dateTo: filter?.dateTo ? new Date(filter.dateTo) : undefined,
      search: filter?.search,
    }

    const orders = await listOrders(filterObj)

    return { success: true, data: orders }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list orders',
    }
  }
}

export async function confirmOrderAction(
  orderId: string,
): Promise<ActionResult<typeof commerceOrders.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const order = await confirmOrder(orderId)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/production')

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm order',
    }
  }
}

export async function startFulfillmentAction(
  orderId: string,
): Promise<ActionResult<typeof commerceOrders.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const order = await startFulfillment(orderId)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/production')

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start fulfillment',
    }
  }
}

export async function markOrderShippedAction(
  orderId: string,
  trackingInfo?: { carrier?: string; trackingNumber?: string },
): Promise<ActionResult<typeof commerceOrders.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const order = await markOrderShipped(orderId, trackingInfo)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/production')

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark order as shipped',
    }
  }
}

export async function completeOrderAction(
  orderId: string,
): Promise<ActionResult<typeof commerceOrders.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const order = await completeOrder(orderId)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/production')

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete order',
    }
  }
}

export async function cancelOrderAction(
  orderId: string,
  reason?: string,
): Promise<ActionResult<typeof commerceOrders.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const order = await cancelOrder(orderId, reason)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/production')

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocation Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function allocateInventoryAction(input: {
  orderId: string
  productId: string
  quantity: number
  priority?: Priority
  expectedFulfillmentDate?: string
  notes?: string
}): Promise<ActionResult<typeof commerceMandateAllocations.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const allocation = await allocateInventory({
      ...input,
      expectedFulfillmentDate: input.expectedFulfillmentDate
        ? new Date(input.expectedFulfillmentDate)
        : undefined,
    })

    revalidatePath(`/orders/${input.orderId}`)
    revalidatePath('/production')
    revalidatePath('/inventory')

    return { success: true, data: allocation }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to allocate inventory',
    }
  }
}

export async function fulfillAllocationAction(
  allocationId: string,
  quantityFulfilled: number,
): Promise<ActionResult<typeof commerceMandateAllocations.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const allocation = await fulfillAllocation(allocationId, quantityFulfilled)

    revalidatePath('/orders')
    revalidatePath('/production')
    revalidatePath('/inventory')

    return { success: true, data: allocation }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fulfill allocation',
    }
  }
}

export async function cancelAllocationAction(
  allocationId: string,
): Promise<ActionResult<typeof commerceMandateAllocations.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const allocation = await cancelAllocation(allocationId)

    revalidatePath('/orders')
    revalidatePath('/production')
    revalidatePath('/inventory')

    return { success: true, data: allocation }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel allocation',
    }
  }
}

export async function autoAllocateOrderAction(
  orderId: string,
  priority?: Priority,
): Promise<ActionResult<(typeof commerceMandateAllocations.$inferSelect)[]>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const allocations = await autoAllocateOrder(orderId, priority)

    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/production')
    revalidatePath('/inventory')

    return { success: true, data: allocations }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to auto-allocate order',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getProductionDashboardAction(): Promise<ActionResult<ProductionDashboard>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const dashboard = await getProductionDashboard(entityId)

    return { success: true, data: dashboard }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get production dashboard',
    }
  }
}
