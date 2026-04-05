'use server'

/**
 * Workflow Trigger Actions
 *
 * Server actions for key workflow transitions:
 * 1. Sales → Procurement: Create PO from accepted quote (via command bus)
 * 2. Receiving → Production: Trigger production readiness when all PO items received
 */
import { executeCommand } from '@/lib/control/control-adapter'
import { auth } from '@nzila/platform-auth/entra/server'
import { revalidatePath } from 'next/cache'

// ── Sales → Procurement Trigger ────────────────────────────────────────────

export interface TriggerPOResult {
  ok: boolean
  orderId?: string
  poId?: string
  blockers?: string[]
  error?: string
}

/**
 * Create a Purchase Order from an accepted quote.
 *
 * Routes through the command bus for full guard/audit pipeline:
 * invariant → workflow → payment → service → event → audit.
 */
export async function triggerSalesToProcurementAction(
  quoteId: string,
): Promise<TriggerPOResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'Not authenticated' }

  const result = await executeCommand({
    type: 'trigger_sales_to_procurement',
    quote_id: quoteId,
    actor_id: userId,
  })

  if (result.ok) {
    revalidatePath('/purchase-orders')
    revalidatePath(`/quotes/${quoteId}`)
  }

  return {
    ok: result.ok,
    orderId: result.data?.entity_id,
    error: result.error,
  }
}

// ── Check PO Receiving → Production Readiness ──────────────────────────────

export interface ProductionReadinessResult {
  ok: boolean
  allReceived: boolean
  orderId?: string
  orderRef?: string
  totalPOs: number
  receivedPOs: number
  pendingPOs: number
  message: string
}

/**
 * Check if all POs for an order are fully received.
 * If yes, routes through the command bus to transition the order
 * to fulfillment (production ready).
 *
 * Called after each PO line receive operation.
 */
export async function checkProductionReadinessAction(
  orderId: string,
): Promise<ProductionReadinessResult> {
  try {
    const { userId } = await auth()
    if (!userId) return { ok: false, allReceived: false, totalPOs: 0, receivedPOs: 0, pendingPOs: 0, message: 'Not authenticated' }

    const result = await executeCommand({
      type: 'check_production_readiness',
      order_id: orderId,
      actor_id: userId,
    })

    if (!result.ok) {
      return { ok: false, allReceived: false, totalPOs: 0, receivedPOs: 0, pendingPOs: 0, message: result.error ?? 'Check failed' }
    }

    const statusAfter = result.data?.status_after ?? ''
    const allReceived = statusAfter === 'FULFILLMENT'

    if (allReceived) {
      revalidatePath('/orders')
      revalidatePath(`/orders/${orderId}`)
    }

    return {
      ok: true,
      allReceived,
      orderId,
      totalPOs: 0,
      receivedPOs: 0,
      pendingPOs: 0,
      message: result.data?.message ?? 'Check completed',
    }
  } catch (err) {
    return {
      ok: false,
      allReceived: false,
      totalPOs: 0,
      receivedPOs: 0,
      pendingPOs: 0,
      message: err instanceof Error ? err.message : 'Check failed',
    }
  }
}
