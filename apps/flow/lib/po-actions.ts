/**
 * Purchase Order Server Actions
 *
 * Server actions for PO management in Flow app.
 */

'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { executeCommandV2 } from '@/lib/control/control-adapter'
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
  supplierId: string
  lines: POLineInput[]
  expectedDeliveryDate?: string
  notes?: string
  currency?: string
  shippingCost?: number
}): Promise<ActionResult<POWithLines>> {
  try {
    const ctx = await resolveOrgContext()

    const poInput: CreatePOInput = {
      orgId: ctx.orgId,
      supplierId: input.supplierId,
      lines: input.lines,
      expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
      notes: input.notes,
      currency: input.currency,
      shippingCost: input.shippingCost,
      createdBy: ctx.actorId,
    }

    const result = await createPurchaseOrder(poInput)

    revalidatePath('/purchase-orders')
    revalidatePath('/dashboard')

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to create purchase order', { error })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function getPOAction(poId: string): Promise<ActionResult<POWithLines | null>> {
  try {
    await resolveOrgContext()

    const result = await getPurchaseOrder(poId)
    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to get purchase order', { error, poId })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// List Purchase Orders
// ─────────────────────────────────────────────────────────────────────────────

export async function listPOsAction(filter: {
  status?: POStatus | POStatus[]
  supplierId?: string
  fromDate?: string
  toDate?: string
  search?: string
}): Promise<ActionResult<POWithLines[]>> {
  try {
    const ctx = await resolveOrgContext()

    const result = await listPurchaseOrders({
      orgId: ctx.orgId,
      status: filter.status,
      supplierId: filter.supplierId,
      fromDate: filter.fromDate ? new Date(filter.fromDate) : undefined,
      toDate: filter.toDate ? new Date(filter.toDate) : undefined,
      search: filter.search,
    })

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to list purchase orders', { error })
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
    await resolveOrgContext()

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
    logger.error('Failed to update purchase order', { error, poId })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPOAction(poId: string): Promise<ActionResult<POWithLines | null>> {
  const result = await executeCommandV2({
    type: 'send_purchase_order',
    purchase_order_id: poId,
    actor_id: '', // resolved by control adapter
  })

  if (result.success) {
    revalidatePath('/purchase-orders')
    revalidatePath(`/purchase-orders/${poId}`)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel Purchase Order
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelPOAction(poId: string): Promise<ActionResult<POWithLines | null>> {
  try {
    await resolveOrgContext()

    const result = await cancelPurchaseOrder(poId)

    revalidatePath('/purchase-orders')
    revalidatePath(`/purchase-orders/${poId}`)

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to cancel purchase order', { error, poId })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
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
    const ctx = await resolveOrgContext()

    const line = await receivePOLine({
      lineId: input.lineId,
      quantityReceived: input.quantityReceived,
      receivedBy: ctx.actorId,
      notes: input.notes,
    })

    revalidatePath('/purchase-orders')
    revalidatePath('/inventory')

    return {
      success: true,
      data: { lineId: line.id, quantityReceived: line.quantityReceived },
    }
  } catch (error) {
    logger.error('Failed to receive PO line', { error, lineId: input.lineId })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get PO Summary / Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getPOSummaryAction(input: {
  fromDate?: string
  toDate?: string
}): Promise<ActionResult<POSummary>> {
  try {
    const ctx = await resolveOrgContext()

    const result = await getPOSummary(
      ctx.orgId,
      input.fromDate ? new Date(input.fromDate) : undefined,
      input.toDate ? new Date(input.toDate) : undefined,
    )

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to get PO summary', { error })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
