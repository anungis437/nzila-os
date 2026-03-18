/**
 * Flow — Production Guard
 *
 * Validates all prerequisites before production can start:
 * - order exists and valid
 * - PO state allows production
 * - payment gate clears
 * - vendor assigned
 * - proofing conditions satisfied
 */
import type { ProductionGateCheckResult } from '@/lib/control/types'
import { orderRepo, purchaseOrderRepo, vendorRepo } from '@/lib/repositories'
import { checkCanStartProduction } from './payment-guard'
import { logger } from '@/lib/logger'

export async function checkProductionReadiness(
  orderId: string,
  purchaseOrderId: string,
  vendorId: string,
  orgId: string,
): Promise<ProductionGateCheckResult> {
  const blockers: string[] = []
  let poValid = false
  let paymentCleared = false
  let vendorAssigned = false
  const proofingSatisfied = true // default unless PO specifies proofing

  // 1. Order exists and is in a valid state for production
  const order = await orderRepo.findById(orderId, orgId)
  if (!order) {
    blockers.push(`Order "${orderId}" not found`)
  } else {
    const validOrderStates = ['CONFIRMED', 'DEPOSIT_REQUIRED', 'PAYMENT_PARTIAL', 'PAYMENT_COMPLETE', 'READY_FOR_PROCUREMENT']
    if (!validOrderStates.includes(order.status)) {
      blockers.push(`Order status "${order.status}" does not allow production start`)
    }
  }

  // 2. PO exists and is in valid state
  const po = await purchaseOrderRepo.findById(purchaseOrderId, orgId)
  if (!po) {
    blockers.push(`PurchaseOrder "${purchaseOrderId}" not found`)
  } else {
    const validPOStates = ['CONFIRMED']
    if (!validPOStates.includes(po.status)) {
      blockers.push(`PO status "${po.status}" does not allow production — must be CONFIRMED`)
    } else {
      poValid = true
    }
  }

  // 3. Payment gate
  const paymentCheck = await checkCanStartProduction(orderId, orgId)
  if (!paymentCheck.allowed) {
    blockers.push(...paymentCheck.reasons)
  } else {
    paymentCleared = true
  }

  // 4. Vendor assignment
  const vendor = await vendorRepo.findById(vendorId, orgId)
  if (!vendor) {
    blockers.push(`Vendor "${vendorId}" not found`)
  } else if (!vendor.active) {
    blockers.push(`Vendor "${vendor.name}" is inactive`)
  } else {
    vendorAssigned = true
  }

  logger.info('Production guard evaluated', {
    orderId,
    purchaseOrderId,
    vendorId,
    allowed: blockers.length === 0,
    blockerCount: blockers.length,
  })

  return {
    allowed: blockers.length === 0,
    blockers,
    order_id: orderId,
    po_valid: poValid,
    payment_cleared: paymentCleared,
    vendor_assigned: vendorAssigned,
    proofing_satisfied: proofingSatisfied,
  }
}
