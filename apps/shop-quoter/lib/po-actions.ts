/**
 * Purchase Order Server Actions
 *
 * Server actions for PO management in shop-quoter app.
 */

'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  receivePOLine,
  getPOSummary,
  type CreatePOInput,
  type UpdatePOInput,
  type POStatus,
  type POWithLines,
  type POSummary,
} from './po-service'
import { logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

interface POLineInput {
  productId?: string
  description: string
  sku?: string
  quantity: number
  unitCost: number
  orderId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function createPOAction(input: {
  entityId: string
  supplierId: string
  lines: POLineInput[]
  expectedDeliveryDate?: string
  notes?: string
  currency?: string
  shippingCost?: number
}): Promise<ActionResult<POWithLines>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const poInput: CreatePOInput = {
      entityId: input.entityId,
      supplierId: input.supplierId,
      lines: input.lines,
      expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
      notes: input.notes,
      currency: input.currency,
      shippingCost: input.shippingCost,
      createdBy: userId,
    }

    const result = await createPurchaseOrder(poInput)

    revalidatePath('/purchase-orders')
    revalidatePath('/dashboard')

    return { success: true, data: result }
  } catch (error) {
    logger.error({ error }, 'Failed to create purchase order')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function getPOAction(poId: string): Promise<ActionResult<POWithLines | null>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const result = await getPurchaseOrder(poId)
    return { success: true, data: result }
  } catch (error) {
    logger.error({ error, poId }, 'Failed to get purchase order')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// List Purchase Orders
// ─────────────────────────────────────────────────────────────────────────────

export async function listPOsAction(filter: {
  entityId: string
  status?: POStatus | POStatus[]
  supplierId?: string
  fromDate?: string
  toDate?: string
  search?: string
}): Promise<ActionResult<POWithLines[]>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const result = await listPurchaseOrders({
      entityId: filter.entityId,
      status: filter.status,
      supplierId: filter.supplierId,
      fromDate: filter.fromDate ? new Date(filter.fromDate) : undefined,
      toDate: filter.toDate ? new Date(filter.toDate) : undefined,
      search: filter.search,
    })

    return { success: true, data: result }
  } catch (error) {
    logger.error({ error }, 'Failed to list purchase orders')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function updatePOAction(
  poId: string,
  input: {
    lines?: POLineInput[]
    expectedDeliveryDate?: string
    notes?: string
    shippingCost?: number
    status?: POStatus
  },
): Promise<ActionResult<POWithLines | null>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const updateInput: UpdatePOInput = {
      lines: input.lines,
      expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
      notes: input.notes,
      shippingCost: input.shippingCost,
      status: input.status,
    }

    const result = await updatePurchaseOrder(poId, updateInput)

    revalidatePath('/purchase-orders')
    revalidatePath(`/purchase-orders/${poId}`)

    return { success: true, data: result }
  } catch (error) {
    logger.error({ error, poId }, 'Failed to update purchase order')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPOAction(poId: string): Promise<ActionResult<POWithLines | null>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const result = await sendPurchaseOrder(poId)

    revalidatePath('/purchase-orders')
    revalidatePath(`/purchase-orders/${poId}`)

    return { success: true, data: result }
  } catch (error) {
    logger.error({ error, poId }, 'Failed to send purchase order')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelPOAction(poId: string): Promise<ActionResult<POWithLines | null>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const result = await cancelPurchaseOrder(poId)

    revalidatePath('/purchase-orders')
    revalidatePath(`/purchase-orders/${poId}`)

    return { success: true, data: result }
  } catch (error) {
    logger.error({ error, poId }, 'Failed to cancel purchase order')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Receive PO Line Items
// ─────────────────────────────────────────────────────────────────────────────

export async function receivePOLineAction(input: {
  lineId: string
  quantityReceived: number
  notes?: string
}): Promise<ActionResult<{ lineId: string; quantityReceived: number }>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const line = await receivePOLine({
      lineId: input.lineId,
      quantityReceived: input.quantityReceived,
      receivedBy: userId,
      notes: input.notes,
    })

    revalidatePath('/purchase-orders')
    revalidatePath('/inventory')

    return {
      success: true,
      data: { lineId: line.id, quantityReceived: line.quantityReceived },
    }
  } catch (error) {
    logger.error({ error, lineId: input.lineId }, 'Failed to receive PO line')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get PO Summary / Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getPOSummaryAction(input: {
  entityId: string
  fromDate?: string
  toDate?: string
}): Promise<ActionResult<POSummary>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const result = await getPOSummary(
      input.entityId,
      input.fromDate ? new Date(input.fromDate) : undefined,
      input.toDate ? new Date(input.toDate) : undefined,
    )

    return { success: true, data: result }
  } catch (error) {
    logger.error({ error }, 'Failed to get PO summary')
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
